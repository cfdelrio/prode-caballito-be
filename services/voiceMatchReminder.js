'use strict';

const { db } = require('../db/connection');
const { sendEventBatch } = require('./engageClient');

const REMINDER_TYPE = 'voice_match_reminder';
const WINDOW_MIN = 25;
const WINDOW_MAX = 35;

/**
 * Cron job (cada 5 min): encuentra matches que arrancan en 25–35 min
 * y para cada usuario con bet pending + teléfono, dispara prode.voice_match_reminder.
 *
 * Idempotente via reminder_sent(user_id, match_id, 'voice_match_reminder').
 * Skip silencioso si ENGAGE_ENABLED !== 'true'.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.userIds]  Restringir a UUIDs específicos (test admin).
 * @param {boolean}  [opts.dryRun]   Solo devolver preview, sin insertar ni publicar.
 */
async function runVoiceMatchReminders({ userIds = null, dryRun = false } = {}) {
    if (process.env.ENGAGE_ENABLED !== 'true' && !dryRun) {
        console.log('[voice-match-reminder] ENGAGE_ENABLED=false — skipping');
        return { matches_in_window: 0, users_notified: 0, skipped: 0, engage_disabled: true };
    }

    const matchesRes = await db.query(`
        SELECT id, home_team, away_team, start_time, tournament_id
        FROM matches
        WHERE estado = 'scheduled'
          AND start_time BETWEEN NOW() + INTERVAL '${WINDOW_MIN} minutes'
                              AND NOW() + INTERVAL '${WINDOW_MAX} minutes'
    `);

    if (matchesRes.rows.length === 0) {
        return { matches_in_window: 0, users_notified: 0, skipped: 0 };
    }

    let notified = 0;
    let skipped = 0;
    const preview = [];

    for (const match of matchesRes.rows) {
        const params = [match.id];
        let userFilter = '';
        if (userIds && userIds.length > 0) {
            params.push(userIds);
            userFilter = ` AND u.id = ANY($2::uuid[])`;
        }

        const usersRes = await db.query(`
            SELECT u.id AS user_id, u.nombre, u.email, u.whatsapp_number,
                   b.goles_local, b.goles_visitante
            FROM bets b
            JOIN planillas p ON p.id = b.planilla_id
            JOIN users u ON u.id = p.user_id
            WHERE b.match_id = $1
              AND u.whatsapp_number IS NOT NULL
              ${userFilter}
        `, params);

        const events = [];
        for (const u of usersRes.rows) {
            if (!dryRun) {
                const insertRes = await db.query(
                    `INSERT INTO reminder_sent (user_id, match_id, reminder_type)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (user_id, match_id, reminder_type) DO NOTHING
                     RETURNING user_id`,
                    [u.user_id, match.id, REMINDER_TYPE]
                ).catch(() => ({ rows: [] }));

                if (insertRes.rows.length === 0) { skipped++; continue; }
            }

            events.push({
                type: 'prode.voice_match_reminder',
                userId: String(u.user_id),
                idempotencyKey: `voice_match_reminder:${u.user_id}:${match.id}`,
                payload: {
                    business_context: {
                        template: 'Match Reminder Prode',
                        home_team: match.home_team,
                        away_team: match.away_team,
                        minutes_to_kickoff: WINDOW_MIN,
                        bet_local: u.goles_local,
                        bet_visitante: u.goles_visitante,
                    },
                },
                metadata: {
                    user_contact: {
                        nombre: u.nombre,
                        email: u.email,
                        phone: u.whatsapp_number,
                        idioma_pref: 'es-AR',
                    },
                },
            });

            if (dryRun) preview.push({
                match: `${match.home_team} vs ${match.away_team}`,
                user: u.nombre,
                phone: u.whatsapp_number,
                bet: `${u.goles_local}-${u.goles_visitante}`,
            });
            notified++;
        }

        if (events.length > 0 && !dryRun) {
            await sendEventBatch(events).catch(err =>
                console.error(`[voice-match-reminder] batch failed match=${match.id}:`, err.message)
            );
        }
    }

    console.log(`[voice-match-reminder] matches_in_window=${matchesRes.rows.length} notified=${notified} skipped=${skipped} dryRun=${dryRun}`);
    return {
        matches_in_window: matchesRes.rows.length,
        users_notified: notified,
        skipped,
        dry_run: dryRun,
        ...(dryRun ? { preview } : {}),
    };
}

module.exports = { runVoiceMatchReminders, REMINDER_TYPE };
