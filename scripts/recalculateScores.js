"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../db/connection");
const scoring_1 = require("../services/scoring");
function calculateScore(betHome, betAway, resHome, resAway) {
    const bet = { goles_local: betHome, goles_visitante: betAway };
    const result = { resultado_local: resHome, resultado_visitante: resAway };
    const scoreResult = scoring_1.calcularPuntaje(bet, result);
    return {
        points: scoreResult.puntos,
        bonus: scoreResult.bonus,
        detail: JSON.stringify(scoreResult.detalle)
    };
}
async function recalculateScores() {
    console.log('🏆 Calculando scores...');
    const matchesResult = await connection_1.db.query('SELECT id, resultado_local, resultado_visitante FROM matches');
    let scoreCount = 0;
    for (const match of matchesResult.rows) {
        const betsResult = await connection_1.db.query('SELECT * FROM bets WHERE match_id = $1', [match.id]);
        for (const bet of betsResult.rows) {
            const score = calculateScore(bet.goles_local, bet.goles_visitante, match.resultado_local, match.resultado_visitante);
            await connection_1.db.query(`INSERT INTO scores (planilla_id, match_id, puntos_obtenidos, bonus_aplicado, detalle_json)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (planilla_id, match_id) DO UPDATE SET
           puntos_obtenidos = EXCLUDED.puntos_obtenidos,
           bonus_aplicado = EXCLUDED.bonus_aplicado,
           detalle_json = EXCLUDED.detalle_json`, [bet.planilla_id, match.id, score.points, score.bonus, score.detail]);
            scoreCount++;
        }
    }
    console.log(`✅ ${scoreCount} scores calculados`);

    // Limpiar scores huérfanos: rows de scores cuyo match ya no está 'finished'
    // (admin revirtió el resultado). Si no se borran, el ranking los seguiría
    // sumando porque el LEFT JOIN preserva la fila aunque m no matchee.
    const orphanRes = await connection_1.db.query(`
        DELETE FROM scores WHERE match_id IN (
            SELECT id FROM matches WHERE estado != 'finished'
        )
    `);
    console.log(`🧹 Scores huérfanos borrados: ${orphanRes.rowCount}`);

    console.log('📈 Actualizando ranking...');
    // FIX: filtrar agregados por m.estado = 'finished' — defensa en profundidad
    // por si quedan scores huérfanos (LEFT JOIN no filtra el lado s).
    await connection_1.db.query(`
    INSERT INTO ranking (
      planilla_id,
      puntos_totales,
      exactos_count,
      aciertos_celeste,
      aciertos_rojo,
      aciertos_verde,
      aciertos_amarillo,
      updated_at
    )
    SELECT
      p.id as planilla_id,
      COALESCE(SUM(s.puntos_obtenidos) FILTER (WHERE m.estado = 'finished'), 0) as puntos_totales,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos >= 3 AND m.estado = 'finished') as exactos_count,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos = 4 AND m.estado = 'finished') as aciertos_celeste,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos = 3 AND m.estado = 'finished') as aciertos_rojo,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos = 2 AND m.estado = 'finished') as aciertos_verde,
      COUNT(s.id) FILTER (WHERE s.puntos_obtenidos = 1 AND m.estado = 'finished') as aciertos_amarillo,
      NOW() as updated_at
    FROM planillas p
    LEFT JOIN scores s ON p.id = s.planilla_id
    LEFT JOIN matches m ON s.match_id = m.id
    WHERE p.precio_pagado = true
    GROUP BY p.id
    ON CONFLICT (planilla_id) DO UPDATE SET
      puntos_totales = EXCLUDED.puntos_totales,
      exactos_count = EXCLUDED.exactos_count,
      aciertos_celeste = EXCLUDED.aciertos_celeste,
      aciertos_rojo = EXCLUDED.aciertos_rojo,
      aciertos_verde = EXCLUDED.aciertos_verde,
      aciertos_amarillo = EXCLUDED.aciertos_amarillo,
      updated_at = NOW()
  `);
    await connection_1.db.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (
        ORDER BY 
          puntos_totales DESC,
          aciertos_celeste DESC,
          aciertos_rojo DESC,
          aciertos_verde DESC,
          aciertos_amarillo DESC
      ) as position
      FROM ranking
    )
    UPDATE ranking r SET position = ranked.position FROM ranked WHERE r.id = ranked.id
  `);
    console.log('✅ Ranking actualizado');
    process.exit(0);
}
recalculateScores().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
//# sourceMappingURL=recalculateScores.js.map