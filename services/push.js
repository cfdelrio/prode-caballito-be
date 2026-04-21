"use strict";

const { db } = require('../db/connection');

// Lazy-load web-push para que Lambda arranque aunque el paquete no esté
// en el deployment (evita ImportModuleError en cold start)
let _webpush = null;
function getWebpush() {
    if (!_webpush) {
        _webpush = require('web-push');
        _webpush.setVapidDetails(
            'mailto:admin@prodecaballito.com',
            process.env.VAPID_PUBLIC_KEY  || 'BAXBLdwtMlYJnlIWkjPlOFMgvdjeVYy6Bk-ARQ_5_YRHLtaaflqHnTB9yP6Dr2iABVLroBs_lZL4uTS8ju00Flk',
            process.env.VAPID_PRIVATE_KEY || '5cVTiBKVU9RpxC-N2AVuK_1XSZnWundQPjFRZLvNdEk'
        );
    }
    return _webpush;
}

/**
 * Send a push notification to a single subscription row from DB.
 * Automatically removes expired/invalid subscriptions (410 Gone).
 */
const sendPush = async (sub, payload) => {
    const webpush = getWebpush();
    const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired — remove from DB
            await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint])
                .catch(() => {});
        } else {
            throw err;
        }
    }
};

/**
 * Send a push notification to all subscriptions of a specific user.
 */
const pushToUser = async (userId, payload) => {
    const res = await db.query(
        'SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]
    );
    for (const sub of res.rows) {
        await sendPush(sub, payload).catch(e =>
            console.error(`Push failed for user ${userId}:`, e.message)
        );
    }
};

/**
 * Broadcast a push notification to all subscribed users.
 */
const pushToAll = async (payload) => {
    const res = await db.query('SELECT * FROM push_subscriptions');
    let sent = 0, failed = 0;
    for (const sub of res.rows) {
        try {
            await sendPush(sub, payload);
            sent++;
        } catch (e) {
            console.error(`Push broadcast failed for ${sub.user_id}:`, e.message);
            failed++;
        }
    }
    console.log(`[push] broadcast sent=${sent} failed=${failed}`);
    return { sent, failed };
};

module.exports = { sendPush, pushToUser, pushToAll };
