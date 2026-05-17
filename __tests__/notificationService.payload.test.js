'use strict'

jest.mock('../db/connection', () => ({
  db: { query: jest.fn().mockResolvedValue({ rows: [] }) },
}))

const { db } = require('../db/connection')
const {
  generarNotificacionKickoff,
  generarNotificacionRankingCambio,
  generarNotificacionNuevoComentario,
  generarNotificacionResultado,
} = require('../workers/notificationService')

const USER_ID = '11111111-1111-1111-1111-111111111111'
const MATCH_ID = '22222222-2222-2222-2222-222222222222'

function extractPayload(callIndex = 0) {
  const args = db.query.mock.calls[callIndex]
  // INSERT INTO notifications (user_id, match_id, type, payload, status) VALUES ($1, $2, $3, $4, 'pending')
  // El payload es el 4to parámetro ($4) → params[3], stringified
  return JSON.parse(args[1][3])
}

beforeEach(() => {
  db.query.mockClear()
  db.query.mockResolvedValue({ rows: [] })
})

describe('notificationService — payload con claves title/body (no titulo/mensaje)', () => {
  it('generarNotificacionKickoff guarda title y body', async () => {
    await generarNotificacionKickoff(
      USER_ID, MATCH_ID, 'Argentina', 'Brasil', 'kickoff', new Date('2026-06-15T20:00:00Z')
    )

    expect(db.query).toHaveBeenCalledTimes(1)
    const payload = extractPayload()
    expect(payload).toHaveProperty('title')
    expect(payload).toHaveProperty('body')
    expect(payload).not.toHaveProperty('titulo')
    expect(payload).not.toHaveProperty('mensaje')
    expect(payload.title).toBe('¡Comienza el partido!')
    expect(payload.body).toContain('Argentina')
    expect(payload.body).toContain('Brasil')
  })

  it('generarNotificacionKickoff con type=halftime usa título de segundo tiempo', async () => {
    await generarNotificacionKickoff(
      USER_ID, MATCH_ID, 'Argentina', 'Brasil', 'halftime', new Date('2026-06-15T20:45:00Z')
    )

    const payload = extractPayload()
    expect(payload.title).toBe('¡Segundo tiempo!')
    expect(payload.body).toContain('segundo tiempo')
  })

  it('generarNotificacionRankingCambio (mejora) guarda title y body', async () => {
    await generarNotificacionRankingCambio(USER_ID, 5, 2, 'Planilla principal')

    const payload = extractPayload()
    expect(payload).toHaveProperty('title')
    expect(payload).toHaveProperty('body')
    expect(payload).not.toHaveProperty('titulo')
    expect(payload).not.toHaveProperty('mensaje')
    expect(payload.title).toBe('¡Subiste en el ranking!')
    expect(payload.body).toContain('Avanzaste')
    expect(payload.body).toContain('Planilla principal')
  })

  it('generarNotificacionRankingCambio (baja) usa título de bajada', async () => {
    await generarNotificacionRankingCambio(USER_ID, 2, 5, 'X')

    const payload = extractPayload()
    expect(payload.title).toBe('Bajaste en el ranking')
    expect(payload.body).toContain('Bajaste')
  })

  it('generarNotificacionNuevoComentario guarda title y body', async () => {
    await generarNotificacionNuevoComentario(USER_ID, 'c-1', 'Juan', 'Excelente prode!')

    const payload = extractPayload()
    expect(payload).toHaveProperty('title')
    expect(payload).toHaveProperty('body')
    expect(payload).not.toHaveProperty('titulo')
    expect(payload).not.toHaveProperty('mensaje')
    expect(payload.title).toBe('Juan comentó')
    expect(payload.body).toBe('Excelente prode!')
  })

  it('generarNotificacionResultado con puntos guarda title y body', async () => {
    await generarNotificacionResultado(USER_ID, MATCH_ID, 'Argentina', 'Brasil', 2, 1, 3)

    const payload = extractPayload()
    expect(payload).toHaveProperty('title')
    expect(payload).toHaveProperty('body')
    expect(payload).not.toHaveProperty('titulo')
    expect(payload).not.toHaveProperty('mensaje')
    expect(payload.title).toBe('¡Resultado publicado!')
    expect(payload.body).toContain('3 puntos')
    expect(payload.body).toContain('Argentina')
    expect(payload.body).toContain('Brasil')
  })

  it('generarNotificacionResultado sin puntos guarda title y body con texto neutro', async () => {
    await generarNotificacionResultado(USER_ID, MATCH_ID, 'Argentina', 'Brasil', 0, 1, 0)

    const payload = extractPayload()
    expect(payload.title).toBe('¡Resultado publicado!')
    expect(payload.body).toContain('Se publicaron los resultados')
    expect(payload.body).not.toMatch(/puntos/i)
  })

  it('todos los generadores incluyen icon en el payload (compatibilidad con push)', async () => {
    await generarNotificacionKickoff(USER_ID, MATCH_ID, 'A', 'B', 'kickoff', new Date())
    await generarNotificacionRankingCambio(USER_ID, 1, 2, 'X')
    await generarNotificacionNuevoComentario(USER_ID, 'c', 'Juan', 'msg')
    await generarNotificacionResultado(USER_ID, MATCH_ID, 'A', 'B', 1, 0, 1)

    for (let i = 0; i < 4; i++) {
      const p = extractPayload(i)
      expect(p).toHaveProperty('icon')
    }
  })
})
