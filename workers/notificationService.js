"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
exports.generarNotificacionKickoff = generarNotificacionKickoff;
exports.generarNotificacionRankingCambio = generarNotificacionRankingCambio;
exports.generarNotificacionNuevoComentario = generarNotificacionNuevoComentario;
exports.generarNotificacionResultado = generarNotificacionResultado;
const connection_1 = require("../db/connection");
exports.notificationService = {
    async crearNotificacion(userId, matchId, type, payload) {
        await connection_1.db.query(`
      INSERT INTO notifications (user_id, match_id, type, payload, status)
      VALUES ($1, $2, $3, $4, 'pending')
    `, [userId, matchId, type, JSON.stringify(payload)]);
    },
    async marcarEnviada(notificationId) {
        await connection_1.db.query(`
      UPDATE notifications SET status = 'sent', sent_at = NOW()
      WHERE id = $1
    `, [notificationId]);
    },
    async marcarFallida(notificationId, error) {
        await connection_1.db.query(`
      UPDATE notifications SET status = 'failed'
      WHERE id = $1
    `, [notificationId]);
        console.error(`Notification ${notificationId} failed:`, error);
    },
};
async function generarNotificacionKickoff(userId, matchId, homeTeam, awayTeam, type, startTime) {
    const title = type === 'kickoff' ? '¡Comienza el partido!' : '¡Segundo tiempo!';
    const body = type === 'kickoff'
        ? `${homeTeam} vs ${awayTeam} está por comenzar. ¡Mucha suerte!`
        : `${homeTeam} vs ${awayTeam} inicia el segundo tiempo. ¡Seguimos!`;
    await exports.notificationService.crearNotificacion(userId, matchId, type, {
        title,
        body,
        homeTeam,
        awayTeam,
        startTime: startTime.toISOString(),
        icon: 'soccer',
    });
}
async function generarNotificacionRankingCambio(userId, posicionAnterior, posicionNueva, planillaNombre) {
    const mejora = posicionAnterior > posicionNueva;
    const cambio = Math.abs(posicionAnterior - posicionNueva);
    const title = mejora ? '¡Subiste en el ranking!' : 'Bajaste en el ranking';
    const body = mejora
        ? `Avanzaste ${cambio} posición${cambio > 1 ? 'es' : ''}. Ahora estás ${posicionNueva}° en "${planillaNombre}"`
        : `Bajaste ${cambio} posición${cambio > 1 ? 'es' : ''}. Ahora estás ${posicionNueva}° en "${planillaNombre}"`;
    await exports.notificationService.crearNotificacion(userId, null, 'ranking_change', {
        title,
        body,
        posicionAnterior,
        posicionNueva,
        planillaNombre,
        icon: 'trophy',
    });
}
async function generarNotificacionNuevoComentario(userId, commentId, authorName, contenido) {
    await exports.notificationService.crearNotificacion(userId, null, 'new_comment', {
        title: `${authorName} comentó`,
        body: contenido.substring(0, 100),
        commentId,
        authorName,
        icon: 'comment',
    });
}
async function generarNotificacionResultado(userId, matchId, homeTeam, awayTeam, resultadoLocal, resultadoVisitante, puntosObtenidos) {
    const title = '¡Resultado publicado!';
    const body = puntosObtenidos > 0
        ? `Obtuviste ${puntosObtenidos} puntos en ${homeTeam} ${resultadoLocal}-${resultadoVisitante} ${awayTeam}`
        : `Se publicaron los resultados de ${homeTeam} vs ${awayTeam}`;
    await exports.notificationService.crearNotificacion(userId, matchId, 'result_published', {
        title,
        body,
        homeTeam,
        awayTeam,
        resultadoLocal,
        resultadoVisitante,
        puntosObtenidos,
        icon: 'soccer',
    });
}
//# sourceMappingURL=notificationService.js.map