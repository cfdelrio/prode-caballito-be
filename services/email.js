"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRankingUpdateEmail = exports.sendVerificationCode = exports.sendWelcomeEmail = exports.sendEmail = void 0;
const { db } = require('../db/connection');
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_m3NekW1Y_23CkRZqbVhH24yuU4C6XuNYe';
const FROM_EMAIL = 'noreply@prodecaballito.com';
const sendEmail = async ({ to, subject, html }) => {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: `PRODE Caballito <${FROM_EMAIL}>`, to, subject, html }),
    });
    if (!res.ok) {
        const err = await res.text();
        console.error('Resend error:', err);
        throw new Error(`Resend API error: ${res.status} ${err}`);
    }
};
exports.sendEmail = sendEmail;
const sendRankingUpdateEmail = async (userEmail, userName, newPosition, previousPosition, points) => {
    const movement = previousPosition ? (previousPosition - newPosition) : 0;
    let emoji = '';
    let message = '';
    if (movement > 0) {
        emoji = '📈';
        message = `Subiste ${movement} posición${movement > 1 ? 'es' : ''}!`;
    }
    else if (movement < 0) {
        emoji = '📉';
        message = `Bajaste ${Math.abs(movement)} posición${Math.abs(movement) > 1 ? 'es' : ''}`;
    }
    else if (previousPosition === null) {
        emoji = '🎉';
        message = '¡Bienvenido al ranking!';
    }
    else {
        emoji = '➖';
        message = 'Mantuviste tu posición';
    }
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; }
        h1 { color: #1a56db; }
        .ranking { background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .position { font-size: 48px; font-weight: bold; color: #1a56db; }
        .points { color: #6b7280; }
        .footer { text-align: center; color: #9ca3af; margin-top: 20px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏆 PRODE Caballito</h1>
        <p>Hola ${userName},</p>
        <p>${emoji} ${message}</p>
        <div class="ranking">
          <div class="position">#${newPosition}</div>
          <div class="points">${points} puntos</div>
        </div>
        <p>Ver todos los resultados en: <a href="https://prodecaballito.com/ranking">PRODE Caballito</a></p>
        <div class="footer">
          © 2026 PRODE Caballito
        </div>
      </div>
    </body>
    </html>
  `;
    await (0, exports.sendEmail)({
        to: userEmail,
        subject: `🏆 PRODE Caballito - Posición #${newPosition}`,
        html,
    });
};
exports.sendRankingUpdateEmail = sendRankingUpdateEmail;
const sendWelcomeEmail = async (email, nombre) => {
    const [countResult, userResult] = await Promise.all([
        db.query('SELECT COUNT(*) as total FROM users'),
        db.query('SELECT foto_url FROM users WHERE email = $1', [email]),
    ]);
    const totalJugadores = Number(countResult.rows[0]?.total || 0).toLocaleString('es-AR');
    const fotoUrl = userResult.rows[0]?.foto_url || null;
    const avatarTd = fotoUrl
      ? `<td width="72" valign="middle" align="center" style="padding:0 12px;"><img src="${fotoUrl}" alt="avatar" width="60" height="60" style="border-radius:50%;border:2px solid #FFB700;object-fit:cover;display:block;margin:0 auto;" /></td>`
      : `<td width="52" valign="middle" style="padding-right:14px;"><div style="width:44px;height:44px;background:#FFB700;border-radius:50%;text-align:center;line-height:44px;font-size:22px;">⚠️</div></td>`;
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido - PRODE Caballito</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:0;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin:0 auto;">

  <!-- ── BLOQUE 1: HEADER ── -->
  <tr>
    <td style="background:#000;padding:14px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding-right:8px;">
                  <div style="width:32px;height:32px;background:#fff;border-radius:50%;text-align:center;line-height:32px;font-size:16px;">⚽</div>
                </td>
                <td valign="middle">
                  <div style="color:#fff;font-size:13px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;line-height:1.1;letter-spacing:0.5px;">PRODE</div>
                  <div style="color:#fff;font-size:10px;font-weight:400;font-family:Arial,sans-serif;letter-spacing:1px;">CABALLITO</div>
                </td>
              </tr>
            </table>
          </td>
          <td align="right" valign="middle">
            <span style="color:#fff;font-size:11px;font-family:Arial,sans-serif;letter-spacing:0.5px;">🔥 MUNDIAL 2026 · YA ARRANCÓ</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── BLOQUE 2: HERO (foto estadio real + overlay oscuro) ── -->
  <tr>
    <td bgcolor="#0a1628" style="background-image:url('https://prodecaballito.com/ChatGPT%20Image%20Apr%2025%2C%202026%2C%2005_00_01%20PM.png');background-size:cover;background-position:center top;background-color:#0a1628;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background:linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.72) 100%);padding:48px 28px 44px;">
            <div style="color:#fff;font-size:52px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;line-height:0.95;letter-spacing:-2px;text-transform:uppercase;margin-bottom:4px;">ESTO YA EMPEZÓ</div>
            <div style="color:#FFB700;font-size:44px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;line-height:0.95;letter-spacing:-2px;text-transform:uppercase;margin-bottom:4px;">¿VAS A JUGAR</div>
            <div style="color:#FFB700;font-size:44px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;line-height:0.95;letter-spacing:-2px;text-transform:uppercase;margin-bottom:20px;">O MIRAR?</div>
            <div style="color:rgba(255,255,255,0.85);font-size:15px;font-family:Arial,sans-serif;">Tus amigos ya están compitiendo.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── BLOQUE 3: YA ESTÁS ADENTRO (fondo gris claro) ── -->
  <tr>
    <td style="background:#f0f0f0;padding:24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- Columna izquierda -->
          <td width="56%" valign="top" style="padding-right:12px;">
            <div style="font-size:22px;margin-bottom:6px;">🎉</div>
            <div style="font-size:15px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;line-height:1.2;margin-bottom:8px;">
              <span style="color:#111;">¡YA ESTÁS </span><span style="color:#F47C00;">ADENTRO DEL PRODE!</span>
            </div>
            <div style="color:#333;font-size:13px;font-family:Arial,sans-serif;margin-bottom:12px;">${nombre}, el juego ya empezó.</div>
            <!-- Bullet 1 -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:7px;">
              <tr>
                <td valign="middle" style="padding-right:8px;">
                  <div style="width:20px;height:20px;background:#27AE60;border-radius:50%;text-align:center;line-height:20px;font-size:11px;color:#fff;font-weight:bold;font-family:Arial;">✓</div>
                </td>
                <td valign="middle"><span style="color:#333;font-size:13px;font-family:Arial,sans-serif;">Cada partido suma</span></td>
              </tr>
            </table>
            <!-- Bullet 2 -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding-right:8px;">
                  <div style="width:20px;height:20px;background:#27AE60;border-radius:50%;text-align:center;line-height:20px;font-size:11px;color:#fff;font-weight:bold;font-family:Arial;">✓</div>
                </td>
                <td valign="middle"><span style="color:#333;font-size:13px;font-family:Arial,sans-serif;">Cada punto te acerca al podio</span></td>
              </tr>
            </table>
          </td>
          <!-- Columna derecha: card oscura -->
          <td width="44%" valign="middle">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a2e;border-radius:12px;">
              <tr>
                <td align="center" style="padding:20px 14px;">
                  <div style="font-size:30px;margin-bottom:8px;">🏆</div>
                  <div style="color:#999;font-size:9px;font-family:Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">TU OBJETIVO:</div>
                  <div style="color:#FFB700;font-size:17px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;text-transform:uppercase;line-height:1.1;margin-bottom:6px;">EL PRIMER<br>PUESTO</div>
                  <div style="color:rgba(255,255,255,0.5);font-size:11px;font-family:Arial,sans-serif;">¿Estás listo para lograrlo?</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── BLOQUE 4: ALERTA (fondo oscuro, avatar izq, texto centro, 🔥 der) ── -->
  <tr>
    <td style="background:#222;padding:20px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- Avatar izquierda (si tiene foto) -->
          ${avatarTd}
          <!-- Texto central -->
          <td valign="middle" style="padding:0 12px;">
            <div style="color:#fff;font-size:15px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;text-transform:uppercase;margin-bottom:4px;">NO TE QUEDES AFUERA</div>
            <div style="color:#ccc;font-size:12px;font-family:Arial,sans-serif;margin-bottom:3px;">Los primeros partidos ya se están jugando.</div>
            <div style="color:#fff;font-size:12px;font-family:Arial,sans-serif;">Si no apostás ahora, <strong>perdés puntos.</strong></div>
          </td>
          <!-- Llama derecha -->
          <td width="44" valign="middle" align="right">
            <div style="font-size:36px;line-height:1;">🔥</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── BLOQUE 5: STATS + CÓMO FUNCIONA (fondo blanco) ── -->
  <tr>
    <td style="background:#fff;padding:24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- Columna izquierda: estadística jugadores -->
          <td width="38%" valign="top" style="padding-right:16px;border-right:1px solid #e5e5e5;">
            <div style="margin-bottom:8px;">
              <div style="display:inline-block;width:36px;height:36px;background:#F47C00;border-radius:50%;text-align:center;line-height:36px;font-size:18px;">👥</div>
            </div>
            <div style="color:#666;font-size:9px;font-family:Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px;">YA HAY</div>
            <div style="color:#1a2b4a;font-size:28px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;line-height:1;margin-bottom:0;">${totalJugadores} JUGADORES</div>
            <div style="color:#1a2b4a;font-size:12px;font-weight:700;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:6px;">COMPITIENDO</div>
            <div style="color:#888;font-size:11px;font-family:Arial,sans-serif;">¿Podés meterte en el top 10?</div>
          </td>
          <!-- Columna derecha: cómo funciona (3 pasos en columna) -->
          <td width="62%" valign="top" style="padding-left:16px;">
            <div style="color:#1a2b4a;font-size:13px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">¿CÓMO FUNCIONA?</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Paso 1 -->
                <td width="33%" valign="top" align="center" style="padding-right:6px;">
                  <div style="width:28px;height:28px;background:#1a2b4a;border-radius:50%;text-align:center;line-height:28px;font-size:13px;color:#fff;font-weight:bold;font-family:Arial;margin:0 auto 6px;">1</div>
                  <div style="font-size:18px;margin-bottom:4px;">📋</div>
                  <div style="color:#1a2b4a;font-size:10px;font-weight:700;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:3px;">APOSTÁ</div>
                  <div style="color:#666;font-size:10px;font-family:Arial,sans-serif;line-height:1.3;">Pronosticá los resultados de cada partido.</div>
                </td>
                <!-- Paso 2 -->
                <td width="33%" valign="top" align="center" style="padding:0 3px;">
                  <div style="width:28px;height:28px;background:#1a2b4a;border-radius:50%;text-align:center;line-height:28px;font-size:13px;color:#fff;font-weight:bold;font-family:Arial;margin:0 auto 6px;">2</div>
                  <div style="font-size:18px;margin-bottom:4px;">🎯</div>
                  <div style="color:#1a2b4a;font-size:10px;font-weight:700;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:3px;">SUMÁ PUNTOS</div>
                  <div style="color:#666;font-size:10px;font-family:Arial,sans-serif;line-height:1.3;">Acertá resultados y sumá la mayor cantidad de puntos.</div>
                </td>
                <!-- Paso 3 -->
                <td width="33%" valign="top" align="center" style="padding-left:6px;">
                  <div style="width:28px;height:28px;background:#1a2b4a;border-radius:50%;text-align:center;line-height:28px;font-size:13px;color:#fff;font-weight:bold;font-family:Arial;margin:0 auto 6px;">3</div>
                  <div style="font-size:18px;margin-bottom:4px;">🏆</div>
                  <div style="color:#1a2b4a;font-size:10px;font-weight:700;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:3px;">SUBÍ EN EL RANKING</div>
                  <div style="color:#666;font-size:10px;font-family:Arial,sans-serif;line-height:1.3;">Escalá posiciones y competí por increíbles premios.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── BLOQUE 6: CTA BUTTON (fondo blanco, botón naranja) ── -->
  <tr>
    <td style="background:#fff;padding:20px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <a href="https://prodecaballito.com" style="display:block;background:#F47C00;color:#fff;text-decoration:none;padding:16px 20px;border-radius:8px;font-size:17px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;text-align:center;">
              ⚽ &nbsp;EMPEZAR A JUGAR AHORA →
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── BLOQUE 7: FOOTER MOTIVACIONAL (fondo oscuro) ── -->
  <tr>
    <td style="background:#111;padding:24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="55%" valign="middle" style="padding-right:12px;">
            <div style="font-size:26px;margin-bottom:8px;">🏆</div>
            <div style="color:#fff;font-size:17px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;text-transform:uppercase;line-height:1.15;margin-bottom:6px;">ESTA PUEDE SER<br>TU SEMANA.</div>
            <div style="color:rgba(255,255,255,0.55);font-size:12px;font-family:Arial,sans-serif;">Entrá ahora y arrancá fuerte.</div>
          </td>
          <td width="45%" valign="middle" align="center">
            <div style="color:#FFB700;font-size:28px;font-weight:900;font-family:Georgia,'Times New Roman',serif;font-style:italic;line-height:1.1;transform:rotate(-3deg);display:inline-block;">Vamos<br><span style="font-size:34px;">POR TODO!</span></div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── BLOQUE 8: FOOTER LEGAL (blanco) ── -->
  <tr>
    <td style="background:#fff;padding:16px 20px;text-align:center;border-top:1px solid #eee;">
      <div style="color:#666;font-size:12px;font-family:Arial,sans-serif;margin-bottom:5px;">Con cariño, el equipo de <strong>PRODE Caballito</strong> ❤️</div>
      <div style="color:#aaa;font-size:10px;font-family:Arial,sans-serif;">Si no querés recibir más correos, podés <a href="https://prodecaballito.com" style="color:#aaa;text-decoration:underline;">darte de baja aquí</a>.</div>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>
  `;
    await (0, exports.sendEmail)({
        to: email,
        subject: `🔥 ¡${nombre}, el Mundial 2026 arranca — ya sos parte del PRODE!`,
        html,
    });
};
exports.sendWelcomeEmail = sendWelcomeEmail;
const sendVerificationCode = async (email, nombre, code) => {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificación - PRODE Caballito</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0042A5 0%, #001A4B 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 28px;">⚽ PRODE Caballito</h1>
      <p style="color: #FFDF00; margin: 10px 0 0 0; font-size: 14px;">⚡ Mundial 2026</p>
    </div>
    <div style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <h2 style="color: #1F2937; margin-top: 0;">¡Hola ${nombre}! 👋</h2>
      <p style="color: #4B5563; line-height: 1.6;">
        Gracias por registrarte en PRODE Caballito. Para completar tu registro, 
        usa el siguiente código de verificación:
      </p>
      <div style="background: linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%); padding: 30px; margin: 30px 0; text-align: center; border-radius: 12px; border: 3px dashed #0042A5;">
        <p style="color: #6B7280; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">
          Tu Código
        </p>
        <div style="font-size: 42px; font-weight: bold; color: #0042A5; letter-spacing: 12px; font-family: 'Courier New', monospace;">
          ${code}
        </div>
      </div>
      <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 6px;">
        <p style="color: #92400E; margin: 0; font-size: 14px;">
          ⏱️ <strong>Este código expira en 15 minutos.</strong>
        </p>
      </div>
      <p style="color: #4B5563; line-height: 1.6; margin-top: 30px;">
        Si no solicitaste este código, puedes ignorar este email.
      </p>
    </div>
    <div style="text-align: center; padding: 20px; color: #9CA3AF; font-size: 12px;">
      <p style="margin: 5px 0;">© 2026 PRODE Caballito - Qatar 2026</p>
      <p style="margin: 5px 0;">Este es un email automático, por favor no respondas.</p>
    </div>
  </div>
</body>
</html>
  `;
    await (0, exports.sendEmail)({
        to: email,
        subject: '🎯 Código de Verificación - PRODE Caballito',
        html,
    });
};
exports.sendVerificationCode = sendVerificationCode;

const sendReminderEmail = async (reminder) => {
    const { user_email, user_nombre, home_team, away_team, start_time, time_cutoff, goles_local, goles_visitante, remind_minutes } = reminder;
    const hasBet = goles_local != null && goles_visitante != null;

    const fmtAR = (d) => new Date(d).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit'
    });

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#001A4B;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#001A4B">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td align="center" style="padding-bottom:24px;">
        <p style="margin:0;font-size:40px;line-height:1;">⏰</p>
        <h1 style="color:#ffffff;margin:10px 0 0;font-size:26px;font-weight:800;font-family:Arial,sans-serif;">PRODE Caballito</h1>
        <p style="color:#FFDF00;margin:6px 0 0;font-size:14px;font-weight:600;font-family:Arial,sans-serif;">
          Recordatorio — ${remind_minutes} min antes del partido
        </p>
      </td></tr>

      <!-- Main card -->
      <tr><td style="background-color:#ffffff;border-radius:20px;overflow:hidden;">

        <!-- Yellow banner -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td bgcolor="#FFCC00" align="center" style="padding:32px 30px;border-radius:20px 20px 0 0;">
            <p style="margin:0 0 6px;color:#001A4B;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Próximo partido</p>
            <h2 style="color:#001A4B;margin:0;font-size:26px;font-weight:900;font-family:Arial,sans-serif;">${home_team} vs ${away_team}</h2>
            <p style="color:#0042A5;margin:10px 0 0;font-size:15px;font-weight:700;font-family:Arial,sans-serif;">🕐 ${fmtAR(start_time)} hs</p>
          </td></tr>
        </table>

        <!-- Body -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:32px 30px;">

            <p style="color:#374151;font-size:16px;margin:0 0 16px;font-family:Arial,sans-serif;">
              ¡Hola <strong>${user_nombre}</strong>! 👋
            </p>
            <p style="color:#4B5563;font-size:15px;line-height:1.7;margin:0 0 24px;font-family:Arial,sans-serif;">
              El partido <strong>${home_team} vs ${away_team}</strong> comienza en
              <strong>${remind_minutes} minutos</strong>.
              Las apuestas cierran a las <strong>${fmtAR(time_cutoff)} hs</strong>.
            </p>

            ${hasBet ? `
            <!-- Tu pronóstico -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EFF6FF" style="border-radius:14px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;border-left:4px solid #0042A5;border-radius:14px;">
                <p style="color:#0042A5;margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">Tu pronóstico guardado</p>
                <p style="color:#001A4B;margin:0;font-size:30px;font-weight:900;text-align:center;font-family:Arial,sans-serif;">
                  ${home_team} <span style="color:#0042A5;">${goles_local} — ${goles_visitante}</span> ${away_team}
                </p>
              </td></tr>
            </table>
            ` : `
            <!-- Sin pronóstico -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FEF3C7" style="border-radius:14px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;border-left:4px solid #F59E0B;border-radius:14px;">
                <p style="color:#92400E;margin:0;font-size:15px;font-weight:700;font-family:Arial,sans-serif;">⚠️ Todavía no cargaste tu pronóstico para este partido.</p>
                <p style="color:#B45309;margin:8px 0 0;font-size:13px;font-family:Arial,sans-serif;">Tenés hasta las ${fmtAR(time_cutoff)} hs para apostar.</p>
              </td></tr>
            </table>
            `}

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="https://prodecaballito.com/apuestas"
                   style="display:inline-block;background-color:#0042A5;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:50px;font-size:17px;font-weight:700;font-family:Arial,sans-serif;">
                  ⚽ Ver mis pronósticos
                </a>
              </td></tr>
            </table>

            <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;font-family:Arial,sans-serif;">
              Con cariño, el equipo de <strong>PRODE Caballito</strong> 💙
            </p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding-top:20px;">
        <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0;font-family:Arial,sans-serif;">
          © 2026 PRODE Caballito · <a href="https://prodecaballito.com" style="color:rgba(255,255,255,0.6);text-decoration:none;">prodecaballito.com</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    await (0, exports.sendEmail)({
        to: user_email,
        subject: `⏰ En ${remind_minutes} min: ${home_team} vs ${away_team} — PRODE Caballito`,
        html,
    });
};
exports.sendReminderEmail = sendReminderEmail;

const sendResultEmail = async ({ userEmail, userName, homeTeam, awayTeam, resultLocal, resultVisitante, betLocal, betVisitante, puntos, rankingPos }) => {
    const fmtAR = (d) => new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' });
    const hasBet = betLocal != null && betVisitante != null;
    const colorMap = { 4: '#1D4ED8', 3: '#DC2626', 2: '#16A34A', 1: '#D97706', 0: '#6B7280' };
    const labelMap = { 4: '¡Exacto + bonus! 🔥', 3: 'Exacto 🎯', 2: 'Parcialmente exacto ✅', 1: 'Ganador correcto 👍', 0: 'Sin puntos ❌' };
    const ptsColor = colorMap[puntos] || '#6B7280';
    const ptsLabel = labelMap[puntos] || '';

    const betPanel = hasBet ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
        <tr><td style="background:#EFF6FF;border-radius:10px;padding:16px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;color:#1E40AF;font-family:Arial,sans-serif;">Tu pronóstico</p>
          <p style="margin:0;font-size:28px;font-weight:900;color:${ptsColor};font-family:Arial,sans-serif;">${betLocal} — ${betVisitante}</p>
          <p style="margin:6px 0 0;font-size:14px;font-weight:bold;color:${ptsColor};font-family:Arial,sans-serif;">${ptsLabel} &nbsp;·&nbsp; +${puntos} pts</p>
        </td></tr>
      </table>` : `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
        <tr><td style="background:#FEF3C7;border-radius:10px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:14px;color:#92400E;font-family:Arial,sans-serif;">No tenías pronóstico en este partido</p>
        </td></tr>
      </table>`;

    const rankingPanel = rankingPos ? `
      <p style="text-align:center;font-size:14px;color:#374151;font-family:Arial,sans-serif;margin:0 0 20px;">
        🏆 Estás <strong>#${rankingPos}</strong> en el ranking
      </p>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <!-- Header -->
      <tr><td style="background-color:#001A4B;padding:28px 32px;text-align:center;">
        <p style="margin:0;font-size:24px;font-weight:900;color:#FFFFFF;font-family:Arial,sans-serif;letter-spacing:1px;">⚽ PRODE Caballito</p>
        <p style="margin:6px 0 0;font-size:13px;color:#93C5FD;font-family:Arial,sans-serif;">Resultado publicado</p>
      </td></tr>
      <!-- Score banner -->
      <tr><td style="background-color:#FFCC00;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:13px;font-weight:bold;color:#78350F;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;">${homeTeam} vs ${awayTeam}</p>
        <p style="margin:8px 0 0;font-size:48px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;letter-spacing:4px;">${resultLocal} — ${resultVisitante}</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="background-color:#FFFFFF;padding:28px 32px;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:#001A4B;font-family:Arial,sans-serif;">Hola, ${userName}!</p>
        <p style="margin:0 0 16px;font-size:14px;color:#6B7280;font-family:Arial,sans-serif;">Ya podés ver cuántos puntos sumaste en este partido.</p>
        ${betPanel}
        ${rankingPanel}
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center">
            <a href="https://prodecaballito.com/ranking" style="display:inline-block;background-color:#0042A5;color:#FFFFFF;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;padding:14px 32px;border-radius:50px;">Ver ranking completo →</a>
          </td></tr>
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:Arial,sans-serif;">prodecaballito.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    await sendEmail({
        to: userEmail,
        subject: `⚽ Resultado: ${homeTeam} ${resultLocal}-${resultVisitante} ${awayTeam} — PRODE Caballito`,
        html,
    });
};
exports.sendResultEmail = sendResultEmail;

const sendNewLeaderEmail = async ({ userEmail, userName, puntos, homeTeam, awayTeam, resultLocal, resultVisitante }) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <!-- Header -->
      <tr><td style="background-color:#001A4B;padding:32px 32px 24px;text-align:center;">
        <p style="margin:0;font-size:48px;line-height:1;">🔥</p>
        <p style="margin:10px 0 4px;font-size:22px;font-weight:900;color:#FFCC00;font-family:Arial,sans-serif;letter-spacing:1px;">¡NUEVO LÍDER!</p>
        <p style="margin:0;font-size:13px;color:#93C5FD;font-family:Arial,sans-serif;">PRODE Caballito</p>
      </td></tr>
      <!-- Banner resultado -->
      <tr><td style="background-color:#FFCC00;padding:14px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:bold;color:#78350F;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;">⚽ ${homeTeam} ${resultLocal}–${resultVisitante} ${awayTeam}</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="background-color:#FFFFFF;padding:32px 32px 28px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;">¡Hola, ${userName}! 👋</p>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;font-family:Arial,sans-serif;line-height:1.6;">
          Después del resultado de hoy, <strong>subiste al primer puesto</strong> del ranking de PRODE Caballito. ¡Bien jugado!
        </p>
        <!-- Podio card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr><td style="background:linear-gradient(135deg,#001A4B 0%,#0042A5 100%);border-radius:14px;padding:24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#93C5FD;font-family:Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;">Posición actual</p>
            <p style="margin:0;font-size:56px;font-weight:900;color:#FFCC00;font-family:Arial,sans-serif;line-height:1;">🥇</p>
            <p style="margin:6px 0 0;font-size:20px;font-weight:900;color:#FFFFFF;font-family:Arial,sans-serif;">${puntos} puntos</p>
            <p style="margin:4px 0 0;font-size:13px;color:#93C5FD;font-family:Arial,sans-serif;">Puesto #1 del ranking</p>
          </td></tr>
        </table>
        <p style="margin:0 0 24px;font-size:14px;color:#6B7280;font-family:Arial,sans-serif;text-align:center;line-height:1.5;">
          Seguí apostando para mantener el liderazgo.<br>Los demás están cerca 👀
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center">
            <a href="https://prodecaballito.com/ranking" style="display:inline-block;background-color:#0042A5;color:#FFFFFF;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;padding:14px 36px;border-radius:50px;">Ver el ranking completo →</a>
          </td></tr>
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:Arial,sans-serif;">prodecaballito.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    await sendEmail({
        to: userEmail,
        subject: `🔥 ¡Sos el nuevo líder del PRODE Caballito con ${puntos} pts!`,
        html,
    });
};
exports.sendNewLeaderEmail = sendNewLeaderEmail;

// ── Weekly summary email ─────────────────────────────────────────────────────

const TEAM_FLAGS = {
    'argentina': '🇦🇷', 'brasil': '🇧🇷', 'brazil': '🇧🇷',
    'france': '🇫🇷', 'francia': '🇫🇷',
    'spain': '🇪🇸', 'españa': '🇪🇸',
    'germany': '🇩🇪', 'alemania': '🇩🇪',
    'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'italy': '🇮🇹', 'italia': '🇮🇹',
    'portugal': '🇵🇹',
    'netherlands': '🇳🇱', 'holanda': '🇳🇱', 'países bajos': '🇳🇱',
    'croatia': '🇭🇷', 'croacia': '🇭🇷',
    'morocco': '🇲🇦', 'marruecos': '🇲🇦',
    'usa': '🇺🇸', 'estados unidos': '🇺🇸', 'united states': '🇺🇸',
    'canada': '🇨🇦', 'canadá': '🇨🇦',
    'mexico': '🇲🇽', 'méxico': '🇲🇽',
    'japan': '🇯🇵', 'japón': '🇯🇵',
    'south korea': '🇰🇷', 'corea del sur': '🇰🇷', 'corea': '🇰🇷',
    'senegal': '🇸🇳', 'ecuador': '🇪🇨', 'uruguay': '🇺🇾',
    'colombia': '🇨🇴', 'chile': '🇨🇱', 'peru': '🇵🇪', 'perú': '🇵🇪',
    'bolivia': '🇧🇴', 'venezuela': '🇻🇪', 'paraguay': '🇵🇾',
    'switzerland': '🇨🇭', 'suiza': '🇨🇭',
    'belgium': '🇧🇪', 'bélgica': '🇧🇪',
    'poland': '🇵🇱', 'polonia': '🇵🇱',
    'denmark': '🇩🇰', 'dinamarca': '🇩🇰',
    'austria': '🇦🇹', 'sweden': '🇸🇪', 'suecia': '🇸🇪',
    'norway': '🇳🇴', 'noruega': '🇳🇴',
    'jordan': '🇯🇴', 'jordania': '🇯🇴',
    'nigeria': '🇳🇬', 'ghana': '🇬🇭', 'cameroon': '🇨🇲', 'camerún': '🇨🇲',
    'saudi arabia': '🇸🇦', 'arabia saudita': '🇸🇦',
    'iran': '🇮🇷', 'australia': '🇦🇺', 'new zealand': '🇳🇿',
    'turkey': '🇹🇷', 'turquía': '🇹🇷',
    'serbia': '🇷🇸', 'ukraine': '🇺🇦', 'ucrania': '🇺🇦',
    'czech republic': '🇨🇿', 'república checa': '🇨🇿',
    'romania': '🇷🇴', 'rumania': '🇷🇴',
    'hungary': '🇭🇺', 'hungría': '🇭🇺',
    'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'gales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
};

function getTeamFlag(team) {
    if (!team) return '⚽';
    return TEAM_FLAGS[team.toLowerCase().trim()] || '⚽';
}

function buildTightMatchSection(tightMatch) {
    if (!tightMatch || tightMatch.resultado_local == null) return '';
    const homeFlag = getTeamFlag(tightMatch.home_team);
    const awayFlag = getTeamFlag(tightMatch.away_team);
    const hits = parseInt(tightMatch.exact_hits) || 0;
    const hitsText = hits === 0
        ? '¡Nadie acertó el resultado exacto!'
        : hits === 1
            ? 'Solo 1 jugador acertó el resultado exacto'
            : `Solo ${hits} jugadores acertaron el resultado exacto`;

    return `
      <tr>
        <td style="padding:0 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:12px 18px;border-bottom:1px solid #f3f4f6;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">🔥 Partido más reñido de la semana</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#ffffff" style="padding:24px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="27%" align="center">
                      <p style="margin:0;font-size:36px;line-height:1;">${homeFlag}</p>
                      <p style="margin:6px 0 0;font-size:12px;font-weight:700;color:#374151;font-family:Arial,sans-serif;">${tightMatch.home_team}</p>
                    </td>
                    <td width="22%" align="center">
                      <p style="margin:0;font-size:40px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;letter-spacing:2px;line-height:1;">${tightMatch.resultado_local} - ${tightMatch.resultado_visitante}</p>
                    </td>
                    <td width="27%" align="center">
                      <p style="margin:0;font-size:36px;line-height:1;">${awayFlag}</p>
                      <p style="margin:6px 0 0;font-size:12px;font-weight:700;color:#374151;font-family:Arial,sans-serif;">${tightMatch.away_team}</p>
                    </td>
                    <td width="24%" style="padding-left:12px;border-left:1px solid #e5e7eb;vertical-align:middle;">
                      <p style="margin:0;font-size:12px;font-weight:700;color:#2563eb;font-family:Arial,sans-serif;line-height:1.4;">${hitsText}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

function buildUpcomingSection(upcomingMatches, appUrl) {
    if (!upcomingMatches || upcomingMatches.length === 0) return '';
    const cards = upcomingMatches.map((m, i) => {
        const homeFlag = getTeamFlag(m.home_team);
        const awayFlag = getTeamFlag(m.away_team);
        const d = new Date(m.start_time);
        const dateStr = d.toLocaleDateString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            weekday: 'short', day: 'numeric', month: 'numeric',
        });
        const timeStr = d.toLocaleTimeString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            hour: '2-digit', minute: '2-digit',
        });
        const badgeHtml = m.badge ? `
              <tr>
                <td bgcolor="#FEF3C7" style="padding:5px 16px;">
                  <p style="margin:0;font-size:11px;font-weight:700;color:#92400E;font-family:Arial,sans-serif;">${m.badge}</p>
                </td>
              </tr>` : '';
        const bottomPad = i < upcomingMatches.length - 1 ? 'padding:0 0 10px;' : 'padding:0;';
        return `
        <tr>
          <td style="${bottomPad}">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              ${badgeHtml}
              <tr>
                <td bgcolor="#FFF8F0" style="padding:16px 16px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:22px;line-height:1;width:28px;">${homeFlag}</td>
                      <td style="padding:0 10px;font-family:Arial,sans-serif;">
                        <p style="margin:0;font-size:13px;font-weight:700;color:#111827;">${m.home_team} vs ${m.away_team}</p>
                        <p style="margin:3px 0 0;font-size:11px;color:#6b7280;">${dateStr} &middot; ${timeStr} hs</p>
                      </td>
                      <td align="right" style="width:90px;">
                        <a href="${appUrl}" style="display:inline-block;background-color:#FFCC00;color:#001A4B;font-size:13px;font-weight:900;text-decoration:none;padding:10px 16px;border-radius:20px;font-family:Arial,sans-serif;white-space:nowrap;">Apostar →</a>
                      </td>
                      <td style="font-size:22px;line-height:1;width:28px;text-align:right;padding-left:8px;">${awayFlag}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }).join('');

    return `
      <tr>
        <td style="padding:0 24px 24px;">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;font-family:Arial,sans-serif;">⚽ Próximos partidos para pronosticar</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${cards}
          </table>
        </td>
      </tr>`;
}

const sendWeeklyEmail = async (email, {
    userName, weekDate, userPosition, totalPlayers,
    userPoints, bestRound, bestRoundPoints,
    diferenciaPuntos = 0, pendingBets = 0,
    tightMatch, upcomingMatches, appUrl, unsubscribeUrl,
}) => {
    const tightMatchHtml = buildTightMatchSection(tightMatch);
    const upcomingHtml = buildUpcomingSection(upcomingMatches, appUrl);

    const pendingBadge = pendingBets > 0
        ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
            <tr>
              <td bgcolor="#FFCC00" style="padding:9px 18px;border-radius:20px;">
                <p style="margin:0;font-size:13px;font-weight:700;color:#001A4B;font-family:Arial,sans-serif;">⚡ Tenés ${pendingBets} pronóstico${pendingBets !== 1 ? 's' : ''} pendiente${pendingBets !== 1 ? 's' : ''} para esta fecha</p>
              </td>
            </tr>
          </table>`
        : '';

    const diferencia = userPosition <= 5
        ? `<p style="margin:3px 0 0;font-size:14px;color:#059669;font-family:Arial,sans-serif;font-weight:700;">🏆 ¡Estás en el top 5!</p>`
        : `<p style="margin:3px 0 0;font-size:14px;color:#6b7280;font-family:Arial,sans-serif;">Estás a <strong style="color:#DC2626;">${diferenciaPuntos} pts</strong> del top 5.</p>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu resumen semanal — PRODE Caballito</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f7">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">

        <!-- HEADER -->
        <tr>
          <td bgcolor="#ffffff" style="padding:18px 24px;border-bottom:1px solid #f0f4fb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="font-size:22px;vertical-align:middle;">⚽</span>
                  <strong style="font-size:17px;color:#001A4B;font-family:Arial,sans-serif;vertical-align:middle;"> PRODE Caballito</strong>
                </td>
                <td align="right">
                  <p style="margin:0;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;">Resumen semanal</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#374151;font-weight:700;font-family:Arial,sans-serif;">${weekDate}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HERO: background-image con gradiente oscuro overlay -->
        <tr>
          <td bgcolor="#001A4B" style="background:linear-gradient(to bottom,rgba(0,10,50,0.42) 0%,rgba(0,10,70,0.90) 100%),url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=90&fit=crop&h=360') center/cover no-repeat;padding:72px 28px 42px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#FFCC00;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:2.5px;">MUNDIAL 2026</p>
            <h1 style="margin:0;font-size:34px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;line-height:1.1;text-transform:uppercase;">ARRANCA UNA NUEVA SEMANA</h1>
            <h1 style="margin:4px 0 18px;font-size:34px;font-weight:900;color:#FFCC00;font-family:Arial,sans-serif;line-height:1.1;text-transform:uppercase;">DE MUNDIAL</h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.82);font-family:Arial,sans-serif;">Así viene tu prode y lo que se juega esta semana.</p>
            ${pendingBadge}
          </td>
        </tr>

        <!-- PERSONALIZATION -->
        <tr>
          <td style="padding:22px 24px 0;">
            <p style="margin:0 0 2px;font-size:16px;color:#111827;font-family:Arial,sans-serif;font-weight:600;">Hola, <strong style="color:#001A4B;">${userName}</strong> 👋</p>
            <p style="margin:0 0 2px;font-size:14px;color:#6b7280;font-family:Arial,sans-serif;">Estás <strong style="color:#001A4B;">${userPosition}°</strong> de ${totalPlayers} jugadores.</p>
            ${diferencia}
          </td>
        </tr>

        <!-- STATS: 3 cards -->
        <tr>
          <td style="padding:18px 24px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="31%" align="center" bgcolor="#f8faff" style="padding:22px 8px;border-radius:12px;">
                  <p style="margin:0;font-size:28px;line-height:1;">🏆</p>
                  <p style="margin:10px 0 2px;font-size:36px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;line-height:1;">${userPosition}°</p>
                  <p style="margin:0;font-size:10px;color:#6b7280;font-family:Arial,sans-serif;line-height:1.5;text-transform:uppercase;letter-spacing:0.3px;">Tu posición<br>de ${totalPlayers}</p>
                </td>
                <td width="4%"></td>
                <td width="31%" align="center" bgcolor="#f8faff" style="padding:22px 8px;border-radius:12px;">
                  <p style="margin:0;font-size:28px;line-height:1;">🎯</p>
                  <p style="margin:10px 0 2px;font-size:36px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;line-height:1;">${userPoints} <span style="font-size:18px;font-weight:700;">pts</span></p>
                  <p style="margin:0;font-size:10px;color:#6b7280;font-family:Arial,sans-serif;line-height:1.5;text-transform:uppercase;letter-spacing:0.3px;">Tus puntos</p>
                </td>
                <td width="4%"></td>
                <td width="31%" align="center" bgcolor="#f8faff" style="padding:22px 8px;border-radius:12px;">
                  <p style="margin:0;font-size:28px;line-height:1;">📅</p>
                  <p style="margin:10px 0 2px;font-size:22px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;line-height:1;">${bestRound}</p>
                  <p style="margin:0;font-size:10px;color:#6b7280;font-family:Arial,sans-serif;line-height:1.5;text-transform:uppercase;letter-spacing:0.3px;">Tu mejor fecha<br>(${bestRoundPoints} pts)</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${tightMatchHtml}

        ${upcomingHtml}

        <!-- CTA PRINCIPAL -->
        <tr>
          <td style="padding:4px 24px 32px;">
            <a href="${appUrl}" style="display:block;background-color:#001A4B;color:#ffffff;text-decoration:none;padding:18px 32px;border-radius:10px;font-size:16px;font-weight:700;font-family:Arial,sans-serif;text-align:center;">
              Completá tus pronósticos ahora →
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td align="center" bgcolor="#f9fafb" style="padding:22px 24px 26px;border-top:1px solid #f0f4fb;">
            <p style="margin:0;font-size:13px;color:#4b5563;font-family:Arial,sans-serif;line-height:1.7;">
              Gracias por jugar en <strong>PRODE Caballito</strong> 💙<br>Esta semana puede ser la tuya.
            </p>
            <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;">
              <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Cancelar suscripción</a>
              &nbsp;&middot;&nbsp;
              <a href="https://prodecaballito.com" style="color:#9ca3af;text-decoration:none;">prodecaballito.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await (0, exports.sendEmail)({
        to: email,
        subject: `⚽ Tu resumen semanal — PRODE Caballito`,
        html,
    });
};
exports.sendWeeklyEmail = sendWeeklyEmail;

// ── Post-matchday summary email ──────────────────────────────────────────────

const sendPostMatchdayEmail = async ({ userEmail, userName, matchdayName, points, rankInMatchday, globalPosition, topName, topPoints, totalPlanillas }) => {
    const posEmoji = rankInMatchday === 1 ? '🥇' : rankInMatchday === 2 ? '🥈' : rankInMatchday === 3 ? '🥉' : `#${rankInMatchday}`;
    const globalStr = globalPosition != null ? `Estás #${globalPosition} en el ranking general.` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <!-- Header -->
      <tr><td style="background-color:#001A4B;padding:32px 32px 24px;text-align:center;">
        <p style="margin:0;font-size:40px;line-height:1;">🏁</p>
        <p style="margin:10px 0 4px;font-size:20px;font-weight:900;color:#FFCC00;font-family:Arial,sans-serif;letter-spacing:1px;">${matchdayName} — CERRADA</p>
        <p style="margin:0;font-size:13px;color:#93C5FD;font-family:Arial,sans-serif;">PRODE Caballito</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="background-color:#FFFFFF;padding:32px 32px 28px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;">¡Hola, ${userName}! 👋</p>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;font-family:Arial,sans-serif;line-height:1.6;">
          Así quedaron tus resultados en <strong>${matchdayName}</strong>:
        </p>
        <!-- Score card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr>
            <td width="50%" style="padding:4px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFF6FF;border-radius:12px;padding:16px;text-align:center;">
                <tr><td>
                  <p style="margin:0;font-size:11px;color:#3B82F6;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Tus puntos</p>
                  <p style="margin:4px 0 0;font-size:36px;font-weight:900;color:#1D4ED8;font-family:Arial,sans-serif;">${points}</p>
                </td></tr>
              </table>
            </td>
            <td width="50%" style="padding:4px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0FDF4;border-radius:12px;padding:16px;text-align:center;">
                <tr><td>
                  <p style="margin:0;font-size:11px;color:#16A34A;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Tu posición en la fecha</p>
                  <p style="margin:4px 0 0;font-size:36px;font-weight:900;color:#15803D;font-family:Arial,sans-serif;">${posEmoji}</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
        ${globalStr ? `<p style="margin:0 0 12px;font-size:14px;color:#6B7280;font-family:Arial,sans-serif;text-align:center;">${globalStr}</p>` : ''}
        <!-- Top performer -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 24px;background:#FFF7ED;border-radius:12px;padding:16px;">
          <tr><td style="text-align:center;">
            <p style="margin:0;font-size:12px;color:#EA580C;font-family:Arial,sans-serif;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Top de la fecha</p>
            <p style="margin:6px 0 0;font-size:16px;font-weight:900;color:#9A3412;font-family:Arial,sans-serif;">🏆 ${topName} — ${topPoints} pts</p>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center">
            <a href="https://prodecaballito.com/ranking" style="display:inline-block;background-color:#0042A5;color:#FFFFFF;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;padding:14px 36px;border-radius:50px;">Ver el ranking completo →</a>
          </td></tr>
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:Arial,sans-serif;">prodecaballito.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    await sendEmail({
        to: userEmail,
        subject: `🏁 ${matchdayName} cerrada — Hiciste ${points} pts`,
        html,
    });
};
exports.sendPostMatchdayEmail = sendPostMatchdayEmail;

const sendPlanillaCierreEmail = async ({ userEmail, userName, planillaNombre, torneoName, matches }) => {
    const totalMatches = matches.length;
    const completedBets = matches.filter(m => m.goles_local != null && m.goles_visitante != null).length;
    const isComplete = completedBets === totalMatches;

    const subject = isComplete
        ? `✅ Tu planilla "${planillaNombre}" está lista para ${torneoName}`
        : `⚠️ Tu planilla "${planillaNombre}" cerró con ${totalMatches - completedBets} pronóstico${totalMatches - completedBets === 1 ? '' : 's'} sin cargar`;

    const rows = matches.map(m => {
        const bet = m.goles_local != null && m.goles_visitante != null
            ? `${m.goles_local}-${m.goles_visitante}`
            : '—';
        return `<tr style="border-bottom:1px solid #E5E7EB;">
          <td style="padding:10px 12px;font-size:13px;color:#111827;font-family:Arial,sans-serif;">${m.home_team} vs ${m.away_team}</td>
          <td style="padding:10px 12px;font-size:13px;text-align:center;font-weight:bold;color:${bet === '—' ? '#9CA3AF' : '#001A4B'};font-family:Arial,sans-serif;">${bet}</td>
        </tr>`;
    }).join('');

    const headerColor = isComplete ? '#166534' : '#92400E';
    const headerBg = isComplete ? '#DCFCE7' : '#FEF3C7';
    const headerEmoji = isComplete ? '✅' : '⚠️';
    const headerLabel = isComplete ? 'PLANILLA CONFIRMADA' : 'PLANILLA CON PRONÓSTICOS FALTANTES';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <tr><td style="background-color:#001A4B;padding:28px 32px 20px;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:900;color:#FFFFFF;font-family:Arial,sans-serif;">⚽ PRODE Caballito</p>
        <p style="margin:6px 0 0;font-size:13px;color:#93C5FD;font-family:Arial,sans-serif;">${torneoName}</p>
      </td></tr>
      <tr><td style="background-color:${headerBg};padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:15px;font-weight:900;color:${headerColor};font-family:Arial,sans-serif;">${headerEmoji} ${headerLabel}</p>
        <p style="margin:4px 0 0;font-size:13px;color:${headerColor};font-family:Arial,sans-serif;">Cargaste ${completedBets} de ${totalMatches} pronósticos</p>
      </td></tr>
      <tr><td style="background-color:#FFFFFF;padding:28px 32px;">
        <p style="margin:0 0 16px;font-size:16px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;">Hola ${userName} 👋</p>
        <p style="margin:0 0 20px;font-size:14px;color:#374151;font-family:Arial,sans-serif;line-height:1.6;">
          ${isComplete
            ? `Tu planilla <strong>"${planillaNombre}"</strong> está lista. Este es tu resumen de pronósticos para ${torneoName}.`
            : `El torneo cerró. Te dejamos el resumen de tu planilla <strong>"${planillaNombre}"</strong>. Los pronósticos con <strong>—</strong> no estaban cargados al cierre.`}
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#E5E7EB;border-radius:8px;overflow:hidden;">
          <tr style="background-color:#F9FAFB;">
            <th style="padding:10px 12px;font-size:12px;font-weight:bold;color:#6B7280;text-align:left;font-family:Arial,sans-serif;">PARTIDO</th>
            <th style="padding:10px 12px;font-size:12px;font-weight:bold;color:#6B7280;text-align:center;font-family:Arial,sans-serif;">TU PRONÓSTICO</th>
          </tr>
          ${rows}
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
          <tr><td align="center">
            <a href="https://prodecaballito.com/planillas" style="display:inline-block;background-color:#001A4B;color:#FFFFFF;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;padding:14px 36px;border-radius:50px;">Ver mi planilla →</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="background-color:#F8FAFC;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:Arial,sans-serif;">prodecaballito.com · Este es tu resumen de planilla al cierre del torneo</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    await sendEmail({ to: userEmail, subject, html });
};
exports.sendPlanillaCierreEmail = sendPlanillaCierreEmail;
//# sourceMappingURL=email.js.map