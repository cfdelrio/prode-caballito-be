"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const auth_1 = require("../middleware/auth");
const cache = require("../services/cache");
const router = (0, express_1.Router)();

async function ensureTeamBadgesTable() {
    await connection_1.db.query(`
        CREATE TABLE IF NOT EXISTS team_badges (
            team_name VARCHAR(100) PRIMARY KEY,
            badge_url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);
}

// GET /teams/badges — público, retorna { team_name: badge_url }
router.get('/badges', async (req, res) => {
    try {
        const badges = await cache.getOrFetch('team_badges', async () => {
            await ensureTeamBadgesTable();
            const result = await connection_1.db.query('SELECT team_name, badge_url FROM team_badges ORDER BY team_name');
            const map = {};
            result.rows.forEach(r => { map[r.team_name] = r.badge_url; });
            return map;
        });
        res.json({ success: true, data: badges });
    } catch (error) {
        console.error('Get badges error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// POST /teams/badges — admin, crea o actualiza escudo
router.post('/badges', auth_1.authMiddleware, async (req, res) => {
    try {
        if (req.user.rol !== 'admin') {
            return res.status(403).json({ success: false, error: 'Solo administradores' });
        }
        const { team_name, badge_url } = req.body;
        if (!team_name || !badge_url) {
            return res.status(400).json({ success: false, error: 'team_name y badge_url son requeridos' });
        }
        await ensureTeamBadgesTable();
        await connection_1.db.query(`
            INSERT INTO team_badges (team_name, badge_url, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (team_name) DO UPDATE SET badge_url = $2, updated_at = NOW()
        `, [team_name.trim(), badge_url.trim()]);
        cache.invalidate('team_badges');
        res.json({ success: true, message: 'Escudo guardado' });
    } catch (error) {
        console.error('Save badge error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// DELETE /teams/badges/:team_name — admin, elimina escudo
router.delete('/badges/:team_name', auth_1.authMiddleware, async (req, res) => {
    try {
        if (req.user.rol !== 'admin') {
            return res.status(403).json({ success: false, error: 'Solo administradores' });
        }
        await connection_1.db.query('DELETE FROM team_badges WHERE team_name = $1', [req.params.team_name]);
        cache.invalidate('team_badges');
        res.json({ success: true, message: 'Escudo eliminado' });
    } catch (error) {
        console.error('Delete badge error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

exports.default = router;
