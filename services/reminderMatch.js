"use strict";

const { db } = require('../db/connection');
const { pushToUser } = require('./push');
const { sendSMS } = require('./whatsapp');

async function runMatchReminders() {
    const pendingRes = await db.query(`
        SELECT br.id, br.user_id, br.remind_minutes,
               m.home_team, m.away_team, m.start_time,
               b.goles_local, b.goles_visitante,
               u.whatsapp_number, u.whatsapp_consent
        FROM bet_reminders br
        JOIN matches m ON m.id = br.match_id
        JOIN bets b ON b.planilla_id = br.planilla_id AND b.match_id = br.match_id
        JOIN users u ON u.id = br.user_id
        WHERE br.email_sent = false
          AND br.scheduled_for <= NOW() + INTERVAL '5 minutes'
          AND br.scheduled_for >= NOW() - INTERVAL '10 minutes'
          AND m.estado = 'scheduled'
    `);

    if (pendingRes.rows.length === 0) {
        console.log('[match-reminder] no pending reminders');
        return { reminders: 0, notified: 0 };
    }

    let notified = 0;

    for (const row of pendingRes.rows) {
        const score = `${row.goles_local}-${row.goles_visitante}`;
        const mins = row.remind_minutes;

        // Mark as sent first to prevent duplicate sends on overlapping cron runs
        const markRes = await db.query(
            `UPDATE bet_reminders SET email_sent = true, sent_at = NOW()
             WHERE id = $1 AND email_sent = false
             RETURNING id`,
            [row.id]
        );
        if (markRes.rowCount === 0) continue; // already sent by a concurrent run

        const pushPayload = {
            title: `⏰ Empieza en ${mins} min`,
            body: `${row.home_team} vs ${row.away_team} — tu pronóstico: ${score}`,
            url: '/apuestas',
            icon: '/favicon.svg',
        };

        await pushToUser(row.user_id, pushPayload).catch(err =>
            console.error(`[match-reminder] push failed user=${row.user_id}:`, err.message)
        );

        if (row.whatsapp_number && row.whatsapp_consent) {
            const smsBody = `⏰ ${row.home_team} vs ${row.away_team} empieza en ${mins} min — tu pronóstico: ${score} 🤞 prodecaballito.com/apuestas`;
            await sendSMS({ to: row.whatsapp_number, body: smsBody })
                .catch(err => console.error(`[match-reminder] sms failed user=${row.user_id}:`, err.message));
        }

        notified++;
    }

    console.log(`[match-reminder] reminders=${pendingRes.rows.length} notified=${notified}`);
    return { reminders: pendingRes.rows.length, notified };
}

module.exports = { runMatchReminders };
