"use strict";

const { db } = require('../db/connection');
const { calcularPuntaje } = require('./scoring');
const { sendNewLeaderEmail, sendResultEmail } = require('./email');
const { sendSMS } = require('./whatsapp');
const { pushToUser, pushToAll } = require('./push');

/**
 * Fires all post-result notifications (email, WhatsApp, push) for a published
 * match result. Intended to be called inside setImmediate — never blocks the
 * HTTP response.
 *
 * @param {object} params
 * @param {object} params.match        - Full match row
 * @param {number} params.resultLocal  - Published home goals
 * @param {number} params.resultVisitante - Published away goals
 * @param {Array}  params.bets         - All bet rows for this match
 * @param {object|null} params.prevLeader - Ranking row of the previous #1 (may be null)
 */
async function notifyResult({ match, resultLocal, resultVisitante, bets, prevLeader }) {
    try {
        const rankingRows = await db.query(`
            SELECT p.user_id, r.position, r.puntos_totales,
                   u.email, u.nombre, u.whatsapp_number, u.whatsapp_consent
            FROM ranking r
            JOIN planillas p ON r.planilla_id = p.id
            JOIN users u ON p.user_id = u.id
            ORDER BY r.position ASC
        `);
        const rankingMap = {};
        for (const row of rankingRows.rows) rankingMap[row.user_id] = row;

        await _notifyNewLeader({ rankingRows: rankingRows.rows, prevLeader, match, resultLocal, resultVisitante });
        await _notifyBetResults({ bets, rankingMap, match, resultLocal, resultVisitante });
        await _pushBroadcast({ match, resultLocal, resultVisitante });
        await _notifyAdmins({ match, resultLocal, resultVisitante });

        console.log(`[result-notif] match=${match.id} bets=${bets.length}`);
    } catch (err) {
        console.error('[result-notif] error:', err.message);
    }
}

async function _notifyNewLeader({ rankingRows, prevLeader, match, resultLocal, resultVisitante }) {
    const newLeader = rankingRows[0] || null;
    if (!newLeader || !prevLeader || newLeader.user_id === prevLeader.user_id) return;

    await db.query(
        `INSERT INTO notifications (user_id, type, payload, status, sent_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [newLeader.user_id, 'ranking', JSON.stringify({
            title: '🔥 ¡Sos el nuevo líder!',
            body: `Con ${newLeader.puntos_totales} pts estás en el puesto #1`
        }), 'sent']
    ).catch(e => console.error('Notification new leader error:', e.message));

    await sendNewLeaderEmail({
        userEmail: newLeader.email,
        userName: newLeader.nombre,
        puntos: newLeader.puntos_totales,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        resultLocal,
        resultVisitante,
    }).catch(e => console.error('Email new leader error:', e.message));

    await pushToUser(newLeader.user_id, {
        title: '🔥 ¡Sos el nuevo líder!',
        body: `Con ${newLeader.puntos_totales} pts estás en el puesto #1 — ¡no lo sueltes!`,
        url: '/ranking',
        icon: '/favicon.svg',
    }).catch(e => console.error('[push] new leader error:', e.message));

    if (newLeader.whatsapp_number && newLeader.whatsapp_consent) {
        const body = `🔥 ¡Sos el nuevo líder del PRODE Caballito! Con ${newLeader.puntos_totales} pts estás en el puesto #1. ¡No lo sueltes! 👉 prodecaballito.com/ranking`;
        await sendSMS({ to: newLeader.whatsapp_number, body })
            .catch(e => console.error('[sms] new leader error:', e.message));
    }
}

async function _notifyBetResults({ bets, rankingMap, match, resultLocal, resultVisitante }) {
    if (bets.length === 0) return;

    const planillaIds = bets.map(b => b.planilla_id);
    const planillaUsersRes = await db.query(
        'SELECT id, user_id FROM planillas WHERE id = ANY($1::uuid[])', [planillaIds]
    );
    const planillaToUser = {};
    for (const row of planillaUsersRes.rows) planillaToUser[row.id] = row.user_id;

    for (const bet of bets) {
        try {
            const userId = planillaToUser[bet.planilla_id];
            if (!userId) continue;
            const userRanking = rankingMap[userId];
            if (!userRanking) continue;

            const score = calcularPuntaje(
                { goles_local: bet.goles_local, goles_visitante: bet.goles_visitante },
                { resultado_local: resultLocal, resultado_visitante: resultVisitante }
            );

            const title = score.puntos > 0 ? '⚽ ¡Obtuviste puntos!' : '⚽ Resultado publicado';
            const body = score.puntos > 0
                ? `${match.home_team} ${resultLocal}-${resultVisitante} ${match.away_team}: +${score.puntos}pts`
                : `${match.home_team} ${resultLocal}-${resultVisitante} ${match.away_team}`;

            await db.query(
                `INSERT INTO notifications (user_id, match_id, type, payload, status, sent_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [userId, match.id, 'result', JSON.stringify({ title, body }), 'sent']
            ).catch(e => console.error(`Notification insert error for ${userId}:`, e.message));

            await sendResultEmail({
                userEmail: userRanking.email,
                userName: userRanking.nombre,
                homeTeam: match.home_team,
                awayTeam: match.away_team,
                resultLocal,
                resultVisitante,
                betLocal: bet.goles_local,
                betVisitante: bet.goles_visitante,
                puntos: score.puntos,
                rankingPos: userRanking.position,
            }).catch(e => console.error(`Result email error for ${userId}:`, e.message));

            if (userRanking.whatsapp_number && userRanking.whatsapp_consent) {
                const body = `⚽ ${match.home_team} ${resultLocal}-${resultVisitante} ${match.away_team}\n🎯 Tu pronóstico: ${bet.goles_local}-${bet.goles_visitante} → +${score.puntos}pts\n🏆 Estás #${userRanking.position} en el ranking\n👉 prodecaballito.com/ranking`;
                await sendSMS({ to: userRanking.whatsapp_number, body })
                    .catch(e => console.error(`[sms] result error for ${userId}:`, e.message));
            }
        } catch (betErr) {
            console.error('Result notification error for bet:', betErr.message);
        }
    }
}

async function _pushBroadcast({ match, resultLocal, resultVisitante }) {
    await pushToAll({
        title: `⚽ ${match.home_team} ${resultLocal}–${resultVisitante} ${match.away_team}`,
        body: 'Resultado publicado — mirá cuántos puntos sumaste',
        url: '/ranking',
        icon: '/favicon.svg',
    }).catch(e => console.error('[push] broadcast error:', e.message));
}

async function _notifyAdmins({ match, resultLocal, resultVisitante }) {
    const adminsRes = await db.query(
        `SELECT whatsapp_number FROM users WHERE rol = 'admin' AND whatsapp_number IS NOT NULL`
    );
    if (adminsRes.rows.length === 0) return;

    const msg = `⚽ Resultado cargado\n${match.home_team} ${resultLocal} - ${resultVisitante} ${match.away_team}\n\nLos puntos ya fueron calculados.`;

    for (const admin of adminsRes.rows) {
        await sendSMS({ to: admin.whatsapp_number, body: msg })
            .catch(e => console.error('[sms] admin notif error:', e.message));
    }
}

module.exports = { notifyResult };
