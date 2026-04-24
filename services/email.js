"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRankingUpdateEmail = exports.sendVerificationCode = exports.sendWelcomeEmail = exports.sendEmail = void 0;
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
        <p>Ver todos los resultados en: <a href="https://d2vjb37mnj30m1.cloudfront.net/ranking">PRODE Caballito</a></p>
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
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenido! - PRODE Caballito</title>
</head>
<body style="margin: 0; padding: 0; background-color: #001A4B; font-family: Arial, Helvetica, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#001A4B">
  <tr>
    <td align="center" style="padding: 40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding-bottom: 28px;">
            <p style="margin: 0; font-size: 42px; line-height: 1;">⚽</p>
            <h1 style="color: #ffffff; margin: 12px 0 0 0; font-size: 28px; font-weight: 800; font-family: Arial, sans-serif;">¡BIENVENIDO A PRODE!</h1>
            <p style="color: #FFDF00; margin: 8px 0 0 0; font-size: 16px; font-weight: 600; font-family: Arial, sans-serif;">🔥 Mundial 2026 · USA · Canadá · México 🔥</p>
          </td>
        </tr>

        <!-- Main Card -->
        <tr>
          <td style="background-color: #ffffff; border-radius: 20px; overflow: hidden;">

            <!-- Celebration banner (yellow) -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#FFCC00" align="center" style="padding: 36px 30px; border-radius: 20px 20px 0 0;">
                  <p style="margin: 0 0 12px 0; font-size: 52px; line-height: 1;">🎉</p>
                  <h2 style="color: #001A4B; margin: 0; font-size: 24px; font-weight: 800; font-family: Arial, sans-serif;">¡${nombre} ya sos parte del PRODE!</h2>
                  <p style="color: #0042A5; margin: 10px 0 0 0; font-size: 15px; font-family: Arial, sans-serif;">Tu cuenta fue activada exitosamente</p>
                </td>
              </tr>
            </table>

            <!-- Body content -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 36px 30px;">

                  <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 16px 0; font-family: Arial, sans-serif;">
                    ¡Hola <strong>${nombre}</strong>! 👋
                  </p>
                  <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 28px 0; font-family: Arial, sans-serif;">
                    ¡Bienvenido al <strong style="color: #0042A5;">PRODE Caballito</strong>!
                    El Mundial 2026 llega a USA, Canadá y México — y vos ya sos parte de la acción.
                    Apostá, acumulá puntos y <strong style="color: #E07B00;">¡subí al primer puesto del ranking!</strong>
                  </p>

                  <!-- How to Play -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F9FAFB" style="border-radius: 14px; margin-bottom: 28px;">
                    <tr>
                      <td style="padding: 24px;">
                        <p style="color: #0042A5; margin: 0 0 18px 0; font-size: 17px; font-weight: 700; font-family: Arial, sans-serif;">🚀 ¿Cómo empezar?</p>

                        <!-- Step 1 -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
                          <tr>
                            <td width="38" valign="top">
                              <div style="background-color: #0042A5; color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; font-size: 13px; font-weight: bold; line-height: 28px; font-family: Arial, sans-serif;">1</div>
                            </td>
                            <td valign="top">
                              <p style="color: #1F2937; margin: 0 0 4px 0; font-weight: 700; font-family: Arial, sans-serif;">Apostá en los partidos</p>
                              <p style="color: #6B7280; margin: 0; font-size: 13px; font-family: Arial, sans-serif;">Elegí los resultados de cada partido del mundial</p>
                            </td>
                          </tr>
                        </table>

                        <!-- Step 2 -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
                          <tr>
                            <td width="38" valign="top">
                              <div style="background-color: #0042A5; color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; font-size: 13px; font-weight: bold; line-height: 28px; font-family: Arial, sans-serif;">2</div>
                            </td>
                            <td valign="top">
                              <p style="color: #1F2937; margin: 0 0 4px 0; font-weight: 700; font-family: Arial, sans-serif;">Acumulá puntos</p>
                              <p style="color: #6B7280; margin: 0; font-size: 13px; font-family: Arial, sans-serif;">Cada acierto te acerca al primer puesto del ranking</p>
                            </td>
                          </tr>
                        </table>

                        <!-- Step 3 -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td width="38" valign="top">
                              <div style="background-color: #FFCC00; color: #001A4B; width: 28px; height: 28px; border-radius: 50%; text-align: center; font-size: 13px; font-weight: bold; line-height: 28px; font-family: Arial, sans-serif;">3</div>
                            </td>
                            <td valign="top">
                              <p style="color: #1F2937; margin: 0 0 4px 0; font-weight: 700; font-family: Arial, sans-serif;">¡Ganá premios!</p>
                              <p style="color: #6B7280; margin: 0; font-size: 13px; font-family: Arial, sans-serif;">Los mejores del ranking se llevan premios increíbles</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                    <tr>
                      <td align="center">
                        <a href="https://prodecaballito.com/apuestas" style="display: inline-block; background-color: #0042A5; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 17px; font-weight: 700; font-family: Arial, sans-serif;">
                          ⚽ ¡Ver Partidos y Apostar!
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Good Luck -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#DCFCE7" style="border-radius: 14px; margin-bottom: 20px;">
                    <tr>
                      <td align="center" style="padding: 24px;">
                        <p style="margin: 0 0 8px 0; font-size: 36px; line-height: 1;">🍀</p>
                        <h3 style="color: #166534; margin: 0 0 8px 0; font-size: 18px; font-family: Arial, sans-serif;">¡Que empiece el juego!</h3>
                        <p style="color: #15803D; margin: 0; font-size: 14px; font-family: Arial, sans-serif;">
                          Cada partido es una oportunidad. Cada pronóstico, un paso hacia la gloria.<br>¡El ranking te espera — mostrá de qué estás hecho!
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin: 20px 0 0 0; font-family: Arial, sans-serif;">
                    Con cariño, el equipo de <strong>PRODE Caballito</strong> 💙
                  </p>

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top: 24px;">
            <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 6px 0; font-family: Arial, sans-serif;">© 2026 PRODE Caballito · Mundial 2026</p>
            <a href="https://prodecaballito.com" style="color: rgba(255,255,255,0.7); font-size: 12px; text-decoration: none; font-family: Arial, sans-serif;">www.prodecaballito.com</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
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
            ? '¡Solo 1 jugador acertó el resultado exacto!'
            : `¡Solo ${hits} jugadores acertaron el resultado exacto!`;

    return `
      <tr>
        <td style="padding: 0 28px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f9fafb" style="border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #eef2f8;">
                <p style="margin:0;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;">🔥 PARTIDO MÁS REÑIDO DE LA SEMANA</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding:0 14px;">
                      <p style="margin:0;font-size:30px;line-height:1;">${homeFlag}</p>
                      <p style="margin:6px 0 0;font-size:11px;color:#6b7280;font-family:Arial,sans-serif;">${tightMatch.home_team}</p>
                    </td>
                    <td align="center" style="padding:0 10px;">
                      <p style="margin:0;font-size:36px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;letter-spacing:2px;">${tightMatch.resultado_local} - ${tightMatch.resultado_visitante}</p>
                    </td>
                    <td align="center" style="padding:0 14px;">
                      <p style="margin:0;font-size:30px;line-height:1;">${awayFlag}</p>
                      <p style="margin:6px 0 0;font-size:11px;color:#6b7280;font-family:Arial,sans-serif;">${tightMatch.away_team}</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0;font-size:13px;color:#DC2626;font-weight:600;font-family:Arial,sans-serif;">${hitsText}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

function buildUpcomingSection(upcomingMatches, appUrl) {
    if (!upcomingMatches || upcomingMatches.length === 0) return '';
    const rows = upcomingMatches.map(m => {
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
        return `
        <tr>
          <td style="padding:14px 20px;border-bottom:1px solid #f0f4fb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="28" align="center" style="font-size:20px;line-height:1;">${homeFlag}</td>
                <td style="padding:0 8px;font-family:Arial,sans-serif;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#1f2937;">${m.home_team} vs ${m.away_team}</p>
                  <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${dateStr} &middot; ${timeStr} hs</p>
                </td>
                <td align="right" width="76">
                  <a href="${appUrl}" style="display:inline-block;background:#FFCC00;color:#001A4B;font-size:12px;font-weight:700;text-decoration:none;padding:7px 14px;border-radius:20px;font-family:Arial,sans-serif;">Apostar</a>
                </td>
                <td width="28" align="center" style="font-size:20px;line-height:1;padding-left:6px;">${awayFlag}</td>
              </tr>
            </table>
          </td>
        </tr>`;
    }).join('');

    return `
      <tr>
        <td style="padding:0 28px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8edf5;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:14px 20px;" bgcolor="#f9fafb">
                <p style="margin:0;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;">⚽ PRÓXIMOS PARTIDOS PARA PRONOSTICAR</p>
              </td>
            </tr>
            ${rows}
          </table>
        </td>
      </tr>`;
}

const sendWeeklyEmail = async (email, {
    userName, weekDate, userPosition, totalPlayers,
    userPoints, bestRound, bestRoundPoints,
    tightMatch, upcomingMatches, appUrl, unsubscribeUrl,
}) => {
    const tightMatchHtml = buildTightMatchSection(tightMatch);
    const upcomingHtml = buildUpcomingSection(upcomingMatches, appUrl);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen semanal - PRODE Caballito</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f6fb">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- HEADER -->
        <tr>
          <td style="padding:20px 28px;border-bottom:1px solid #f0f4fb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:18px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;">⚽ PRODE Caballito</p>
                </td>
                <td align="right">
                  <p style="margin:0;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;text-align:right;">Resumen semanal<br><strong style="color:#6b7280;">${weekDate}</strong></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HERO -->
        <tr>
          <td bgcolor="#0a1628" style="padding:48px 28px;text-align:center;background:linear-gradient(160deg,#001A4B 0%,#0d2b5e 60%,#162f4a 100%);">
            <p style="margin:0 0 20px;font-size:48px;line-height:1;">⚽</p>
            <h1 style="margin:0;font-size:30px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;line-height:1.2;text-transform:uppercase;">¡ARRANCA UNA<br>NUEVA SEMANA</h1>
            <h1 style="margin:6px 0 20px;font-size:30px;font-weight:900;color:#FFCC00;font-family:Arial,sans-serif;line-height:1.2;text-transform:uppercase;">DE MUNDIAL!</h1>
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);font-family:Arial,sans-serif;">Así viene tu prode y lo que se viene esta semana.</p>
          </td>
        </tr>

        <!-- STATS -->
        <tr>
          <td style="padding:28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8edf5;border-radius:12px;overflow:hidden;">
              <tr>
                <td width="33%" align="center" style="padding:20px 8px;border-right:1px solid #e8edf5;">
                  <p style="margin:0;font-size:24px;line-height:1;">🏆</p>
                  <p style="margin:8px 0 2px;font-size:26px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;">${userPosition}°</p>
                  <p style="margin:0;font-size:10px;color:#9ca3af;font-family:Arial,sans-serif;line-height:1.4;">Tu posición<br>de ${totalPlayers} jugadores</p>
                </td>
                <td width="33%" align="center" style="padding:20px 8px;border-right:1px solid #e8edf5;">
                  <p style="margin:0;font-size:24px;line-height:1;">🎯</p>
                  <p style="margin:8px 0 2px;font-size:26px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;">${userPoints}</p>
                  <p style="margin:0;font-size:10px;color:#9ca3af;font-family:Arial,sans-serif;line-height:1.4;">Tus puntos</p>
                </td>
                <td width="33%" align="center" style="padding:20px 8px;">
                  <p style="margin:0;font-size:24px;line-height:1;">📅</p>
                  <p style="margin:8px 0 2px;font-size:18px;font-weight:900;color:#001A4B;font-family:Arial,sans-serif;">${bestRound}</p>
                  <p style="margin:0;font-size:10px;color:#9ca3af;font-family:Arial,sans-serif;line-height:1.4;">Tu mejor fecha<br>(${bestRoundPoints} pts)</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${tightMatchHtml}

        ${upcomingHtml}

        <!-- CTA PRINCIPAL -->
        <tr>
          <td style="padding:0 28px 28px;">
            <a href="${appUrl}" style="display:block;background-color:#001A4B;color:#ffffff;text-decoration:none;padding:18px 32px;border-radius:10px;font-size:16px;font-weight:700;font-family:Arial,sans-serif;text-align:center;">
              Ver todos los partidos y apostar →
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td align="center" style="padding:24px 28px;border-top:1px solid #f0f4fb;" bgcolor="#f9fafb">
            <p style="margin:0;font-size:13px;color:#374151;font-family:Arial,sans-serif;line-height:1.6;">
              💙 Gracias por jugar y ser parte de <strong>PRODE Caballito</strong>.<br>¡A seguir sumando puntos! 💪
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
//# sourceMappingURL=email.js.map