'use strict';

const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const API_BASE = process.env.API_URL || 'https://t49euho172.execute-api.us-east-1.amazonaws.com/prod/api';

// POST /api/voice/twiml
// Called by Twilio when the user answers — returns TwiML that plays the survey
router.post('/twiml', (req, res) => {
    const { surveyId, question, options: optionsRaw } = req.query;
    let options = [];
    try { options = JSON.parse(optionsRaw); } catch { /* malformed options — proceed with empty */ }

    const optionsPhrased = options.map(o => `Presioná ${o.digit} para ${o.label}`).join('. ');
    const responseUrl = `${API_BASE}/voice/response?surveyId=${encodeURIComponent(surveyId)}`;

    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${responseUrl}" method="POST" timeout="10">
    <Say language="es-AR" voice="Polly.Conchita">${question}. ${optionsPhrased}. Repetimos: ${question}. ${optionsPhrased}.</Say>
  </Gather>
  <Say language="es-AR" voice="Polly.Conchita">No recibimos tu respuesta. Gracias igual. Hasta la próxima del PRODE Caballito.</Say>
</Response>`);
});

// GET /api/voice/twiml — sanity check en browser
router.get('/twiml', (_req, res) => {
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-AR">Voice survey endpoint OK.</Say></Response>`);
});

// POST /api/voice/response
// Called by Twilio after the user presses a digit
router.post('/response', async (req, res) => {
    const { surveyId } = req.query;
    const { Digits, CallSid, From } = req.body;

    try {
        if (Digits) {
            await db.query(
                `INSERT INTO voice_survey_responses (survey_id, call_sid, phone_number, digit, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (survey_id, call_sid) DO UPDATE SET digit = EXCLUDED.digit`,
                [surveyId, CallSid, From, Digits]
            );
            console.log(`[voice-response] surveyId=${surveyId} from=${From} digit=${Digits}`);
        }
    } catch (err) {
        console.error('[voice-response] db error:', err.message);
    }

    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-AR" voice="Polly.Conchita">¡Gracias por tu voto! Hasta la próxima del PRODE Caballito.</Say>
  <Hangup/>
</Response>`);
});

// POST /api/voice/status
// Twilio status callback — tracks call outcome (completed, no-answer, busy, failed)
router.post('/status', async (req, res) => {
    const { CallSid, CallStatus, To } = req.body;
    try {
        await db.query(
            `UPDATE voice_survey_responses SET call_status = $2 WHERE call_sid = $1`,
            [CallSid, CallStatus]
        );
    } catch { /* no row yet if call didn't reach response stage — ignore */ }
    console.log(`[voice-status] sid=${CallSid} status=${CallStatus} to=${To}`);
    res.sendStatus(200);
});

// GET /api/voice/results/:surveyId — admin only
router.get('/results/:surveyId', authMiddleware, requireAdmin, async (req, res) => {
    const { surveyId } = req.params;
    try {
        const [surveyRes, responsesRes] = await Promise.all([
            db.query(`SELECT * FROM voice_surveys WHERE id = $1`, [surveyId]),
            db.query(
                `SELECT digit, COUNT(*)::int AS count
                 FROM voice_survey_responses
                 WHERE survey_id = $1 AND digit IS NOT NULL
                 GROUP BY digit ORDER BY digit`,
                [surveyId]
            ),
        ]);

        if (surveyRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Encuesta no encontrada' });
        }

        const options = surveyRes.rows[0].options || [];
        const byDigit = Object.fromEntries(responsesRes.rows.map(r => [r.digit, r.count]));
        const resultsWithLabels = options.map(o => ({
            digit:  o.digit,
            label:  o.label,
            count:  byDigit[o.digit] || 0,
        }));
        const total = resultsWithLabels.reduce((acc, r) => acc + r.count, 0);

        res.json({
            success: true,
            data: {
                survey: surveyRes.rows[0],
                results: resultsWithLabels,
                total_responses: total,
            },
        });
    } catch (err) {
        console.error('[voice-results] error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
