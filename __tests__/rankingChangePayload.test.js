'use strict'

const { buildRankingChangePayload } = require('../routes/matches')

describe('buildRankingChangePayload', () => {
  it('primera entrada al ranking (prevPos = null)', () => {
    const p = buildRankingChangePayload({ prevPos: null, newPos: 5, planillaNombre: 'Caballito' })
    expect(p.title).toBe('⭐ ¡Entraste al ranking!')
    expect(p.body).toContain('#5')
    expect(p.body).toContain('Caballito')
    expect(p.icon).toBe('trophy')
  })

  it('sube en el ranking (prevPos > newPos)', () => {
    const p = buildRankingChangePayload({ prevPos: 5, newPos: 2, planillaNombre: 'Mi Planilla' })
    expect(p.title).toBe('🚀 ¡Subiste en el ranking!')
    expect(p.body).toContain('Avanzaste 3 posiciones')
    expect(p.body).toContain('#2')
    expect(p.body).toContain('Mi Planilla')
  })

  it('baja en el ranking (prevPos < newPos)', () => {
    const p = buildRankingChangePayload({ prevPos: 2, newPos: 5, planillaNombre: 'X' })
    expect(p.title).toBe('📉 Bajaste en el ranking')
    expect(p.body).toContain('Bajaste 3 posiciones')
    expect(p.body).toContain('#5')
  })

  it('singular vs plural en cambio de 1 posición', () => {
    const sube = buildRankingChangePayload({ prevPos: 3, newPos: 2, planillaNombre: 'X' })
    expect(sube.body).toMatch(/Avanzaste 1 posición\b/) // singular
    expect(sube.body).not.toMatch(/posiciones/)

    const baja = buildRankingChangePayload({ prevPos: 2, newPos: 3, planillaNombre: 'X' })
    expect(baja.body).toMatch(/Bajaste 1 posición\b/)
    expect(baja.body).not.toMatch(/posiciones/)
  })

  it('omite el nombre de planilla si viene vacío/null', () => {
    const p = buildRankingChangePayload({ prevPos: 5, newPos: 1, planillaNombre: null })
    expect(p.body).not.toContain('en ""')
    expect(p.body).toContain('#1')
  })
})
