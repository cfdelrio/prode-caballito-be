'use strict'

const { calcularPuntaje } = require('./scoring')

/**
 * Validates that a persisted score record matches what calcularPuntaje produces.
 * Returns array of error strings, or empty array if valid.
 */
function validateScore(bet, match, scoreRecord) {
  const expected = calcularPuntaje(
    { goles_local: bet.goles_local, goles_visitante: bet.goles_visitante },
    { resultado_local: match.resultado_local, resultado_visitante: match.resultado_visitante }
  )

  const errors = []
  if (scoreRecord.puntos_obtenidos !== expected.puntos) {
    errors.push(
      `puntos incorrectos: persistido=${scoreRecord.puntos_obtenidos}, esperado=${expected.puntos}`
    )
  }
  if (!!scoreRecord.bonus_aplicado !== expected.bonus) {
    errors.push(
      `bonus incorrecto: persistido=${scoreRecord.bonus_aplicado}, esperado=${expected.bonus}`
    )
  }
  return errors
}

/**
 * Validates that the position field of each ranking row matches the official sort order:
 * puntos_totales DESC, aciertos_celeste DESC, aciertos_rojo DESC, aciertos_verde DESC, aciertos_amarillo DESC.
 * Only considers rows with position != null (paid planillas).
 * Returns array of error strings.
 */
function validateRankingOrder(rankings) {
  const positioned = rankings.filter(r => r.position != null)
  if (positioned.length === 0) return []

  const errors = []

  // 1. Duplicate positions
  const posCount = {}
  for (const r of positioned) {
    posCount[r.position] = (posCount[r.position] || 0) + 1
  }
  for (const [pos, count] of Object.entries(posCount)) {
    if (count > 1) {
      errors.push(`posición ${pos} duplicada (${count} planillas)`)
    }
  }

  // 2. No gaps: positions must cover 1..N
  const maxPos = Math.max(...positioned.map(r => r.position))
  if (maxPos !== positioned.length) {
    errors.push(`gap en posiciones: ${positioned.length} planillas pagadas pero posición máxima=${maxPos}`)
  }

  // 3. Order consistency: sort by official criteria, then verify no strict inversion
  const c = r => [
    r.puntos_totales,
    r.aciertos_celeste || 0,
    r.aciertos_rojo || 0,
    r.aciertos_verde || 0,
    r.aciertos_amarillo || 0,
  ]

  const sorted = [...positioned].sort((a, b) => {
    const ca = c(a), cb = c(b)
    for (let i = 0; i < ca.length; i++) {
      if (cb[i] !== ca[i]) return cb[i] - ca[i]
    }
    return 0
  })

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const ca = c(a), cb = c(b)
    const tied = ca.every((v, i) => v === cb[i])
    if (!tied && a.position > b.position) {
      errors.push(
        `posición invertida: planilla ${a.planilla_id} (pos=${a.position}, pts=${a.puntos_totales}) debe ir antes que planilla ${b.planilla_id} (pos=${b.position}, pts=${b.puntos_totales})`
      )
    }
  }

  return errors
}

/**
 * Validates that a planilla's ranking total equals the sum of its individual scores.
 * Returns error string or null if valid.
 */
function validateRankingTotal(planillaId, scores, rankingTotal) {
  const sum = scores.reduce((acc, s) => acc + (s.puntos_obtenidos ?? 0), 0)
  if (sum !== rankingTotal) {
    return `ranking desincronizado: ranking.puntos_totales=${rankingTotal}, sum(scores)=${sum} (diferencia=${rankingTotal - sum})`
  }
  return null
}

/**
 * Validates that every finished-match bet has a corresponding score record.
 * Returns list of {planilla_id, match_id} pairs missing a score.
 */
function findMissingScores(bets, scoreIndex) {
  return bets.filter(b => !scoreIndex[`${b.planilla_id}:${b.match_id}`])
}

/**
 * Runs a full in-memory validation pass given raw DB data.
 *
 * @param {Array} finishedMatches  - matches with resultado_local/visitante
 * @param {Array} bets             - all bets for those matches
 * @param {Array} scores           - all score records for those matches
 * @param {Array} rankings         - [{planilla_id, puntos_totales}]
 * @returns {{ scoreErrors, missingScores, rankingErrors, summary }}
 */
function runValidation(finishedMatches, bets, scores, rankings) {
  const matchIndex = {}
  for (const m of finishedMatches) matchIndex[m.id] = m

  const scoreIndex = {}
  for (const s of scores) scoreIndex[`${s.planilla_id}:${s.match_id}`] = s

  const planillaScores = {}
  for (const s of scores) {
    if (!planillaScores[s.planilla_id]) planillaScores[s.planilla_id] = []
    planillaScores[s.planilla_id].push(s)
  }

  const finishedMatchIds = new Set(finishedMatches.map(m => m.id))
  const finishedBets = bets.filter(b => finishedMatchIds.has(b.match_id))

  // 1. Score integrity
  const scoreErrors = []
  for (const bet of finishedBets) {
    const match = matchIndex[bet.match_id]
    const record = scoreIndex[`${bet.planilla_id}:${bet.match_id}`]
    if (!record) continue // caught by missingScores
    const errors = validateScore(bet, match, record)
    if (errors.length > 0) {
      scoreErrors.push({ planilla_id: bet.planilla_id, match_id: bet.match_id, errors })
    }
  }

  // 2. Missing scores
  const missingScores = findMissingScores(finishedBets, scoreIndex)

  // 3. Ranking totals
  const rankingErrors = []
  for (const r of rankings) {
    const planScores = planillaScores[r.planilla_id] || []
    const error = validateRankingTotal(r.planilla_id, planScores, r.puntos_totales)
    if (error) rankingErrors.push({ planilla_id: r.planilla_id, error })
  }

  // 4. Ranking order
  const orderErrors = validateRankingOrder(rankings)

  return {
    scoreErrors,
    missingScores,
    rankingErrors,
    orderErrors,
    summary: {
      checked_matches: finishedMatches.length,
      checked_bets: finishedBets.length,
      checked_rankings: rankings.length,
      score_errors: scoreErrors.length,
      missing_scores: missingScores.length,
      ranking_errors: rankingErrors.length,
      order_errors: orderErrors.length,
      valid: scoreErrors.length === 0 && missingScores.length === 0 && rankingErrors.length === 0 && orderErrors.length === 0,
    },
  }
}

module.exports = { validateScore, validateRankingTotal, findMissingScores, validateRankingOrder, runValidation }
