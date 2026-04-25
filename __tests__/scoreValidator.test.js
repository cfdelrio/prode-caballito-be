'use strict'

const { validateScore, validateRankingTotal, findMissingScores, validateRankingOrder, runValidation } = require('../services/scoreValidator')

// ── Helpers ──────────────────────────────────────────────────────────────────

const bet = (planilla_id, match_id, local, visitante) => ({
  planilla_id,
  match_id,
  goles_local: local,
  goles_visitante: visitante,
})

const match = (id, local, visitante) => ({
  id,
  resultado_local: local,
  resultado_visitante: visitante,
})

const score = (planilla_id, match_id, puntos, bonus = false) => ({
  planilla_id,
  match_id,
  puntos_obtenidos: puntos,
  bonus_aplicado: bonus,
})

const ranking = (planilla_id, puntos_totales, position = null, extra = {}) => ({
  planilla_id,
  puntos_totales,
  position,
  aciertos_celeste: 0,
  aciertos_rojo: 0,
  aciertos_verde: 0,
  aciertos_amarillo: 0,
  ...extra,
})

// ── validateScore ─────────────────────────────────────────────────────────────

describe('validateScore', () => {
  it('sin errores cuando puntos y bonus son correctos — 0pts', () => {
    const b = bet('p1', 'm1', 1, 0)
    const m = match('m1', 0, 1) // apuesta al local pero ganó visitante → 0pts
    const s = score('p1', 'm1', 0, false)
    expect(validateScore(b, m, s)).toEqual([])
  })

  it('sin errores cuando puntos son correctos — 1pt', () => {
    const b = bet('p1', 'm1', 3, 1)
    const m = match('m1', 1, 0) // ganó local, distinto marcador → 1pt
    const s = score('p1', 'm1', 1, false)
    expect(validateScore(b, m, s)).toEqual([])
  })

  it('sin errores cuando puntos son correctos — 3pts sin bonus', () => {
    const b = bet('p1', 'm1', 1, 0)
    const m = match('m1', 1, 0)
    const s = score('p1', 'm1', 3, false)
    expect(validateScore(b, m, s)).toEqual([])
  })

  it('sin errores cuando puntos y bonus son correctos — 4pts con bonus', () => {
    const b = bet('p1', 'm1', 3, 1)
    const m = match('m1', 3, 1) // exacto, 4 goles → bonus
    const s = score('p1', 'm1', 4, true)
    expect(validateScore(b, m, s)).toEqual([])
  })

  it('error cuando puntos_obtenidos no coincide', () => {
    const b = bet('p1', 'm1', 1, 0)
    const m = match('m1', 1, 0) // exacto → 3pts
    const s = score('p1', 'm1', 1, false) // pero persistido: 1pt
    const errors = validateScore(b, m, s)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/puntos incorrectos/)
    expect(errors[0]).toMatch(/persistido=1/)
    expect(errors[0]).toMatch(/esperado=3/)
  })

  it('error cuando bonus_aplicado no coincide', () => {
    const b = bet('p1', 'm1', 3, 1)
    const m = match('m1', 3, 1) // exacto, 4 goles → bonus true
    const s = score('p1', 'm1', 4, false) // bonus debería ser true
    const errors = validateScore(b, m, s)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/bonus incorrecto/)
  })

  it('dos errores cuando tanto puntos como bonus son incorrectos', () => {
    const b = bet('p1', 'm1', 3, 1)
    const m = match('m1', 3, 1) // exacto, 4 goles → 4pts + bonus
    const s = score('p1', 'm1', 2, false) // todo mal
    const errors = validateScore(b, m, s)
    expect(errors).toHaveLength(2)
  })

  it('trata bonus_aplicado null como false', () => {
    const b = bet('p1', 'm1', 1, 0)
    const m = match('m1', 1, 0) // exacto 1-0, solo 1 gol → sin bonus
    const s = { planilla_id: 'p1', match_id: 'm1', puntos_obtenidos: 3, bonus_aplicado: null }
    expect(validateScore(b, m, s)).toEqual([])
  })
})

// ── validateRankingTotal ──────────────────────────────────────────────────────

describe('validateRankingTotal', () => {
  it('sin error cuando suma coincide', () => {
    const scores = [
      score('p1', 'm1', 3),
      score('p1', 'm2', 1),
      score('p1', 'm3', 4),
    ]
    expect(validateRankingTotal('p1', scores, 8)).toBeNull()
  })

  it('error cuando suma difiere del total', () => {
    const scores = [score('p1', 'm1', 3), score('p1', 'm2', 1)]
    const error = validateRankingTotal('p1', scores, 10)
    expect(error).not.toBeNull()
    expect(error).toMatch(/ranking desincronizado/)
    expect(error).toMatch(/ranking\.puntos_totales=10/)
    expect(error).toMatch(/sum\(scores\)=4/)
  })

  it('trata puntos_obtenidos null como 0', () => {
    const scores = [
      score('p1', 'm1', 3),
      { planilla_id: 'p1', match_id: 'm2', puntos_obtenidos: null },
    ]
    expect(validateRankingTotal('p1', scores, 3)).toBeNull()
  })

  it('sin error con array vacío y total 0', () => {
    expect(validateRankingTotal('p1', [], 0)).toBeNull()
  })

  it('error cuando array vacío pero total > 0', () => {
    const error = validateRankingTotal('p1', [], 5)
    expect(error).not.toBeNull()
    expect(error).toMatch(/diferencia=5/)
  })
})

// ── findMissingScores ─────────────────────────────────────────────────────────

describe('findMissingScores', () => {
  const index = {
    'p1:m1': score('p1', 'm1', 3),
    'p2:m1': score('p2', 'm1', 1),
  }

  it('devuelve vacío cuando todos tienen score', () => {
    const bets = [bet('p1', 'm1', 1, 0), bet('p2', 'm1', 0, 1)]
    expect(findMissingScores(bets, index)).toEqual([])
  })

  it('detecta apuesta sin score correspondiente', () => {
    const bets = [
      bet('p1', 'm1', 1, 0),
      bet('p3', 'm1', 2, 0), // p3:m1 no está en el índice
    ]
    const missing = findMissingScores(bets, index)
    expect(missing).toHaveLength(1)
    expect(missing[0].planilla_id).toBe('p3')
    expect(missing[0].match_id).toBe('m1')
  })

  it('detecta múltiples scores faltantes', () => {
    const bets = [
      bet('p1', 'm1', 1, 0),
      bet('p1', 'm2', 0, 0), // falta
      bet('p2', 'm2', 1, 1), // falta
    ]
    expect(findMissingScores(bets, index)).toHaveLength(2)
  })

  it('devuelve vacío con array vacío', () => {
    expect(findMissingScores([], index)).toEqual([])
  })
})

// ── validateRankingOrder ──────────────────────────────────────────────────────

describe('validateRankingOrder', () => {
  it('sin errores con un único ranking', () => {
    expect(validateRankingOrder([ranking('p1', 10, 1)])).toEqual([])
  })

  it('sin errores con orden correcto por puntos', () => {
    const rankings = [ranking('p1', 20, 1), ranking('p2', 15, 2), ranking('p3', 5, 3)]
    expect(validateRankingOrder(rankings)).toEqual([])
  })

  it('detecta posición duplicada', () => {
    const rankings = [ranking('p1', 20, 1), ranking('p2', 15, 1)] // ambas pos=1
    const errors = validateRankingOrder(rankings)
    expect(errors.some(e => e.includes('duplicada'))).toBe(true)
  })

  it('detecta gap en posiciones', () => {
    const rankings = [ranking('p1', 20, 1), ranking('p2', 15, 3)] // falta pos=2
    const errors = validateRankingOrder(rankings)
    expect(errors.some(e => e.includes('gap'))).toBe(true)
  })

  it('detecta orden invertido por puntos', () => {
    // p2 tiene más puntos pero posición peor
    const rankings = [ranking('p1', 10, 1), ranking('p2', 20, 2)]
    const errors = validateRankingOrder(rankings)
    expect(errors.some(e => e.includes('invertida'))).toBe(true)
  })

  it('sin errores con empate — tiebreak por aciertos_celeste', () => {
    const a = ranking('p1', 10, 1, { aciertos_celeste: 2, aciertos_rojo: 0 })
    const b = ranking('p2', 10, 2, { aciertos_celeste: 1, aciertos_rojo: 0 })
    expect(validateRankingOrder([a, b])).toEqual([])
  })

  it('detecta tiebreak invertido — más celeste con posición peor', () => {
    const a = ranking('p1', 10, 2, { aciertos_celeste: 3 }) // debería ser pos=1
    const b = ranking('p2', 10, 1, { aciertos_celeste: 1 }) // debería ser pos=2
    const errors = validateRankingOrder([a, b])
    expect(errors.some(e => e.includes('invertida'))).toBe(true)
  })

  it('sin errores con empate total — orden arbitrario válido', () => {
    const a = ranking('p1', 10, 1, { aciertos_celeste: 2, aciertos_rojo: 1, aciertos_verde: 0, aciertos_amarillo: 0 })
    const b = ranking('p2', 10, 2, { aciertos_celeste: 2, aciertos_rojo: 1, aciertos_verde: 0, aciertos_amarillo: 0 })
    // Empate total: cualquier orden de posiciones es válido
    expect(validateRankingOrder([a, b])).toEqual([])
  })

  it('ignora planillas sin posición (no pagadas)', () => {
    const rankings = [
      ranking('p1', 20, 1),
      ranking('p2', 0, null), // no pagada
    ]
    expect(validateRankingOrder(rankings)).toEqual([])
  })

  it('tiebreak completo: amarillo como último criterio', () => {
    const a = ranking('p1', 10, 1, { aciertos_celeste: 0, aciertos_rojo: 0, aciertos_verde: 0, aciertos_amarillo: 3 })
    const b = ranking('p2', 10, 2, { aciertos_celeste: 0, aciertos_rojo: 0, aciertos_verde: 0, aciertos_amarillo: 1 })
    expect(validateRankingOrder([a, b])).toEqual([])
  })

  it('detecta tiebreak amarillo invertido', () => {
    const a = ranking('p1', 10, 2, { aciertos_celeste: 0, aciertos_rojo: 0, aciertos_verde: 0, aciertos_amarillo: 3 })
    const b = ranking('p2', 10, 1, { aciertos_celeste: 0, aciertos_rojo: 0, aciertos_verde: 0, aciertos_amarillo: 1 })
    const errors = validateRankingOrder([a, b])
    expect(errors.some(e => e.includes('invertida'))).toBe(true)
  })

  it('devuelve vacío con array vacío', () => {
    expect(validateRankingOrder([])).toEqual([])
  })
})

// ── runValidation ─────────────────────────────────────────────────────────────

describe('runValidation', () => {
  const m1 = match('m1', 1, 0)
  const m2 = match('m2', 3, 1) // exacto con bonus

  it('resumen correcto con datos válidos', () => {
    const bets = [bet('p1', 'm1', 1, 0), bet('p1', 'm2', 3, 1)]
    const scores = [score('p1', 'm1', 3, false), score('p1', 'm2', 4, true)]
    const rankings = [ranking('p1', 7, 1)]

    const result = runValidation([m1, m2], bets, scores, rankings)

    expect(result.scoreErrors).toHaveLength(0)
    expect(result.missingScores).toHaveLength(0)
    expect(result.rankingErrors).toHaveLength(0)
    expect(result.orderErrors).toHaveLength(0)
    expect(result.summary.valid).toBe(true)
    expect(result.summary.checked_matches).toBe(2)
    expect(result.summary.checked_bets).toBe(2)
    expect(result.summary.checked_rankings).toBe(1)
  })

  it('detecta error de score incorrecto', () => {
    const bets = [bet('p1', 'm1', 1, 0)]
    const scores = [score('p1', 'm1', 1, false)] // debería ser 3
    const rankings = [ranking('p1', 1, 1)]

    const result = runValidation([m1], bets, scores, rankings)

    expect(result.scoreErrors).toHaveLength(1)
    expect(result.scoreErrors[0].planilla_id).toBe('p1')
    expect(result.scoreErrors[0].match_id).toBe('m1')
    expect(result.summary.valid).toBe(false)
    expect(result.summary.score_errors).toBe(1)
  })

  it('detecta score faltante', () => {
    const bets = [bet('p1', 'm1', 1, 0), bet('p2', 'm1', 0, 1)]
    const scores = [score('p1', 'm1', 3, false)] // falta p2:m1
    const rankings = [ranking('p1', 3, 1), ranking('p2', 0, 2)]

    const result = runValidation([m1], bets, scores, rankings)

    expect(result.missingScores).toHaveLength(1)
    expect(result.missingScores[0].planilla_id).toBe('p2')
    expect(result.summary.valid).toBe(false)
    expect(result.summary.missing_scores).toBe(1)
  })

  it('detecta ranking desincronizado', () => {
    const bets = [bet('p1', 'm1', 1, 0)]
    const scores = [score('p1', 'm1', 3, false)]
    const rankings = [ranking('p1', 10, 1)] // debería ser 3

    const result = runValidation([m1], bets, scores, rankings)

    expect(result.rankingErrors).toHaveLength(1)
    expect(result.rankingErrors[0].planilla_id).toBe('p1')
    expect(result.rankingErrors[0].error).toMatch(/desincronizado/)
    expect(result.summary.valid).toBe(false)
  })

  it('detecta orden de posiciones incorrecto', () => {
    const bets = [bet('p1', 'm1', 1, 0), bet('p2', 'm1', 0, 1)]
    const scores = [score('p1', 'm1', 3, false), score('p2', 'm1', 0, false)]
    // p2 tiene 0pts pero position=1, p1 tiene 3pts pero position=2
    const rankings = [ranking('p1', 3, 2), ranking('p2', 0, 1)]

    const result = runValidation([m1], bets, scores, rankings)

    expect(result.orderErrors).toHaveLength(1)
    expect(result.orderErrors[0]).toMatch(/invertida/)
    expect(result.summary.order_errors).toBe(1)
    expect(result.summary.valid).toBe(false)
  })

  it('ignora bets de partidos no terminados', () => {
    const bets = [bet('p1', 'm99', 1, 0)]
    const scores = []
    const rankings = [ranking('p1', 0, 1)]

    // m99 no está en finishedMatches → se ignora
    const result = runValidation([m1], bets, scores, rankings)

    expect(result.summary.checked_bets).toBe(0)
    expect(result.summary.valid).toBe(true)
  })

  it('soporta múltiples planillas para el mismo partido', () => {
    const bets = [
      bet('p1', 'm1', 1, 0),
      bet('p2', 'm1', 1, 0),
    ]
    const scores = [
      score('p1', 'm1', 3, false),
      score('p2', 'm1', 3, false),
    ]
    const rankings = [ranking('p1', 3, 1), ranking('p2', 3, 2)]

    const result = runValidation([m1], bets, scores, rankings)

    expect(result.summary.valid).toBe(true)
    expect(result.summary.checked_bets).toBe(2)
  })

  it('acumula scores de múltiples partidos en el ranking', () => {
    const bets = [
      bet('p1', 'm1', 1, 0),
      bet('p1', 'm2', 3, 1),
    ]
    const scores = [
      score('p1', 'm1', 3, false),
      score('p1', 'm2', 4, true),
    ]
    const rankings = [ranking('p1', 5, 1)] // debería ser 7

    const result = runValidation([m1, m2], bets, scores, rankings)

    expect(result.rankingErrors).toHaveLength(1)
    expect(result.rankingErrors[0].error).toMatch(/sum\(scores\)=7/)
  })
})
