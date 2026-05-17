"use strict";

const { db } = require('../db/connection');
const { pushToUser } = require('./push');
const { sendSMS } = require('./whatsapp');

/**
 * Process opt-in pre-kickoff reminders saved when the user placed the bet
 * (bet_reminders table). Each row has a scheduled_for = match.start_time - remind_minutes.
 *
 * For every due row (scheduled_for <= NOW(), email_sent = false):
 *   - Push notification
 *   - SMS if user has whatsapp_number + whatsapp_consent
 *   - Mark email_sent = true (used as "sent" flag for all channels)
 */
async function processBetReminders() {
    const res = await db.query(`
        SELECT br.id, br.user_id, br.match_id, br.remind_minutes,
               m.home_team, m.away_team, m.start_time,
               u.whatsapp_number, u.whatsapp_consent
        FROM bet_reminders br
        JOIN matches m ON m.id = br.match_id
        JOIN users   u ON u.id = br.user_id
        WHERE br.email_sent = false
          AND br.scheduled_for <= NOW()
          AND m.estado = 'scheduled'
        ORDER BY br.scheduled_for ASC
        LIMIT 200
    `);

    let sent = 0;
    let failed = 0;

    for (const r of res.rows) {
        try {
            const payload = {
                title: `⚽ Empieza en ${r.remind_minutes} min`,
                body: `${r.home_team} vs ${r.away_team}`,
                url: '/apuestas',
                icon: '/favicon.svg',
            };

            await pushToUser(r.user_id, payload).catch(err =>
                console.error(`[bet-reminders] push failed user=${r.user_id} match=${r.match_id}:`, err.message)
            );

            if (r.whatsapp_number && r.whatsapp_consent) {
                const body = `⚽ ${r.home_team} vs ${r.away_team} empieza en ${r.remind_minutes} min 👉 prodecaballito.com`;
                await sendSMS({ to: r.whatsapp_number, body }).catch(err =>
                    console.error(`[bet-reminders] sms failed user=${r.user_id} match=${r.match_id}:`, err.message)
                );
            }

            await db.query(
                `UPDATE bet_reminders SET email_sent = true, sent_at = NOW() WHERE id = $1`,
                [r.id]
            );
            sent++;
        } catch (err) {
            failed++;
            console.error(`[bet-reminders] error on row ${r.id}:`, err.message);
        }
    }

    console.log(`[bet-reminders] processed=${res.rows.length} sent=${sent} failed=${failed}`);
    return { processed: res.rows.length, sent, failed };
}

module.exports = { processBetReminders };
