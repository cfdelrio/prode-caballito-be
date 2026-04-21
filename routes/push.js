"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const auth_1 = require("../middleware/auth");

const router = (0, express_1.Router)();

// Public — frontend needs this before subscribing
router.get('/vapid-public-key', (req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY ||
        'BAXBLdwtMlYJnlIWkjPlOFMgvdjeVYy6Bk-ARQ_5_YRHLtaaflqHnTB9yP6Dr2iABVLroBs_lZL4uTS8ju00Flk';
    res.json({ success: true, data: key });
});

// Save browser push subscription for the authenticated user
router.post('/subscribe', auth_1.authMiddleware, async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ success: false, error: 'endpoint y keys (p256dh, auth) requeridos' });
        }
        await connection_1.db.query(
            'DELETE FROM push_subscriptions WHERE endpoint = $1',
            [endpoint]
        );
        await connection_1.db.query(
            'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)',
            [req.user.userId, endpoint, keys.p256dh, keys.auth]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Push subscribe error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Remove push subscription (user can only delete their own)
router.delete('/unsubscribe', auth_1.authMiddleware, async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ success: false, error: 'endpoint requerido' });
        }
        await connection_1.db.query(
            'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
            [endpoint, req.user.userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Push unsubscribe error:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// List push subscriptions for the authenticated user (debug)
router.get('/my-subscriptions', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await connection_1.db.query(
            'SELECT id, endpoint, created_at FROM push_subscriptions WHERE user_id = $1',
            [req.user.userId]
        );
        res.json({ success: true, data: { count: result.rows.length, subscriptions: result.rows } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send a test push to the authenticated user's own subscriptions
router.post('/test', auth_1.authMiddleware, async (req, res) => {
    try {
        const subsResult = await connection_1.db.query(
            'SELECT id FROM push_subscriptions WHERE user_id = $1',
            [req.user.userId]
        );
        if (subsResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No tenés suscripciones push activas. Activá las notificaciones desde tu Perfil primero.',
            });
        }
        const { pushToUser } = require('../services/push');
        await pushToUser(req.user.userId, {
            title: '🔔 Notificación de prueba',
            body: 'Si ves esto, las push notifications están funcionando correctamente.',
            url: '/',
            icon: '/favicon.svg',
        });
        res.json({ success: true, message: `Push enviado a ${subsResult.rows.length} suscripción(es)` });
    } catch (error) {
        console.error('Push test error:', error);
        res.status(500).json({ success: false, error: 'Error al enviar push: ' + error.message });
    }
});

exports.default = router;
