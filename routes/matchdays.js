"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const auth_1 = require("../middleware/auth");
const scoring_1 = require("../services/scoring");
const https = require("https");
const { sendWhatsAppTemplate } = require("../services/whatsapp");
const { runConcurrent } = require("../services/concurrency");
const router = (0, express_1.Router)();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function openAiPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'api.openai.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 60000,
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch(e) { reject(new Error('OpenAI parse error: ' + raw.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI timeout')); });
    req.write(data);
    req.end();
  });
}

// Parsea el value devuelto por pg (puede venir ya parseado si la columna es jsonb)
function parseConfigValue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

async function uploadImageToS3(imageData) {
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3({ region: 'us-east-1' });
  const key = `winners/${Date.now()}.png`;

  let body;
  if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
    body = Buffer.from(imageData.split(',')[1], 'base64');
  } else if (typeof imageData === 'string' && imageData.startsWith('http')) {
    body = await new Promise((resolve, reject) => {
      https.get(imageData, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Descarga imagen falló: HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  } else {
    throw new Error('imageData debe ser base64 data URI o URL http(s)');
  }

  await s3.putObject({
    Bucket: 'prode-uploads-cdelrio',
    Key: key,
    Body: body,
    ContentType: 'image/png',
  }).promise();

  const url = s3.getSignedUrl('getObject', {
    Bucket: 'prode-uploads-cdelrio',
    Key: key,
    Expires: 10 * 365 * 24 * 3600,
  });
  console.log('[winner] Imagen subida a S3:', key);
  return url;
}

async function processWinnerNotification(winner, matchday, winnerEmail, allEmails = []) {
  try {
    // 1. Find top scorers with GPT-4o (null = not found)
    let scorerNames = null;
    try {
      const scorersRes = await openAiPost('/v1/chat/completions', {
        model: 'gpt-4o',
        max_tokens: 200,
        messages: [{ role: 'user', content: `Para el torneo con ID '${matchday.tournament_id}' en la jornada '${matchday.name}', ¿cuáles fueron los 3 principales goleadores reales? Si no tenés información certera respondé con el array vacío []. Respondé ÚNICAMENTE con un array JSON sin markdown. Formato: [{"name": "Nombre Apellido", "goals": 2}]` }]
      });
      const raw = scorersRes.choices?.[0]?.message?.content || '';
      const scorers = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(scorers) && scorers.length > 0) {
        scorerNames = scorers.map(s => `${s.name} (${s.goals} gol${s.goals !== 1 ? 'es' : ''})`).join(', ');
        console.log('Scorers:', scorerNames);
      }
    } catch(e) { console.warn('Scorers error:', e.message); }

    const MOTIVATIONAL = [
      '¡Sos un crack total! 🔥',
      '¡Nadie te para, campeón! 🏅',
      '¡Tu olfato para el fútbol no tiene rival! ⚽',
      '¡Leyenda del prode! 🌟',
      '¡Fenomenal, seguí así! 💪',
    ];
    const motivational = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];

    const cardPrompt = `Create a FIFA Ultimate Team player card, ultra high quality digital art style.
- IMPORTANT: use the face and physical appearance of the person shown in the provided photo as the player's face on the card. Reproduce their likeness faithfully.
- Golden elite card with shiny gradient background and geometric patterns.
- Classic FIFA UT card layout: rating '99' top-left, position 'PRO' below it.
- Player wearing a blue and gold jersey, number 13, in a dynamic celebration pose (fist pumped).
- Player name at the bottom: '${winner.user_name.toUpperCase()}'.
- Card stats: PAS 99 | TIR 99 | REG 99 | FÍS 99 | RIT 99.
- Small caption text: '${matchday.name} · GANADOR'.
- Holographic card shine effect, dark background with golden particles.
- A fan in the background holds a banner that reads '¡CAMPEÓN!' and Maradona hands the player a trophy.
- Ultra-detailed, official FIFA game aesthetic, glossy finish.`;

    let imageUri = null;

    if (winner.user_avatar) {
      try {
        const respRes = await openAiPost('/v1/responses', {
          model: 'gpt-4o',
          input: [{
            role: 'user',
            content: [
              { type: 'input_image', image_url: winner.user_avatar },
              { type: 'input_text', text: cardPrompt },
            ],
          }],
          tools: [{ type: 'image_generation', quality: 'high' }],
        });
        console.log('Responses API keys:', JSON.stringify(Object.keys(respRes || {})));
        if (respRes.error) {
          console.warn('Responses API error:', JSON.stringify(respRes.error));
        }
        const outputArr = respRes.output || respRes.outputs || [];
        console.log('Responses API output types:', JSON.stringify(outputArr.map(o => o.type)));
        const imgCall = outputArr.find(o => o.type === 'image_generation_call');
        if (imgCall?.result) {
          imageUri = `data:image/png;base64,${imgCall.result}`;
          console.log('Got image from Responses API (base64 length):', imgCall.result.length);
        } else {
          console.warn('Responses API returned no image_generation_call, falling back to DALL-E 3');
        }
      } catch(e) {
        console.warn('Responses API image error:', e.message, '— falling back to DALL-E 3');
      }
    }

    if (!imageUri) {
      const dallePrompt = `A FIFA Ultimate Team player card, ultra high quality digital art style.
- Golden elite card with shiny gradient background and geometric patterns.
- Classic FIFA UT card layout: rating 99 top-left, position PRO below it.
- Player wearing a blue and gold jersey, number 13, in a dynamic celebration pose with fist raised.
- Player name at the bottom: ${winner.user_name.toUpperCase()}.
- Card stats: PAS 99, TIR 99, REG 99, FIS 99, RIT 99.
- Caption text: ${matchday.name} GANADOR.
- Holographic card shine effect, dark background with golden particles.
- Ultra-detailed, official FIFA game aesthetic, glossy finish.`;
      const imageRes = await openAiPost('/v1/images/generations', {
        model: 'dall-e-3',
        prompt: dallePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'vivid',
      });
      if (imageRes.error) {
        console.error('DALL-E error:', JSON.stringify(imageRes.error));
      }
      imageUri = imageRes.data?.[0]?.url || null;
      console.log('DALL-E fallback image URL:', imageUri ? 'OK (URL received)' : 'null');
    }

    if (!imageUri) throw new Error('No image generated');

    // ── Persistir imagen del ganador en carousel config ──────────────────────
    try {
      const imageUrl = await uploadImageToS3(imageUri);

      const entry = {
        image_url: imageUrl,
        matchday_label: matchday.name,
        user_name: winner.user_name,
        points: winner.points,
        updated_at: new Date().toISOString(),
      };
      const existingRes = await connection_1.db.query(`SELECT value FROM config WHERE key = 'ganadores_fechas'`);
      let carouselWinners = [];
      if (existingRes.rows.length > 0) {
        const parsed = parseConfigValue(existingRes.rows[0].value);
        if (Array.isArray(parsed)) carouselWinners = parsed;
      }
      carouselWinners.push(entry);
      await connection_1.db.query(
        `INSERT INTO config (key, value, updated_at) VALUES ('ganadores_fechas', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(carouselWinners)]
      );
      await connection_1.db.query(
        `INSERT INTO config (key, value, updated_at) VALUES ('ganador_fecha', $1, NOW()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(entry)]
      );
      console.log('[winner] Imagen guardada en carousel config — total ganadores:', carouselWinners.length);
    } catch (saveErr) {
      console.error('[winner] Error guardando en carousel config:', saveErr.message);
    }

    const recipients = allEmails.length > 0 ? allEmails : [winnerEmail];
    console.log(`Sending to ${recipients.length} recipients`);

    function sendImagemail(to, subject, message) {
      const body = JSON.stringify({ to, uri: imageUri, subject, message });
      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: process.env.API_HOSTNAME || 't49euho172.execute-api.us-east-1.amazonaws.com',
          path: '/prod/api/imagemail',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: 60000,
        }, (res) => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('imagemail timeout')); });
        req.write(body);
        req.end();
      });
    }

    await runConcurrent(recipients, async (email) => {
      const isWinner = email === winnerEmail;
      const subject = isWinner
        ? `🏆 ¡Ganaste ${matchday.name}!`
        : `🏆 ${winner.user_name} ganó ${matchday.name}`;
      const scorerLine = scorerNames ? `Goleadores de la fecha: ${scorerNames}` : motivational;
      const message = isWinner
        ? `¡Felicitaciones ${winner.user_name}! Ganaste con ${winner.points} puntos.\n${scorerLine}`
        : `${winner.user_name} ganó ${matchday.name} con ${winner.points} puntos.\n${scorerLine}`;
      const status = await sendImagemail(email, subject, message);
      console.log(`Email sent to ${email} — status ${status}`);
    }, 10);

    console.log('Winner notification complete — all emails sent');

    try {
        const waUsers = await connection_1.db.query(
            `SELECT whatsapp_number FROM users WHERE whatsapp_number IS NOT NULL AND whatsapp_consent = true`
        );
        await runConcurrent(waUsers.rows, (u) =>
            sendWhatsAppTemplate({
                to: u.whatsapp_number,
                templateName: 'prode_ganador_fecha',
                variables: {
                    '1': winner.user_name,
                    '2': matchday.name,
                    '3': String(winner.points),
                },
            }).catch(e => console.error(`Winner WA error for ${u.whatsapp_number}:`, e.message))
        , 10);
        console.log(`Winner WA sent to ${waUsers.rows.length} users`);
    } catch(waErr) {
        console.error('Winner WA broadcast error:', waErr.message);
    }

    try {
        const { pushToUser, pushToAll } = require('../services/push');
        await pushToUser(winner.user_id, {
            title: `🏆 ¡Ganaste ${matchday.name}!`,
            body: `${winner.points} puntos — ¡Sos el crack de la fecha!`,
            url: '/ranking',
            icon: '/favicon.svg',
        }).catch(e => console.error('Push winner error:', e.message));

        const scorerLine2 = scorerNames ? ` · ${scorerNames}` : '';
        await pushToAll({
            title: `🏆 ${winner.user_name} ganó ${matchday.name}`,
            body: `Con ${winner.points} puntos${scorerLine2}`,
            url: '/ranking',
            icon: '/favicon.svg',
        }).catch(e => console.error('Push broadcast error:', e.message));

        console.log('Winner push notifications sent');
    } catch(pushErr) {
        console.error('Winner push error:', pushErr.message);
    }
  } catch(err) {
    console.error('processWinnerNotification error:', err.message);
  }
}

// ── Timezone helpers ─────────────────────────────────────────────────────────
// Argentina es UTC-3 sin DST. Usamos Intl para que sea correcto incluso si
// en algún momento cambia el offset (históricamente ha variado).
const ARG_TZ = 'America/Argentina/Buenos_Aires';

function toArgentinaDateStr(date) {
  // Retorna 'YYYY-MM-DD' en hora argentina (en-CA da ese formato ISO)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARG_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toArgentinaDayMonth(date) {
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: ARG_TZ,
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(date);
  const p = {};
  for (const { type, value } of parts) p[type] = value;
  return { day: p.day, month: p.month };
}
// ─────────────────────────────────────────────────────────────────────────────

async function ensureMatchday(tournamentId, matchDate) {
  const dateStr = toArgentinaDateStr(matchDate);
  const existing = await connection_1.db.query(
    'SELECT * FROM matchdays WHERE tournament_id = $1 AND match_date = $2',
    [tournamentId, dateStr]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const { day, month } = toArgentinaDayMonth(matchDate);
  const name = `Fecha ${day}/${month}`;

  const res = await connection_1.db.query(
    `INSERT INTO matchdays (tournament_id, name, match_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (tournament_id, match_date) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [tournamentId, name, dateStr]
  );
  return res.rows[0];
}

async function recalcMatchday(matchdayId) {
  const mdRes = await connection_1.db.query('SELECT * FROM matchdays WHERE id = $1', [matchdayId]);
  if (mdRes.rows.length === 0) throw new Error('Matchday not found');
  const matchday = mdRes.rows[0];

  const matchesRes = await connection_1.db.query(
    `SELECT m.id, m.resultado_local, m.resultado_visitante
     FROM matches m
     WHERE m.tournament_id = $1
       AND DATE(m.start_time AT TIME ZONE 'America/Argentina/Buenos_Aires') = $2
       AND m.estado = 'finished'
       AND m.resultado_local IS NOT NULL`,
    [matchday.tournament_id, matchday.match_date]
  );
  const dayMatches = matchesRes.rows;
  if (dayMatches.length === 0) return { matchday, updated: 0 };

  const matchIds = dayMatches.map(m => m.id);

  const betsRes = await connection_1.db.query(
    `SELECT b.planilla_id, b.match_id, b.goles_local, b.goles_visitante,
            p.user_id, u.nombre AS user_name, u.foto_url AS user_avatar
     FROM bets b
     JOIN planillas p ON p.id = b.planilla_id
     JOIN users u ON u.id = p.user_id
     WHERE b.match_id = ANY($1::uuid[])`,
    [matchIds]
  );

  const resultMap = {};
  for (const m of dayMatches) resultMap[m.id] = m;

  const planillaPoints = {};
  for (const bet of betsRes.rows) {
    const match = resultMap[bet.match_id];
    if (!match) continue;
    const score = (0, scoring_1.calcularPuntaje)(
      { goles_local: bet.goles_local, goles_visitante: bet.goles_visitante },
      { resultado_local: match.resultado_local, resultado_visitante: match.resultado_visitante }
    );
    if (!planillaPoints[bet.planilla_id]) {
      planillaPoints[bet.planilla_id] = {
        planilla_id: bet.planilla_id,
        user_id: bet.user_id,
        user_name: bet.user_name,
        user_avatar: bet.user_avatar || null,
        points: 0,
      };
    }
    planillaPoints[bet.planilla_id].points += score.puntos;
  }

  const rows = Object.values(planillaPoints);
  if (rows.length === 0) return { matchday, updated: 0 };

  rows.sort((a, b) => b.points - a.points);
  let currentRank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].points < rows[i - 1].points) currentRank = i + 1;
    rows[i].rank = currentRank;
    rows[i].is_winner = currentRank === 1;
  }

  for (const r of rows) {
    await connection_1.db.query(
      `INSERT INTO scores_by_matchday
         (matchday_id, planilla_id, user_id, user_name, user_avatar, points, rank_in_matchday, is_winner, calculated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (matchday_id, planilla_id) DO UPDATE SET
         points           = EXCLUDED.points,
         rank_in_matchday = EXCLUDED.rank_in_matchday,
         is_winner        = EXCLUDED.is_winner,
         user_name        = EXCLUDED.user_name,
         user_avatar      = EXCLUDED.user_avatar,
         calculated_at    = NOW()`,
      [matchdayId, r.planilla_id, r.user_id, r.user_name, r.user_avatar, r.points, r.rank, r.is_winner]
    );
  }

  const winner = rows.find(r => r.is_winner);
  if (winner) {
    try {
      const allUserIds = rows.map(r => r.user_id);
      const emailsRes = await connection_1.db.query(
        `SELECT id, email FROM users WHERE id = ANY($1::uuid[]) AND email IS NOT NULL AND email != ''`,
        [allUserIds]
      );
      const emailMap = {};
      for (const row of emailsRes.rows) emailMap[row.id] = row.email;

      const winnerEmail = emailMap[winner.user_id] || '';
      const allEmails = Object.values(emailMap);

      const AWS = require('aws-sdk');
      const lambda = new AWS.Lambda({ region: process.env.AWS_REGION || 'us-east-1' });
      await lambda.invoke({
        FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'prode-api',
        InvocationType: 'Event',
        Payload: JSON.stringify({
          source: 'winner-notification',
          winner: { user_id: winner.user_id, user_name: winner.user_name, user_avatar: winner.user_avatar, points: winner.points },
          matchday: { id: matchday.id, name: matchday.name, tournament_id: matchday.tournament_id },
          winnerEmail,
          allEmails,
        }),
      }).promise();
      console.log(`Winner notification invoked async — winner: ${winnerEmail}, total recipients: ${allEmails.length}`);
    } catch (err) {
      console.error('Error preparing winner notification:', err.message);
    }
  }

  return { matchday, updated: rows.length };
}

router.get('/', async (req, res) => {
  try {
    const { tournament_id } = req.query;
    if (!tournament_id) {
      return res.status(400).json({ success: false, error: 'tournament_id requerido' });
    }
    const result = await connection_1.db.query(
      `SELECT md.*,
              (SELECT COUNT(*)::int FROM scores_by_matchday WHERE matchday_id = md.id) AS participant_count,
              (SELECT json_agg(json_build_object(
                 'user_id', s.user_id, 'user_name', s.user_name,
                 'user_avatar', s.user_avatar, 'points', s.points,
                 'planilla_id', s.planilla_id
               ))
               FROM scores_by_matchday s
               WHERE s.matchday_id = md.id AND s.is_winner = true
              ) AS winners
       FROM matchdays md
       WHERE md.tournament_id = $1
       ORDER BY md.match_date ASC`,
      [tournament_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /matchdays error:', err);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.get('/:id/ranking', async (req, res) => {
  try {
    const { id } = req.params;
    const mdRes = await connection_1.db.query('SELECT * FROM matchdays WHERE id = $1', [id]);
    if (mdRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fecha no encontrada' });
    }
    const ranking = await connection_1.db.query(
      `SELECT s.*, md.name AS matchday_name, md.match_date
       FROM scores_by_matchday s
       JOIN matchdays md ON md.id = s.matchday_id
       WHERE s.matchday_id = $1
       ORDER BY s.rank_in_matchday ASC, s.points DESC`,
      [id]
    );
    res.json({ success: true, data: { matchday: mdRes.rows[0], ranking: ranking.rows } });
  } catch (err) {
    console.error('GET /matchdays/:id/ranking error:', err);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { tournament_id } = req.query;
    let whereExtra = '';
    const params = [userId];
    if (tournament_id) {
      params.push(tournament_id);
      whereExtra = ` AND md.tournament_id = $${params.length}`;
    }
    const result = await connection_1.db.query(
      `SELECT s.*, md.name AS matchday_name, md.match_date, md.tournament_id
       FROM scores_by_matchday s
       JOIN matchdays md ON md.id = s.matchday_id
       WHERE s.user_id = $1${whereExtra}
       ORDER BY md.match_date DESC`,
      params
    );
    const wonCount = result.rows.filter(r => r.is_winner).length;
    res.json({ success: true, data: { history: result.rows, won_count: wonCount } });
  } catch (err) {
    console.error('GET /matchdays/user/:userId error:', err);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.get('/me', auth_1.authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tournament_id } = req.query;
    let whereExtra = '';
    const params = [userId];
    if (tournament_id) {
      params.push(tournament_id);
      whereExtra = ` AND md.tournament_id = $${params.length}`;
    }
    const result = await connection_1.db.query(
      `SELECT s.*, md.name AS matchday_name, md.match_date, md.tournament_id
       FROM scores_by_matchday s
       JOIN matchdays md ON md.id = s.matchday_id
       WHERE s.user_id = $1${whereExtra}
       ORDER BY md.match_date DESC`,
      params
    );
    const wonCount = result.rows.filter(r => r.is_winner).length;
    res.json({ success: true, data: { history: result.rows, won_count: wonCount } });
  } catch (err) {
    console.error('GET /matchdays/me error:', err);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/recalculate', auth_1.authMiddleware, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(400).json({ success: false, error: 'Admin requerido' });
    }
    const { tournament_id, match_date, matchday_id } = req.body;

    let targetMatchdayId = matchday_id;

    if (!targetMatchdayId) {
      if (!tournament_id || !match_date) {
        return res.status(400).json({ success: false, error: 'Requiere matchday_id o (tournament_id + match_date)' });
      }
      const md = await ensureMatchday(tournament_id, new Date(match_date));
      targetMatchdayId = md.id;
    }

    const result = await recalcMatchday(targetMatchdayId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('POST /matchdays/recalculate error:', err);
    res.status(500).json({ success: false, error: String(err.message || err) });
  }
});

router.post('/recalculate-all', auth_1.authMiddleware, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin requerido' });
    }
    const { tournament_id } = req.body;
    if (!tournament_id) {
      return res.status(400).json({ success: false, error: 'tournament_id requerido' });
    }

    const datesRes = await connection_1.db.query(
      `SELECT DISTINCT DATE(start_time AT TIME ZONE 'America/Argentina/Buenos_Aires') AS match_date
       FROM matches
       WHERE tournament_id = $1 AND estado = 'finished' AND resultado_local IS NOT NULL
       ORDER BY match_date ASC`,
      [tournament_id]
    );

    const results = [];
    for (const row of datesRes.rows) {
      const md = await ensureMatchday(tournament_id, new Date(row.match_date));
      const r  = await recalcMatchday(md.id);
      results.push({ date: row.match_date, matchday_id: md.id, updated: r.updated });
    }

    res.json({ success: true, data: { processed: results.length, results } });
  } catch (err) {
    console.error('POST /matchdays/recalculate-all error:', err);
    res.status(500).json({ success: false, error: String(err.message || err) });
  }
});

const ALLOWED_EMOJIS = ['👏', '❤️', '🔥', '😮', '😂'];

router.post('/:id/react', auth_1.authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const emoji = req.body.emoji || '👏';

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({ success: false, error: 'Emoji no válido' });
    }

    const mdRes = await connection_1.db.query('SELECT id FROM matchdays WHERE id = $1', [id]);
    if (mdRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fecha no encontrada' });
    }

    const existing = await connection_1.db.query(
      'SELECT emoji FROM matchday_reactions WHERE matchday_id = $1 AND user_id = $2',
      [id, userId]
    );

    let userReaction = null;
    if (existing.rows.length > 0 && existing.rows[0].emoji === emoji) {
      await connection_1.db.query(
        'DELETE FROM matchday_reactions WHERE matchday_id = $1 AND user_id = $2',
        [id, userId]
      );
    } else if (existing.rows.length > 0) {
      await connection_1.db.query(
        'UPDATE matchday_reactions SET emoji = $3 WHERE matchday_id = $1 AND user_id = $2',
        [id, userId, emoji]
      );
      userReaction = emoji;
    } else {
      await connection_1.db.query(
        'INSERT INTO matchday_reactions (matchday_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT (matchday_id, user_id) DO UPDATE SET emoji = $3',
        [id, userId, emoji]
      );
      userReaction = emoji;
    }

    const countsRes = await connection_1.db.query(
      'SELECT emoji, COUNT(*)::int AS count FROM matchday_reactions WHERE matchday_id = $1 GROUP BY emoji',
      [id]
    );
    const reactions = {};
    for (const row of countsRes.rows) reactions[row.emoji] = row.count;

    res.json({ success: true, data: { userReaction, reactions } });
  } catch (err) {
    console.error('POST /matchdays/:id/react error:', err);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.get('/:id/reactions', async (req, res) => {
  try {
    const { id } = req.params;
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch { /* no auth */ }
    }

    const countsRes = await connection_1.db.query(
      'SELECT emoji, COUNT(*)::int AS count FROM matchday_reactions WHERE matchday_id = $1 GROUP BY emoji',
      [id]
    );
    const reactions = {};
    for (const row of countsRes.rows) reactions[row.emoji] = row.count;

    let userReaction = null;
    if (userId) {
      const myRes = await connection_1.db.query(
        'SELECT emoji FROM matchday_reactions WHERE matchday_id = $1 AND user_id = $2',
        [id, userId]
      );
      if (myRes.rows.length > 0) userReaction = myRes.rows[0].emoji;
    }

    res.json({ success: true, data: { reactions, userReaction } });
  } catch (err) {
    console.error('GET /matchdays/:id/reactions error:', err);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/test-email-only', auth_1.authMiddleware, async (req, res) => {
  try {
    const userRes = await connection_1.db.query(
      'SELECT email FROM users WHERE id = $1',
      [req.user.userId]
    );
    const recipient = req.body.target_email || userRes.rows[0]?.email;
    if (!recipient) return res.status(400).json({ success: false, error: 'No email found' });

    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Fussball.png/240px-Fussball.png';
    const body = JSON.stringify({ to: recipient, uri: testImageUrl, subject: 'Test Email Prode', message: 'Este es un email de prueba del pipeline imagemail.' });

    const result = await new Promise((resolve, reject) => {
      const r2 = https.request({
        hostname: process.env.API_HOSTNAME || 't49euho172.execute-api.us-east-1.amazonaws.com',
        path: '/prod/api/imagemail',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 30000,
      }, (r) => {
        let raw = '';
        r.on('data', c => raw += c);
        r.on('end', () => resolve({ status: r.statusCode, body: raw }));
      });
      r2.on('error', reject);
      r2.on('timeout', () => { r2.destroy(); reject(new Error('imagemail timeout')); });
      r2.write(body);
      r2.end();
    });

    res.json({ success: true, data: { recipient, imagemailStatus: result.status, imagemailBody: result.body } });
  } catch (err) {
    console.error('POST /matchdays/test-email-only error:', err);
    res.status(500).json({ success: false, error: String(err.message || err) });
  }
});

router.post('/test-winner-notification', auth_1.authMiddleware, async (req, res) => {
  try {
    const userRes = await connection_1.db.query(
      'SELECT id, nombre, email, foto_url FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    const me = userRes.rows[0];
    const matchdayName = req.body.matchday_name || 'Test Abril 2026';
    const points       = typeof req.body.points === 'number' ? req.body.points : 42;
    const skipAvatar   = req.body.skip_avatar === true;
    const syncMode     = req.body.sync === true;

    const winner = {
      user_id:     me.id,
      user_name:   me.nombre,
      user_avatar: skipAvatar ? null : (me.foto_url || null),
      points,
    };
    const matchday = { id: '00000000-0000-0000-0000-000000000000', name: matchdayName, tournament_id: null };

    const notifPromise = processWinnerNotification(winner, matchday, me.email, [me.email]);

    if (syncMode) {
      try {
        await notifPromise;
        return res.json({
          success: true,
          data: { message: 'winner-notification completado (sync)', winner, matchday, recipient: me.email },
        });
      } catch (err) {
        return res.status(500).json({ success: false, error: String(err.message || err) });
      }
    }

    res.json({
      success: true,
      data: {
        message: 'winner-notification disparado inline (fire-and-forget) — revisá CloudWatch + bandeja',
        winner,
        matchday,
        recipient: me.email,
      },
    });
  } catch (err) {
    console.error('POST /matchdays/test-winner-notification error:', err);
    res.status(500).json({ success: false, error: String(err.message || err) });
  }
});

async function recalcMatchdayForMatch(matchId, tournamentId, startTime) {
  const md = await ensureMatchday(tournamentId, new Date(startTime));
  await recalcMatchday(md.id);
}

module.exports = router;
module.exports.recalcMatchdayForMatch = recalcMatchdayForMatch;
module.exports.recalcMatchday = recalcMatchday;
module.exports.processWinnerNotification = processWinnerNotification;
exports.default = router;
