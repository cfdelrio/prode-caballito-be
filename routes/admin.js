"use strict";
const { Router } = require("express");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const { adminTestWhatsappValidation, adminWeeklyEmailValidation, adminWinnerImageValidation, adminRecalcMatchdayValidation, adminSendWelcomeValidation, adminTriggerWinnerValidation } = require("../middleware/validation");
const { sendWhatsApp } = require("../services/whatsapp");
const { db } = require("../db/connection");
const { sendWeeklyEmail } = require("../services/email");
const { runValidation } = require("../services/scoreValidator");

const router = Router();

router.post('/test-whatsapp', authMiddleware, requireAdmin, adminTestWhatsappValidation, async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ success: false, error: 'to y message requeridos' });
        }
        await sendWhatsApp({ to, body: message });
        res.json({ success: true, message: `WhatsApp enviado a ${to}` });
    } catch (error) {
        console.error('[admin] test-whatsapp error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Weekly email batch ────────────────────────────────────────────────────────

async function sendWeeklyEmailBatch(testEmail = null) {
    const now = new Date();
    const weekDate = now.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        weekday: 'long', day: 'numeric', month: 'long',
    });
    const weekDateFormatted = weekDate.charAt(0).toUpperCase() + weekDate.slice(1);

    // Total players in ranking (paid planillas)
    const totalPlayersRes = await db.query(
        `SELECT COUNT(*) as total FROM planillas WHERE precio_pagado = true`
    );
    const totalPlayers = parseInt(totalPlayersRes.rows[0].total) || 0;

    // Minimum points of the top-5 for diferenciaPuntos calculation
    const top5Res = await db.query(`
        SELECT COALESCE(MIN(r.puntos_totales), 0) as threshold
        FROM (
            SELECT r.puntos_totales
            FROM ranking r
            JOIN planillas p ON p.id = r.planilla_id
            WHERE p.precio_pagado = true
            ORDER BY r.puntos_totales DESC
            LIMIT 5
        ) r
    `);
    const top5Threshold = parseInt(top5Res.rows[0]?.threshold) || 0;

    // Most contested match of the week (min exact predictions)
    // Points live in the `scores` table, not in `bets`
    const tightMatchRes = await db.query(`
        SELECT m.home_team, m.away_team, m.resultado_local, m.resultado_visitante,
            COUNT(*) FILTER (WHERE s.puntos_obtenidos >= 3) as exact_hits,
            COUNT(s.planilla_id) as total_bets
        FROM matches m
        JOIN scores s ON s.match_id = m.id
        WHERE m.estado = 'finalizado'
            AND m.start_time >= NOW() - INTERVAL '7 days'
        GROUP BY m.id, m.home_team, m.away_team, m.resultado_local, m.resultado_visitante
        HAVING COUNT(s.planilla_id) > 0
        ORDER BY COUNT(*) FILTER (WHERE s.puntos_obtenidos >= 3) ASC,
                 COUNT(s.planilla_id) DESC
        LIMIT 1
    `);
    const tightMatch = tightMatchRes.rows[0] || null;

    // Upcoming matches (next 3)
    const upcomingRes = await db.query(`
        SELECT home_team, away_team, start_time
        FROM matches
        WHERE estado = 'pendiente' AND time_cutoff > NOW()
        ORDER BY start_time ASC
        LIMIT 3
    `);
    const upcomingMatches = upcomingRes.rows;

    // Users with their best planilla (by points)
    const usersParams = testEmail ? [testEmail] : [];
    const usersFilter = testEmail ? 'AND u.email = $1' : '';
    const usersRes = await db.query(`
        SELECT
            u.id as user_id, u.nombre, u.email,
            p.id as planilla_id,
            p.precio_pagado,
            COALESCE(r.puntos_totales, 0) as puntos_totales
        FROM users u
        JOIN planillas p ON p.user_id = u.id
        LEFT JOIN ranking r ON r.planilla_id = p.id
        WHERE u.email_verified = true ${usersFilter}
        ORDER BY u.id, COALESCE(r.puntos_totales, 0) DESC
    `, usersParams);

    // One row per user (best planilla)
    const userMap = new Map();
    for (const row of usersRes.rows) {
        if (!userMap.has(row.user_id)) userMap.set(row.user_id, row);
    }

    const appUrl = 'https://prodecaballito.com/apuestas';
    const unsubscribeUrl = 'https://prodecaballito.com';
    let sent = 0, failed = 0;

    for (const [, userData] of userMap) {
        try {
            // Position among paid planillas
            const posRes = await db.query(`
                SELECT COUNT(*) + 1 as position
                FROM ranking r2
                JOIN planillas p2 ON p2.id = r2.planilla_id
                WHERE p2.precio_pagado = true
                    AND r2.puntos_totales > $1
            `, [userData.puntos_totales]);
            const userPosition = parseInt(posRes.rows[0].position) || 1;

            // Best round by points for this planilla (scores table has the points)
            const bestRoundRes = await db.query(`
                SELECT m.jornada, SUM(s.puntos_obtenidos) as pts
                FROM bets b
                JOIN matches m ON b.match_id = m.id
                JOIN scores s ON s.planilla_id = b.planilla_id AND s.match_id = b.match_id
                WHERE b.planilla_id = $1
                    AND s.puntos_obtenidos IS NOT NULL
                    AND m.jornada IS NOT NULL
                GROUP BY m.jornada
                ORDER BY pts DESC
                LIMIT 1
            `, [userData.planilla_id]);
            const bestRound = bestRoundRes.rows[0];

            // Pending bets: upcoming matches this planilla hasn't bet on yet
            const pendingBetsRes = await db.query(`
                SELECT COUNT(*) as pending
                FROM matches m
                WHERE m.estado = 'pendiente'
                  AND m.time_cutoff > NOW()
                  AND NOT EXISTS (
                    SELECT 1 FROM bets b
                    WHERE b.match_id = m.id AND b.planilla_id = $1
                  )
            `, [userData.planilla_id]);
            const pendingBets = parseInt(pendingBetsRes.rows[0]?.pending) || 0;
            const diferenciaPuntos = Math.max(0, top5Threshold - userData.puntos_totales);

            await sendWeeklyEmail(userData.email, {
                userName: userData.nombre,
                weekDate: weekDateFormatted,
                userPosition,
                totalPlayers,
                userPoints: userData.puntos_totales,
                bestRound: bestRound ? `Fecha ${bestRound.jornada}` : '—',
                bestRoundPoints: bestRound ? parseInt(bestRound.pts) : 0,
                diferenciaPuntos,
                pendingBets,
                tightMatch,
                upcomingMatches,
                appUrl,
                unsubscribeUrl,
            });
            sent++;
        } catch (err) {
            console.error(`[weekly-email] Error sending to ${userData.email}:`, err.message);
            failed++;
        }
    }

    return { sent, failed, total: userMap.size };
}

// POST /api/admin/weekly-email
// Body opcional: { test_email: "..." } → envía solo a ese email (preview)
router.post('/weekly-email', authMiddleware, requireAdmin, adminWeeklyEmailValidation, async (req, res) => {
    try {
        const testEmail = req.body.test_email || null;
        console.log(`[weekly-email] Starting batch${testEmail ? ` (test: ${testEmail})` : ''}`);
        const result = await sendWeeklyEmailBatch(testEmail);
        console.log(`[weekly-email] Done: sent=${result.sent} failed=${result.failed} total=${result.total}`);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[weekly-email] Batch error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/admin/winner-image
// Body: { image_url: "...", matchday_label: "Fecha 3" }
router.post('/winner-image', authMiddleware, requireAdmin, adminWinnerImageValidation, async (req, res) => {
    try {
        const { image_url, matchday_label } = req.body;
        if (!image_url) return res.status(400).json({ success: false, error: 'image_url requerida' });
        const entry = { image_url, matchday_label, updated_at: new Date().toISOString() };

        // Upsert single latest winner
        await db.query(`
            INSERT INTO config (key, value, updated_at, updated_by)
            VALUES ($1, $2, NOW(), $3)
            ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3
        `, ['ganador_fecha', JSON.stringify(entry), req.user.userId]);

        // Append to winners array
        const existingRes = await db.query(`SELECT value FROM config WHERE key = 'ganadores_fechas'`);
        let winners = [];
        if (existingRes.rows.length > 0) {
            try { winners = JSON.parse(existingRes.rows[0].value) } catch {}
        }
        winners.push(entry);
        await db.query(`
            INSERT INTO config (key, value, updated_at, updated_by)
            VALUES ('ganadores_fechas', $1, NOW(), $2)
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = $2
        `, [JSON.stringify(winners), req.user.userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('[winner-image] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── JOBS — panel de procesos manuales ───────────────────────────────────────

router.post('/jobs/recalculate-ranking', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { actualizarRanking } = require('./matches');
        await actualizarRanking();
        res.json({ success: true, message: 'Ranking recalculado correctamente' });
    } catch (error) {
        console.error('[jobs/recalculate-ranking]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/jobs/recalc-matchday', authMiddleware, requireAdmin, adminRecalcMatchdayValidation, async (req, res) => {
    try {
        const { matchday_id } = req.body;
        if (!matchday_id) return res.status(400).json({ success: false, error: 'matchday_id requerido' });
        const { recalcMatchday } = require('./matchdays');
        const result = await recalcMatchday(matchday_id);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[jobs/recalc-matchday]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/jobs/send-welcome', authMiddleware, requireAdmin, adminSendWelcomeValidation, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, error: 'email requerido' });
        const { sendWelcomeEmail } = require('../services/email');
        const userRes = await db.query(`SELECT nombre FROM users WHERE email = $1`, [email]);
        if (userRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        await sendWelcomeEmail(email, userRes.rows[0].nombre);
        res.json({ success: true });
    } catch (error) {
        console.error('[jobs/send-welcome]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/jobs/trigger-winner', authMiddleware, requireAdmin, adminTriggerWinnerValidation, async (req, res) => {
    try {
        const { email, matchday_id, matchday_name, points } = req.body;
        if (!email) return res.status(400).json({ success: false, error: 'email requerido' });
        const userRes = await db.query(
            `SELECT id, nombre, foto_url, email FROM users WHERE email = $1`, [email]
        );
        if (userRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        const user = userRes.rows[0];
        const allEmailsRes = await db.query(`SELECT email FROM users WHERE email IS NOT NULL`);
        const allEmails = allEmailsRes.rows.map(r => r.email);
        const winner = { user_id: user.id, user_name: user.nombre, user_avatar: user.foto_url || null, points: points || 42 };
        const matchday = { id: matchday_id || '00000000-0000-0000-0000-000000000001', name: matchday_name || 'Fecha de Prueba', tournament_id: null };
        const { processWinnerNotification } = require('./matchdays');
        await processWinnerNotification(winner, matchday, user.email, allEmails);
        res.json({ success: true, message: `Ganador procesado: ${user.nombre}` });
    } catch (error) {
        console.error('[jobs/trigger-winner]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Score integrity validation ────────────────────────────────────────────────

router.get('/validate-scores', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { tournament_id } = req.query;

        const matchFilter = tournament_id
            ? `WHERE m.estado = 'finished' AND m.tournament_id = $1`
            : `WHERE m.estado = 'finished'`;
        const matchParams = tournament_id ? [tournament_id] : [];

        const matchesRes = await db.query(
            `SELECT id, resultado_local, resultado_visitante FROM matches ${matchFilter}`,
            matchParams
        );
        const finishedMatches = matchesRes.rows;

        if (finishedMatches.length === 0) {
            return res.json({
                success: true,
                data: {
                    scoreErrors: [], missingScores: [], rankingErrors: [],
                    summary: {
                        checked_matches: 0, checked_bets: 0, checked_rankings: 0,
                        score_errors: 0, missing_scores: 0, ranking_errors: 0, valid: true,
                    },
                },
            });
        }

        const matchIds = finishedMatches.map(m => m.id);
        const placeholders = matchIds.map((_, i) => `$${i + 1}`).join(',');

        const [betsRes, scoresRes, rankingsRes] = await Promise.all([
            db.query(
                `SELECT planilla_id, match_id, goles_local, goles_visitante FROM bets WHERE match_id IN (${placeholders})`,
                matchIds
            ),
            db.query(
                `SELECT planilla_id, match_id, puntos_obtenidos, bonus_aplicado FROM scores WHERE match_id IN (${placeholders})`,
                matchIds
            ),
            db.query(
                `SELECT r.planilla_id, r.puntos_totales, r.position,
                        r.aciertos_celeste, r.aciertos_rojo, r.aciertos_verde, r.aciertos_amarillo
                 FROM ranking r
                 JOIN planillas p ON p.id = r.planilla_id
                 WHERE p.precio_pagado = true`
            ),
        ]);

        const result = runValidation(finishedMatches, betsRes.rows, scoresRes.rows, rankingsRes.rows);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[admin/validate-scores]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
module.exports.sendWeeklyEmailBatch = sendWeeklyEmailBatch;
