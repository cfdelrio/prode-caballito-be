'use strict'

const { resolveAdvance } = require('../routes/matches')

describe('resolveAdvance — quién avanza en un cruce de eliminatoria', () => {
  it('gana el local por marcador', () => {
    expect(resolveAdvance(2, 1, null, null)).toEqual({ winner: 'home', loser: 'away' })
  })

  it('gana el visitante por marcador', () => {
    expect(resolveAdvance(0, 3, null, null)).toEqual({ winner: 'away', loser: 'home' })
  })

  it('empate sin penales → indefinido (no propaga)', () => {
    expect(resolveAdvance(1, 1, null, null)).toEqual({ winner: null, loser: null })
  })

  it('empate definido por penales a favor del local', () => {
    expect(resolveAdvance(1, 1, 4, 2)).toEqual({ winner: 'home', loser: 'away' })
  })

  it('empate definido por penales a favor del visitante', () => {
    expect(resolveAdvance(2, 2, 3, 5)).toEqual({ winner: 'away', loser: 'home' })
  })

  it('empate con penales también empatados → indefinido', () => {
    expect(resolveAdvance(0, 0, 3, 3)).toEqual({ winner: null, loser: null })
  })

  it('el marcador manda aunque vengan penales (no debería pasar, pero es robusto)', () => {
    expect(resolveAdvance(3, 1, 1, 4)).toEqual({ winner: 'home', loser: 'away' })
  })
})
