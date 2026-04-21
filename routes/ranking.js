"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();

// ── planilla_favorites: tabla N:N user ↔ planilla ────────────────────────────
let _favTableEnsured = false;
async function ensureFavoritesTable() {
    if (_favTableEnsured) return;
    await connection_1.db.query(`
        CREATE TABLE IF NOT EXISTS planilla_favorites (
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            planilla_id UUID NOT NULL REFERENCES planillas(id) ON DELETE CASCADE,
            created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, planilla_id)
        )
    `);
    _favTableEnsured = true;
}

// GET /ranking/favorites — devuelve los planilla_ids que el usuario sigue
router.get('/favorites', auth_1.authMiddleware, async (req, res) => {
    try {
        await ensureFavoritesTable();
        const result = await connection_1.db.query(
            'SELECT planilla_id FROM planilla_favorites WHERE user_id = $1',
            [req.user.userId]
        );
        res.json({ success: true, data: result.rows.map(r => r.planilla_id) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// POST /ranking/favorites/:planillaId — toggle favorite (add/remove)
router.post('/favorites/:planillaId', auth_1.authMiddleware, async (req, res) => {
    try {
        await ensureFavoritesTable();
        const { planillaId } = req.params;
        const existing = await connection_1.db.query(
            'SELECT 1 FROM planilla_favorites WHERE user_id = $1 AND planilla_id = $2',
            [req.user.userId, planillaId]
        );
        if (existing.rows.length > 0) {
            await connection_1.db.query(
                'DELETE FROM planilla_favorites WHERE user_id = $1 AND planilla_id = $2',
                [req.user.userId, planillaId]
            );
            res.json({ success: true, action: 'removed' });
        } else {
            await connection_1.db.query(
                'INSERT INTO planilla_favorites (user_id, planilla_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [req.user.userId, planillaId]
            );
            res.json({ success: true, action: 'added' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        // include_unpaid defaults to true so all tarjetas appear in the ranking
        const paidOnly = req.query.paid_only === 'true';
        const paidClause = paidOnly ? ' AND p.precio_pagado = true' : '';
        const result = await connection_1.db.query(`
      SELECT
        COALESCE(r.puntos_totales, 0) as puntos_totales,
        COALESCE(r.exactos_count, 0) as exactos_count,
        COALESCE(r.aciertos_celeste, 0) as aciertos_celeste,
        COALESCE(r.aciertos_rojo, 0) as aciertos_rojo,
        COALESCE(r.aciertos_verde, 0) as aciertos_verde,
        COALESCE(r.aciertos_amarillo, 0) as aciertos_amarillo,
        u.id as user_id,
        u.nombre as user_name,
        u.foto_url as user_avatar,
        CASE WHEN u.whatsapp_consent = true THEN u.whatsapp_number ELSE NULL END as whatsapp_number,
        p.nombre_planilla,
        p.precio_pagado,
        p.id as planilla_id,
        r.position as official_position,
        ROW_NUMBER() OVER (
          ORDER BY
            COALESCE(r.puntos_totales, 0) DESC,
            COALESCE(r.aciertos_celeste, 0) DESC,
            COALESCE(r.aciertos_rojo, 0) DESC,
            COALESCE(r.aciertos_verde, 0) DESC,
            COALESCE(r.aciertos_amarillo, 0) DESC
        ) as virtual_position
      FROM planillas p
      LEFT JOIN ranking r ON r.planilla_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE 1=1 ${paidClause}
      ORDER BY
        COALESCE(r.puntos_totales, 0) DESC,
        COALESCE(r.aciertos_celeste, 0) DESC,
        COALESCE(r.aciertos_rojo, 0) DESC,
        COALESCE(r.aciertos_verde, 0) DESC,
        COALESCE(r.aciertos_amarillo, 0) DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
        const countResult = await connection_1.db.query(`
      SELECT COUNT(*) FROM planillas p
      LEFT JOIN ranking r ON r.planilla_id = p.id
      WHERE 1=1 ${paidClause}
    `);
        // Mapear los resultados para usar position correcta
        const mappedRanking = result.rows.map(row => ({
            ...row,
            position: row.official_position || row.virtual_position,
            is_virtual: !row.precio_pagado
        }));
        res.json({
            success: true,
            data: {
                ranking: mappedRanking,
                currentUser: req.user ? {
                    position: await getUserPosition(req.user.userId),
                } : null,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0].count),
                    pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
                },
            },
        });
    }
    catch (error) {
        console.error('Get ranking error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.get('/:planillaId', async (req, res) => {
    try {
        const { planillaId } = req.params;
        const result = await connection_1.db.query(`
      SELECT 
        r.*,
        u.id as user_id,
        u.nombre as user_name,
        u.foto_url as user_avatar,
        p.nombre_planilla
      FROM ranking r
      JOIN planillas p ON r.planilla_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE r.planilla_id = $1
    `, [planillaId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Planilla no encontrada en ranking' });
        }
        const ranking = result.rows[0];
        const positionResult = await connection_1.db.query(`
      SELECT COUNT(*) + 1 as position
      FROM ranking r
      JOIN planillas p ON r.planilla_id = p.id
      WHERE p.precio_pagado = true AND r.puntos_totales > $1
    `, [ranking.puntos_totales]);
        ranking.position = parseInt(positionResult.rows[0].position);
        res.json({ success: true, data: ranking });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.get('/user/me', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await connection_1.db.query(`
      SELECT 
        r.*,
        p.id as planilla_id,
        p.nombre_planilla
      FROM ranking r
      JOIN planillas p ON r.planilla_id = p.id
      WHERE p.user_id = $1 AND p.precio_pagado = true
      ORDER BY r.puntos_totales DESC
      LIMIT 10
    `, [userId]);
        const ranking = result.rows.map((row, index) => ({
            ...row,
            position: index + 1,
        }));
        res.json({ success: true, data: ranking });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.get('/export/csv', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await connection_1.db.query(`
      SELECT 
        u.nombre as usuario,
        p.nombre_planilla,
        r.puntos_totales,
        r.exactos_count,
        r.goles_favor,
        r.goles_contra
      FROM ranking r
      JOIN planillas p ON r.planilla_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE p.precio_pagado = true
      ORDER BY r.puntos_totales DESC
    `);
        const headers = ['Usuario', 'Planilla', 'Puntos', 'Exactos', 'GF', 'GC'];
        const csv = [
            headers.join(','),
            ...result.rows.map(row => [
                row.usuario,
                row.nombre_planilla,
                row.puntos_totales,
                row.exactos_count,
                row.goles_favor,
                row.goles_contra,
            ].join(','))
        ].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=ranking.csv');
        res.send(csv);
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.get('/export/json', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await connection_1.db.query(`
      SELECT 
        u.id as user_id,
        u.nombre as usuario,
        p.id as planilla_id,
        p.nombre_planilla,
        r.puntos_totales,
        r.exactos_count,
        r.goles_favor,
        r.goles_contra
      FROM ranking r
      JOIN planillas p ON r.planilla_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE p.precio_pagado = true
      ORDER BY r.puntos_totales DESC
    `);
        res.json({
            success: true,
            data: result.rows,
            exported_at: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
async function getUserPosition(userId) {
    try {
        const result = await connection_1.db.query(`
      SELECT r.position FROM (
        SELECT 
          p.user_id,
          ROW_NUMBER() OVER (ORDER BY r.puntos_totales DESC) as position
        FROM ranking r
        JOIN planillas p ON r.planilla_id = p.id
        WHERE p.precio_pagado = true
      ) r
      WHERE r.user_id = $1
    `, [userId]);
        return result.rows.length > 0 ? result.rows[0].position : null;
    }
    catch {
        return null;
    }
}
exports.default = router;
// Tournament-specific ranking endpoints
router.get('/tournament/:tournamentId', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const result = await connection_1.db.query(`
      SELECT 
        tr.puntos,
        tr.total_aciertos,
        tr.total_exactos,
        tr.posicion,
        u.id as user_id,
        u.nombre as user_name,
        u.foto_url as user_avatar,
        ROW_NUMBER() OVER (ORDER BY tr.puntos DESC, tr.total_exactos DESC) as position
      FROM tournament_rankings tr
      JOIN users u ON tr.user_id = u.id
      WHERE tr.tournament_id = $1
      ORDER BY tr.puntos DESC, tr.total_exactos DESC
      LIMIT $2 OFFSET $3
    `, [tournamentId, limit, offset]);
        const countResult = await connection_1.db.query(`
      SELECT COUNT(*) as total FROM tournament_rankings WHERE tournament_id = $1
    `, [tournamentId]);
        res.json({
            success: true,
            data: {
                ranking: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
                },
            },
        });
    }
    catch (error) {
        console.error('Get tournament ranking error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.get('/tournament/:tournamentId/user/me', auth_1.authMiddleware, async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const userId = req.user.userId;
        const result = await connection_1.db.query(`
      SELECT 
        tr.*,
        u.nombre as user_name,
        ROW_NUMBER() OVER (ORDER BY tr.puntos DESC, tr.total_exactos DESC) as position
      FROM tournament_rankings tr
      JOIN users u ON tr.user_id = u.id
      WHERE tr.tournament_id = $1 AND tr.user_id = $2
    `, [tournamentId, userId]);
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'No tienes apuestas en este torneo aún',
            });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
router.get('/tournament/:tournamentId/standings', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const result = await connection_1.db.query(`
      SELECT 
        tr.posicion,
        tr.puntos,
        tr.total_aciertos,
        tr.total_exactos,
        u.id as user_id,
        u.nombre as user_name,
        u.foto_url as user_avatar
      FROM tournament_rankings tr
      JOIN users u ON tr.user_id = u.id
      WHERE tr.tournament_id = $1 AND tr.posicion IS NOT NULL
      ORDER BY tr.posicion ASC
      LIMIT 100
    `, [tournamentId]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
//# sourceMappingURL=ranking.js.map