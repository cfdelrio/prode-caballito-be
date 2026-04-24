"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const scoring_1 = require("../services/scoring");
const email_1 = require("../services/email");
const { sendWhatsAppTemplate } = require("../services/whatsapp");
const { pushToUser, pushToAll } = require("../services/push");
const tournamentRanking_1 = require("../services/tournamentRanking");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const estado = req.query.estado;
        const planilla_id = req.query.planilla_id;
        const tournament_id = req.query.tournament_id;
        let query = `SELECT m.*, 
      p.nombre_planilla,
      u.nombre as planilla_owner_name,
      t.name as tournament_name,
      t.fase as tournament_fase
    FROM matches m
    LEFT JOIN planillas p ON m.planilla_id = p.id
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN tournaments t ON m.tournament_id = t.id`;
        const params = [];
        const conditions = [];
        if (estado) {
            conditions.push('m.estado = $' + (params.length + 1));
            params.push(estado);
        }
        if (planilla_id) {
            conditions.push('(m.planilla_id = $' + (params.length + 1) + ' OR m.planilla_id IS NULL)');
            params.push(planilla_id);
        }
        if (tournament_id) {
            conditions.push('m.tournament_id = $' + (params.length + 1));
            params.push(tournament_id);
        }
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        // Order by: unfinished matches first, then by start_time
        query += ` ORDER BY 
      CASE WHEN m.finished = false THEN 0 ELSE 1 END,
      m.start_time ASC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const result = await connection_1.db.query(query, params);
        res.json({
            success: true,
            data: {
                matches: result.rows,
                pagination: { page, limit },
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.get('/:id', validation_1.uuidParam, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await connection_1.db.query('SELECT * FROM matches WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Partido no encontrado' });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.post('/', auth_1.authMiddleware, auth_1.requireAdmin, validation_1.matchValidation, async (req, res) => {
    try {
        const { home_team, away_team, home_team_pt, away_team_pt, start_time, halftime_minutes, time_cutoff, planilla_id, tournament_id, sede, grupo, jornada } = req.body;
        const cutoffTime = time_cutoff || new Date(new Date(start_time).getTime() - 30 * 60 * 1000);
        const result = await connection_1.db.query(`INSERT INTO matches (home_team, away_team, home_team_pt, away_team_pt, start_time, halftime_minutes, time_cutoff, planilla_id, tournament_id, sede, grupo, jornada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`, [home_team, away_team, home_team_pt || null, away_team_pt || null, start_time, halftime_minutes || 15, cutoffTime, planilla_id || null, tournament_id || null, sede || null, grupo || null, jornada || null]);
        await connection_1.db.query(`INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value, ip_address, user_agent) 
       VALUES ($1, 'match_create', 'matches', $2, $3, $4, $5)`, [req.user.userId, result.rows[0].id, JSON.stringify(req.body), req.ip, req.headers['user-agent']]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        console.error('Create match error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.put('/:id', auth_1.authMiddleware, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { home_team, away_team, home_team_pt, away_team_pt, start_time, halftime_minutes, time_cutoff, estado, finished, tournament_id, sede, grupo, jornada } = req.body;
        const oldResult = await connection_1.db.query('SELECT * FROM matches WHERE id = $1', [id]);
        if (oldResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Partido no encontrado' });
        }
        const result = await connection_1.db.query(`UPDATE matches SET
        home_team = COALESCE($1, home_team),
        away_team = COALESCE($2, away_team),
        home_team_pt = COALESCE($3, home_team_pt),
        away_team_pt = COALESCE($4, away_team_pt),
        start_time = COALESCE($5, start_time),
        halftime_minutes = COALESCE($6, halftime_minutes),
        time_cutoff = COALESCE($7, time_cutoff),
        estado = COALESCE($8, estado),
        finished = COALESCE($9, finished),
        tournament_id = COALESCE($10, tournament_id),
        sede = COALESCE($11, sede),
        grupo = COALESCE($12, grupo),
        jornada = COALESCE($13, jornada)
       WHERE id = $14
       RETURNING *`, [home_team, away_team, home_team_pt, away_team_pt, start_time, halftime_minutes, time_cutoff, estado, finished, tournament_id, sede, grupo, jornada, id]);
        await connection_1.db.query(`INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent) 
       VALUES ($1, 'match_update', 'matches', $2, $3, $4, $5, $6)`, [req.user.userId, id, JSON.stringify(oldResult.rows[0]), JSON.stringify(result.rows[0]), req.ip, req.headers['user-agent']]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.post('/:matchId/result', auth_1.authMiddleware, auth_1.requireAdmin, validation_1.matchResultValidation, async (req, res) => {
    try {
        const { matchId } = req.params;
        const { resultado_local, resultado_visitante } = req.body;
        const matchResult = await connection_1.db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
        if (matchResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Partido no encontrado' });
        }
        const match = matchResult.rows[0];

        // Guardar líder anterior antes de recalcular
        const prevLeaderResult = await connection_1.db.query(
            `SELECT p.user_id, u.nombre, u.whatsapp_number, u.whatsapp_consent
             FROM ranking r
             JOIN planillas p ON r.planilla_id = p.id
             JOIN users u ON p.user_id = u.id
             WHERE r.position = 1 LIMIT 1`
        );
        const prevLeader = prevLeaderResult.rows[0] || null;

        await connection_1.db.query(`UPDATE matches SET
        resultado_local = $1,
        resultado_visitante = $2,
        estado = 'finished',
        finished = true
       WHERE id = $3`, [resultado_local, resultado_visitante, matchId]);
        const betsResult = await connection_1.db.query('SELECT * FROM bets WHERE match_id = $1', [matchId]);
        for (const bet of betsResult.rows) {
            const score = (0, scoring_1.calcularPuntaje)({ goles_local: bet.goles_local, goles_visitante: bet.goles_visitante }, { resultado_local, resultado_visitante });
            await connection_1.db.query(`INSERT INTO scores (planilla_id, match_id, puntos_obtenidos, bonus_aplicado, detalle_json)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (planilla_id, match_id) DO UPDATE SET
           puntos_obtenidos = $3,
           bonus_aplicado = $4,
           detalle_json = $5`, [bet.planilla_id, matchId, score.puntos, score.bonus, JSON.stringify(score.detalle)]);
        }
        await connection_1.db.query(`INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value, ip_address, user_agent)
       VALUES ($1, 'result_published', 'matches', $2, $3, $4, $5)`, [req.user.userId, matchId, JSON.stringify({ resultado_local, resultado_visitante }), req.ip, req.headers['user-agent']]);
        await actualizarRanking();

        // Notificaciones post-resultado (best-effort, no bloquean la respuesta)
        setImmediate(async () => {
            try {
                // Obtener ranking actualizado para posiciones
                const rankingRows = await connection_1.db.query(
                    `SELECT p.user_id, r.position, r.puntos_totales,
                            u.email, u.nombre, u.whatsapp_number, u.whatsapp_consent
                     FROM ranking r
                     JOIN planillas p ON r.planilla_id = p.id
                     JOIN users u ON p.user_id = u.id
                     ORDER BY r.position ASC`
                );
                const rankingMap = {};
                for (const row of rankingRows.rows) rankingMap[row.user_id] = row;

                // Detectar nuevo líder
                const newLeader = rankingRows.rows[0] || null;
                if (newLeader && prevLeader && newLeader.user_id !== prevLeader.user_id) {
                    // Email al nuevo líder
                    await email_1.sendNewLeaderEmail({
                        userEmail: newLeader.email,
                        userName: newLeader.nombre,
                        puntos: newLeader.puntos_totales,
                        homeTeam: match.home_team,
                        awayTeam: match.away_team,
                        resultLocal: resultado_local,
                        resultVisitante: resultado_visitante,
                    }).catch(e => console.error('Email new leader error:', e.message));
                    // Push al nuevo líder
                    await pushToUser(newLeader.user_id, {
                        title: '🔥 ¡Sos el nuevo líder!',
                        body: `Con ${newLeader.puntos_totales} pts estás en el puesto #1 — ¡no lo sueltes!`,
                        url: '/ranking',
                        icon: '/favicon.svg',
                    }).catch(e => console.error('[push] new leader error:', e.message));
                    // WhatsApp al nuevo líder
                    if (newLeader.whatsapp_number && newLeader.whatsapp_consent) {
                        await sendWhatsAppTemplate({
                            to: newLeader.whatsapp_number,
                            templateName: 'prode_nuevo_lider',
                            variables: { '1': String(newLeader.puntos_totales) },
                        }).catch(e => console.error('WA new leader error:', e.message));
                    }
                }

                // Email + WhatsApp por resultado a cada usuario con apuesta
                for (const bet of betsResult.rows) {
                    try {
                        const score = (0, scoring_1.calcularPuntaje)(
                            { goles_local: bet.goles_local, goles_visitante: bet.goles_visitante },
                            { resultado_local, resultado_visitante }
                        );
                        // Obtener user_id desde planilla
                        const planillaRes = await connection_1.db.query(
                            'SELECT user_id FROM planillas WHERE id = $1', [bet.planilla_id]
                        );
                        if (planillaRes.rows.length === 0) continue;
                        const userId = planillaRes.rows[0].user_id;
                        const userRanking = rankingMap[userId];
                        if (!userRanking) continue;

                        // Email
                        await email_1.sendResultEmail({
                            userEmail: userRanking.email,
                            userName: userRanking.nombre,
                            homeTeam: match.home_team,
                            awayTeam: match.away_team,
                            resultLocal: resultado_local,
                            resultVisitante: resultado_visitante,
                            betLocal: bet.goles_local,
                            betVisitante: bet.goles_visitante,
                            puntos: score.puntos,
                            rankingPos: userRanking.position,
                        }).catch(e => console.error(`Result email error for ${userId}:`, e.message));

                        // WhatsApp
                        if (userRanking.whatsapp_number && userRanking.whatsapp_consent) {
                            const betLine = `🎯 Tu pronóstico: ${bet.goles_local}-${bet.goles_visitante} → +${score.puntos}pts`;
                            await sendWhatsAppTemplate({
                                to: userRanking.whatsapp_number,
                                templateName: 'prode_resultado_partido',
                                variables: {
                                    '1': match.home_team,
                                    '2': String(resultado_local),
                                    '3': String(resultado_visitante),
                                    '4': match.away_team,
                                    '5': betLine,
                                    '6': String(userRanking.position),
                                },
                            }).catch(e => console.error(`Result WA error for ${userId}:`, e.message));
                        }
                    } catch(betErr) {
                        console.error('Result notification error for bet:', betErr.message);
                    }
                }
                // Push a todos (resultado publicado)
                await pushToAll({
                    title: `⚽ ${match.home_team} ${resultado_local}–${resultado_visitante} ${match.away_team}`,
                    body: 'Resultado publicado — mirá cuántos puntos sumaste',
                    url: '/ranking',
                    icon: '/favicon.svg',
                }).catch(e => console.error('[push] broadcast error:', e.message));

                console.log(`[result-notif] match=${matchId} bets=${betsResult.rows.length}`);
            } catch(notifErr) {
                console.error('[result-notif] error:', notifErr.message);
            }
        });

        // Recalculate tournament ranking if match belongs to tournament
        if (match.tournament_id) {
            await (0, tournamentRanking_1.recalculateTournamentRanking)(match.tournament_id);
            // Recalculate matchday ranking (auto-creates matchday if needed)
            try {
                const matchdaysRoute = require('./matchdays');
                const { recalcMatchdayForMatch } = matchdaysRoute;
                if (typeof recalcMatchdayForMatch === 'function') {
                    await recalcMatchdayForMatch(match.id, match.tournament_id, new Date(match.start_time));
                }
            } catch (mdErr) {
                console.warn('Matchday recalc warning:', mdErr.message);
            }
        }
        
        res.json({
            success: true,
            message: `Resultados publicados. ${betsResult.rows.length} pronósticos calculados.`
        });
    }
    catch (error) {
        console.error('Publish result error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.delete('/:id', auth_1.authMiddleware, auth_1.requireAdmin, validation_1.uuidParam, async (req, res) => {
    try {
        const { id } = req.params;
        await connection_1.db.query('DELETE FROM scores WHERE match_id = $1', [id]);
        await connection_1.db.query('DELETE FROM bets WHERE match_id = $1', [id]);
        const result = await connection_1.db.query('DELETE FROM matches WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Partido no encontrado' });
        }
        await connection_1.db.query(`INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, user_agent)
       VALUES ($1, 'match_delete', 'matches', $2, $3, $4)`, [req.user.userId, id, req.ip, req.headers['user-agent']]);
        res.json({ success: true, message: 'Partido eliminado' });
    }
    catch (error) {
        console.error('Delete match error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
async function actualizarRanking() {
    const prevResult = await connection_1.db.query(`
    SELECT r.id, r.planilla_id, r.position, p.user_id, u.nombre, u.email
    FROM ranking r
    JOIN planillas p ON r.planilla_id = p.id
    JOIN users u ON p.user_id = u.id
  `);
    const prevRanking = new Map();
    for (const row of prevResult.rows) {
        prevRanking.set(row.planilla_id, {
            position: row.position,
            user_id: row.user_id,
            nombre: row.nombre,
            email: row.email,
        });
    }
    await connection_1.db.query(`
    INSERT INTO ranking (
      planilla_id, 
      puntos_totales, 
      exactos_count,
      aciertos_celeste,
      aciertos_rojo,
      aciertos_verde,
      aciertos_amarillo,
      updated_at
    )
    SELECT 
      p.id as planilla_id,
      COALESCE(SUM(s.puntos_obtenidos), 0) as puntos_totales,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos >= 3) as exactos_count,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos = 4) as aciertos_celeste,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos = 3) as aciertos_rojo,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos = 2) as aciertos_verde,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos = 1) as aciertos_amarillo,
      NOW() as updated_at
    FROM planillas p
    LEFT JOIN scores s ON p.id = s.planilla_id
    LEFT JOIN matches m ON s.match_id = m.id AND m.estado = 'finished'
    WHERE p.precio_pagado = true
    GROUP BY p.id
    ON CONFLICT (planilla_id) DO UPDATE SET
      puntos_totales = EXCLUDED.puntos_totales,
      exactos_count = EXCLUDED.exactos_count,
      aciertos_celeste = EXCLUDED.aciertos_celeste,
      aciertos_rojo = EXCLUDED.aciertos_rojo,
      aciertos_verde = EXCLUDED.aciertos_verde,
      aciertos_amarillo = EXCLUDED.aciertos_amarillo,
      updated_at = NOW()
  `);
    // Limpiar posiciones de planillas no pagadas
    await connection_1.db.query(`
    UPDATE ranking r 
    SET position = NULL 
    FROM planillas p 
    WHERE r.planilla_id = p.id AND p.precio_pagado = false
  `);
    // Calcular posiciones solo para planillas pagadas con criterios de desempate oficiales
    await connection_1.db.query(`
    WITH ranked AS (
      SELECT r.id, ROW_NUMBER() OVER (
        ORDER BY 
          r.puntos_totales DESC,
          r.aciertos_celeste DESC,
          r.aciertos_rojo DESC,
          r.aciertos_verde DESC,
          r.aciertos_amarillo DESC
      ) as position
      FROM ranking r
      JOIN planillas p ON r.planilla_id = p.id
      WHERE p.precio_pagado = true
    )
    UPDATE ranking r SET position = ranked.position FROM ranked WHERE r.id = ranked.id
  `);
    const newResult = await connection_1.db.query(`
    SELECT r.id, r.planilla_id, r.position, r.puntos_totales, p.user_id, u.nombre, u.email
    FROM ranking r
    JOIN planillas p ON r.planilla_id = p.id
    JOIN users u ON p.user_id = u.id
  `);
    const TEST_EMAIL = 'cfdelrio@gmail.com';
    for (const row of newResult.rows) {
        const prev = prevRanking.get(row.planilla_id);
        const prevPos = prev?.position || null;
        if (prevPos !== row.position && row.email === TEST_EMAIL) {
            try {
                await (0, email_1.sendRankingUpdateEmail)(row.email, row.nombre, row.position, prevPos, row.puntos_totales);
                console.log(`📧 Email sent to ${row.email} (position: ${row.position})`);
            }
            catch (err) {
                console.error(`Failed to send email to ${row.email}:`, err);
            }
        }
    }
}
router.post('/recalculate-ranking', async (req, res) => {
    try {
        await actualizarRanking();
        res.json({ success: true, message: 'Ranking actualizado correctamente' });
    }
    catch (error) {
        console.error('Error recalculating ranking:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar ranking' });
    }
});
exports.default = router;
//# sourceMappingURL=matches.js.map