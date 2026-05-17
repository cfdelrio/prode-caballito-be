"use strict";

const { db } = require('../db/connection');
const { pushToUser } = require('./push');
const { sendSMS } = require('./whatsapp');

const REMINDER_TYPE = 'cutoff_30min';
const DEFAULT_CUTOFF_MINUTES = 5; // minutes before first match that bets lock

/**
 * Returns the cutoff_minutes for a tournament (from config or default).
 */
async function getTournamentCutoffMinutes(tournamentId) {
    const c = await db.query(
        `SELECT value FROM config WHERE key = $1`,
        [`tournament_cutoff_minutes_${tournamentId}`]
    );
    if (c.rows.length === 0) return DEFAULT_CUTOFF_MINUTES;
    const v = c.rows[0].value;
    let parsed = v;
    if (typeof v === 'string') {
        try { parsed = JSON.parse(v); } catch { parsed = v; }
    }
    const n = Number(parsed);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_CUTOFF_MINUTES;
}

function buildPayload({ pending, tournamentName, firstMatch }) {
    const title = '⏰ Cierra el torneo en ~30 min';
    if (pending === 1 && firstMatch) {
        return {
            title,
            body: `${firstMatch.home_team} vs ${firstMatch.away_team} — todavía no pronosticaste`,
            url: '/apuestas',
            icon: '/favicon.svg',
        };
    }
    return {
        title,
        body: tournamentName
            ? `${tournamentName}: te faltan ${pending} pronóstico${pending === 1 ? '' : 's'}`
            : `Te faltan ${pending} pronóstico${pending === 1 ? '' : 's'} — entrá antes del cierre`,
        url: '/apuestas',
        icon: '/favicon.svg',
    };
}

/**
 * Notify users with pending bets before the tournament-level cutoff fires.
 *
 * Logic:
 *   - For each active tournament, cutoff = MIN(start_time of scheduled matches) - cutoff_minutes.
 *   - If that cutoff falls in (NOW+20min, NOW+40min), notify each user with at least
 *     one planilla in the tournament that has missing bets.
 *   - For standalone matches (no tournament_id), use per-match time_cutoff.
 *
 * Idempotent: uses reminder_sent (user_id, match_id, reminder_type). For tournament
 * reminders the key match_id is the first scheduled match of the tournament.
 */
async function runCutoffReminders() {
    // ── Tournament-level reminders ───────────────────────────────────────────
    const tournamentsRes = await db.query(`
        SELECT t.id AS tournament_id, t.name AS tournament_name,
               MIN(m.start_time) AS first_match_start,
               (ARRAY_AGG(m.id ORDER BY m.start_time ASC))[1] AS first_match_id,
               (ARRAY_AGG(m.home_team ORDER BY m.start_time ASC))[1] AS first_home,
               (ARRAY_AGG(m.away_team ORDER BY m.start_time ASC))[1] AS first_away
        FROM matches m
        JOIN tournaments t ON t.id = m.tournament_id
        WHERE m.estado = 'scheduled' AND m.tournament_id IS NOT NULL
        GROUP BY t.id, t.name
    `);

    let notified = 0;
    let skipped = 0;
    let tournamentsInWindow = 0;

    for (const t of tournamentsRes.rows) {
        const minutes = await getTournamentCutoffMinutes(t.tournament_id);
        const cutoffMs = new Date(t.first_match_start).getTime() - minutes * 60 * 1000;
        const now = Date.now();
        const minMs = now + 20 * 60 * 1000;
        const maxMs = now + 40 * 60 * 1000;
        if (cutoffMs < minMs || cutoffMs > maxMs) continue;
        tournamentsInWindow++;

        // Users with a planilla in this tournament who have at least one missing bet
        const missingRes = await db.query(`
            SELECT p.user_id,
                   COUNT(*) FILTER (WHERE b.id IS NULL) AS missing_count
            FROM planilla_tournaments pt
            JOIN planillas p ON p.id = pt.planilla_id
            JOIN matches m ON m.tournament_id = pt.tournament_id AND m.estado = 'scheduled'
            LEFT JOIN bets b ON b.planilla_id = p.id AND b.match_id = m.id
            WHERE pt.tournament_id = $1
            GROUP BY p.user_id
            HAVING COUNT(*) FILTER (WHERE b.id IS NULL) > 0
        `, [t.tournament_id]);

        for (const row of missingRes.rows) {
            const insertRes = await db.query(
                `INSERT INTO reminder_sent (user_id, match_id, reminder_type)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, match_id, reminder_type) DO NOTHING
                 RETURNING match_id`,
                [row.user_id, t.first_match_id, REMINDER_TYPE]
            );
            if (insertRes.rows.length === 0) { skipped++; continue; }

            const pending = Number(row.missing_count);
            const firstMatch = { home_team: t.first_home, away_team: t.first_away };
            const payload = buildPayload({ pending, tournamentName: t.tournament_name, firstMatch });

            await pushToUser(row.user_id, payload).catch(err =>
                console.error(`[cutoff-reminder] push failed user=${row.user_id}:`, err.message)
            );

            const userRes = await db.query(
                `SELECT whatsapp_number, whatsapp_consent FROM users WHERE id = $1`,
                [row.user_id]
            );
            if (userRes.rows.length > 0) {
                const { whatsapp_number, whatsapp_consent } = userRes.rows[0];
                if (whatsapp_number && whatsapp_consent) {
                    const smsBody = pending === 1
                        ? `⏰ ${t.tournament_name}: te falta 1 pronóstico — cargalo antes del cierre 👉 prodecaballito.com/apuestas`
                        : `⏰ ${t.tournament_name}: te faltan ${pending} pronósticos — cargalos antes del cierre 👉 prodecaballito.com/apuestas`;
                    await sendSMS({ to: whatsapp_number, body: smsBody })
                        .catch(err => console.error(`[cutoff-reminder] sms failed user=${row.user_id}:`, err.message));
                }
            }
            notified++;
        }
    }

    // ── Standalone matches (no tournament_id) ─────────────────────────────────
    const standaloneRes = await db.query(`
        SELECT id, home_team, away_team, time_cutoff
        FROM matches
        WHERE estado = 'scheduled'
          AND tournament_id IS NULL
          AND time_cutoff IS NOT NULL
          AND time_cutoff BETWEEN NOW() + INTERVAL '20 minutes'
                              AND NOW() + INTERVAL '40 minutes'
    `);

    for (const match of standaloneRes.rows) {
        const missingRes = await db.query(`
            SELECT p.user_id
            FROM planillas p
            LEFT JOIN bets b ON b.planilla_id = p.id AND b.match_id = $1
            WHERE b.id IS NULL
            GROUP BY p.user_id
        `, [match.id]);

        for (const row of missingRes.rows) {
            const insertRes = await db.query(
                `INSERT INTO reminder_sent (user_id, match_id, reminder_type)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, match_id, reminder_type) DO NOTHING
                 RETURNING match_id`,
                [row.user_id, match.id, REMINDER_TYPE]
            );
            if (insertRes.rows.length === 0) { skipped++; continue; }

            const payload = buildPayload({ pending: 1, tournamentName: null, firstMatch: match });
            await pushToUser(row.user_id, payload).catch(err =>
                console.error(`[cutoff-reminder] push failed user=${row.user_id}:`, err.message)
            );

            const userRes = await db.query(
                `SELECT whatsapp_number, whatsapp_consent FROM users WHERE id = $1`,
                [row.user_id]
            );
            if (userRes.rows.length > 0) {
                const { whatsapp_number, whatsapp_consent } = userRes.rows[0];
                if (whatsapp_number && whatsapp_consent) {
                    const smsBody = `⏰ ${match.home_team} vs ${match.away_team} cierra en 30 min — aún no pronosticaste 👉 prodecaballito.com/apuestas`;
                    await sendSMS({ to: whatsapp_number, body: smsBody })
                        .catch(err => console.error(`[cutoff-reminder] sms failed user=${row.user_id}:`, err.message));
                }
            }
            notified++;
        }
    }

    console.log(`[cutoff-reminder] tournaments_in_window=${tournamentsInWindow} standalone=${standaloneRes.rows.length} notified=${notified} skipped=${skipped}`);
    return {
        tournaments_in_window: tournamentsInWindow,
        standalone_matches: standaloneRes.rows.length,
        users_notified: notified,
        skipped,
    };
}

module.exports = { runCutoffReminders, getTournamentCutoffMinutes, buildPayload, REMINDER_TYPE, DEFAULT_CUTOFF_MINUTES };
