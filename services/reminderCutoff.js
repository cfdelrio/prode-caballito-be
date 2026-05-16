"use strict";

const { db } = require('../db/connection');
const { pushToUser } = require('./push');
const { sendSMS } = require('./whatsapp');

const REMINDER_TYPE = 'cutoff_30min';

/**
 * Build the push payload for a user given how many matches they're missing
 * and the first one's teams (for the single-match case).
 */
function buildPayload({ pending, firstMatch }) {
    if (pending === 1 && firstMatch) {
        return {
            title: '⏰ Cierra en 30 min',
            body: `${firstMatch.home_team} vs ${firstMatch.away_team} — todavía no pronosticaste`,
            url: '/apuestas',
            icon: '/favicon.svg',
        };
    }
    return {
        title: '⏰ Cierran partidos en 30 min',
        body: `Te faltan ${pending} pronóstico${pending === 1 ? '' : 's'} — entrá antes del cierre`,
        url: '/apuestas',
        icon: '/favicon.svg',
    };
}

/**
 * Find matches whose cutoff is between now+25min and now+35min and notify each
 * user that has at least one planilla but is missing a bet for that match.
 *
 * Idempotent: insert into reminder_sent before sending; ON CONFLICT skips users
 * already reminded for the same (match, reminder_type).
 */
async function runCutoffReminders() {
    const matchesRes = await db.query(`
        SELECT id, home_team, away_team, time_cutoff
        FROM matches
        WHERE estado = 'scheduled'
          AND time_cutoff IS NOT NULL
          AND time_cutoff BETWEEN NOW() + INTERVAL '25 minutes'
                              AND NOW() + INTERVAL '35 minutes'
    `);

    if (matchesRes.rows.length === 0) {
        console.log('[cutoff-reminder] no matches in window');
        return { matches: 0, users_notified: 0 };
    }

    const matchIds = matchesRes.rows.map(m => m.id);

    // Users that have at least one planilla AND don't have a bet for at least one
    // of these matches. We aggregate to count missing bets per user.
    const missingRes = await db.query(`
        SELECT u.id AS user_id, m.id AS match_id, m.home_team, m.away_team
        FROM users u
        JOIN planillas p ON p.user_id = u.id
        CROSS JOIN UNNEST($1::uuid[]) AS m_id
        JOIN matches m ON m.id = m_id
        LEFT JOIN bets b ON b.planilla_id = p.id AND b.match_id = m.id
        WHERE b.id IS NULL
        GROUP BY u.id, m.id, m.home_team, m.away_team
    `, [matchIds]);

    if (missingRes.rows.length === 0) {
        console.log('[cutoff-reminder] no users with missing bets');
        return { matches: matchesRes.rows.length, users_notified: 0 };
    }

    // Group missing matches by user
    const byUser = new Map();
    for (const row of missingRes.rows) {
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
        byUser.get(row.user_id).push(row);
    }

    let notified = 0;
    let skipped = 0;

    for (const [userId, missingMatches] of byUser.entries()) {
        // Insert all (user, match) into reminder_sent first to prevent duplicate
        // sends if the cron overlaps. ON CONFLICT skips ones already sent.
        const insertRes = await db.query(
            `INSERT INTO reminder_sent (user_id, match_id, reminder_type)
             SELECT $1, unnest($2::uuid[]), $3
             ON CONFLICT (user_id, match_id, reminder_type) DO NOTHING
             RETURNING match_id`,
            [userId, missingMatches.map(m => m.match_id), REMINDER_TYPE]
        );

        const freshCount = insertRes.rows.length;
        if (freshCount === 0) {
            skipped++;
            continue;
        }

        const firstMatch = missingMatches[0];
        const payload = buildPayload({ pending: freshCount, firstMatch });

        // Push notification
        await pushToUser(userId, payload).catch(err =>
            console.error(`[cutoff-reminder] push failed user=${userId}:`, err.message)
        );

        // SMS notification (if user has whatsapp_number + consent)
        const userRes = await db.query(
            `SELECT whatsapp_number, whatsapp_consent FROM users WHERE id = $1`,
            [userId]
        );
        if (userRes.rows.length > 0) {
            const { whatsapp_number, whatsapp_consent } = userRes.rows[0];
            if (whatsapp_number && whatsapp_consent) {
                const smsBody = freshCount === 1
                    ? `⏰ ${firstMatch.home_team} vs ${firstMatch.away_team} cierra en 30 min — aún no pronosticaste 👉 prodecaballito.com/apuestas`
                    : `⏰ Te faltan ${freshCount} pronósticos que cierran en 30 min 👉 prodecaballito.com/apuestas`;
                await sendSMS({ to: whatsapp_number, body: smsBody })
                    .catch(err => console.error(`[cutoff-reminder] sms failed user=${userId}:`, err.message));
            }
        }

        notified++;
    }

    console.log(`[cutoff-reminder] matches=${matchesRes.rows.length} notified=${notified} skipped=${skipped}`);
    return { matches: matchesRes.rows.length, users_notified: notified, skipped };
}

module.exports = { runCutoffReminders, REMINDER_TYPE, buildPayload };
