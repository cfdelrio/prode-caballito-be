"use strict";

// WHATSAPP_WHITELIST: comma-separated numbers (e.g. "+5491155996222,+5491141843591")
// When set, only those numbers receive messages (sandbox/testing mode).
// Remove or leave empty in production to send to all users.
const WHITELIST = process.env.WHATSAPP_WHITELIST
    ? process.env.WHATSAPP_WHITELIST.split(',').map(n => n.trim()).filter(Boolean)
    : null;

const sendWhatsApp = async ({ to, body }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const from       = process.env.TWILIO_WHATSAPP_FROM; // 'whatsapp:+14155238886'

    if (!accountSid || !authToken || !from) {
        console.warn('[whatsapp] Twilio env vars not set, skipping');
        return;
    }

    if (WHITELIST) {
        const normalize = (n) => n.replace(/^\+/, '');
        if (!WHITELIST.map(normalize).includes(normalize(to))) {
            console.log(`[whatsapp] ${to} not in whitelist, skipping`);
            return;
        }
    }

    const twilio = require('twilio')(accountSid, authToken);
    const message = await twilio.messages.create({
        from,
        to: `whatsapp:${to}`,
        body,
    });
    console.log(`[whatsapp] sent to ${to} — sid: ${message.sid}`);
    return message;
};

module.exports = { sendWhatsApp };
