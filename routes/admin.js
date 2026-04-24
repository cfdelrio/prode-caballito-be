"use strict";
const { Router } = require("express");
const { authMiddleware, requireAdmin } = require("../middleware/auth");
const { sendWhatsApp } = require("../services/whatsapp");
const { db } = require("../db/connection");
const { sendWeeklyEmail } = require("../services/email");

const router = Router();

router.post('/test-whatsapp', authMiddleware, requireAdmin, async (req, res) => {
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

    // Most contested match of the week (min exact predictions)
    const tightMatchRes = await db.query(`
        SELECT m.home_team, m.away_team, m.resultado_local, m.resultado_visitante,
            COUNT(*) FILTER (WHERE b.puntos_obtenidos >= 3) as exact_hits,
            COUNT(b.id) as total_bets
        FROM matches m
        JOIN bets b ON b.match_id = m.id
        WHERE m.estado = 'finalizado'
            AND m.start_time >= NOW() - INTERVAL '7 days'
        GROUP BY m.id, m.home_team, m.away_team, m.resultado_local, m.resultado_visitante
        HAVING COUNT(b.id) > 0
        ORDER BY COUNT(*) FILTER (WHERE b.puntos_obtenidos >= 3) ASC,
                 COUNT(b.id) DESC
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

            // Best round by points for this planilla
            const bestRoundRes = await db.query(`
                SELECT m.jornada, SUM(b.puntos_obtenidos) as pts
                FROM bets b
                JOIN matches m ON b.match_id = m.id
                WHERE b.planilla_id = $1
                    AND b.puntos_obtenidos IS NOT NULL
                    AND m.jornada IS NOT NULL
                GROUP BY m.jornada
                ORDER BY pts DESC
                LIMIT 1
            `, [userData.planilla_id]);
            const bestRound = bestRoundRes.rows[0];

            await sendWeeklyEmail(userData.email, {
                userName: userData.nombre,
                weekDate: weekDateFormatted,
                userPosition,
                totalPlayers,
                userPoints: userData.puntos_totales,
                bestRound: bestRound ? `Fecha ${bestRound.jornada}` : '—',
                bestRoundPoints: bestRound ? parseInt(bestRound.pts) : 0,
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
router.post('/weekly-email', authMiddleware, requireAdmin, async (req, res) => {
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

module.exports = router;
module.exports.sendWeeklyEmailBatch = sendWeeklyEmailBatch;
