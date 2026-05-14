'use strict'

// Mock DB connection (no DB needed for inbound endpoints, but required by module load)
jest.mock('../db/connection', () => ({ db: { query: jest.fn() } }))
jest.mock('../middleware/auth', () => ({
  authMiddleware: (_req, _res, next) => next(),
  requireAdmin:   (_req, _res, next) => next(),
}))

const express = require('express')
const request = require('supertest')
const voiceRouter = require('../routes/voice')

function buildApp() {
  const app = express()
  app.use(express.urlencoded({ extended: false }))
  app.use(express.json())
  app.use('/api/voice', voiceRouter)
  return app
}

// ─── POST /api/voice (inbound) ────────────────────────────────────────────────

describe('POST /api/voice', () => {
  it('responde 200 con Content-Type text/xml', async () => {
    const res = await request(buildApp())
      .post('/api/voice')
      .send({ CallSid: 'CA123', From: '+5491155996222' })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/xml/)
  })

  it('devuelve TwiML con <Gather> y <Say> de bienvenida', async () => {
    const res = await request(buildApp()).post('/api/voice').send({})

    expect(res.text).toContain('<Gather')
    expect(res.text).toContain('<Say')
    expect(res.text).toContain('ProdeCaballito')
  })

  it('el Gather apunta a /api/voice/menu', async () => {
    const res = await request(buildApp()).post('/api/voice').send({})
    expect(res.text).toMatch(/action="[^"]*\/voice\/menu"/)
  })

  it('menciona las 4 opciones', async () => {
    const res = await request(buildApp()).post('/api/voice').send({})
    expect(res.text).toMatch(/presioná 1/i)
    expect(res.text).toMatch(/presioná 2/i)
    expect(res.text).toMatch(/presioná 3/i)
    expect(res.text).toMatch(/presioná 4/i)
  })

  it('incluye fallback si no se presiona nada', async () => {
    const res = await request(buildApp()).post('/api/voice').send({})
    // El <Say> fuera del <Gather> es el fallback
    const fallbackCount = (res.text.match(/<Say/g) || []).length
    expect(fallbackCount).toBeGreaterThanOrEqual(2)
  })
})

// ─── POST /api/voice/menu ─────────────────────────────────────────────────────

describe('POST /api/voice/menu', () => {
  it('opción 1 → reproduce el reglamento', async () => {
    const res = await request(buildApp())
      .post('/api/voice/menu')
      .send({ Digits: '1', CallSid: 'CA456' })

    expect(res.status).toBe(200)
    expect(res.text).toMatch(/reglamento/i)
    expect(res.text).toMatch(/90 minutos/i)
  })

  it('opción 2 → reproduce cómo jugar', async () => {
    const res = await request(buildApp())
      .post('/api/voice/menu')
      .send({ Digits: '2' })

    expect(res.text).toMatch(/ingresá a ProdeCaballito/i)
    expect(res.text).toMatch(/ranking en vivo/i)
  })

  it('opción 3 → reproduce info de la primera ronda', async () => {
    const res = await request(buildApp())
      .post('/api/voice/menu')
      .send({ Digits: '3' })

    expect(res.text).toMatch(/primera ronda/i)
    expect(res.text).toMatch(/segunda ronda/i)
  })

  it('opción 4 → reproduce info del canal de WhatsApp', async () => {
    const res = await request(buildApp())
      .post('/api/voice/menu')
      .send({ Digits: '4' })

    expect(res.text).toMatch(/WhatsApp/i)
    expect(res.text).toMatch(/canal oficial/i)
  })

  it('opción válida ofrece volver al menú', async () => {
    const res = await request(buildApp())
      .post('/api/voice/menu')
      .send({ Digits: '2' })

    expect(res.text).toMatch(/menú principal/i)
    expect(res.text).toContain('<Gather')
  })

  it('opción inválida → reproduce el menú de nuevo', async () => {
    const res = await request(buildApp())
      .post('/api/voice/menu')
      .send({ Digits: '9' })

    expect(res.status).toBe(200)
    expect(res.text).toContain('<Gather')
    expect(res.text).toMatch(/presioná 1/i)
  })

  it('sin dígito → reproduce el menú de nuevo', async () => {
    const res = await request(buildApp())
      .post('/api/voice/menu')
      .send({})

    expect(res.status).toBe(200)
    expect(res.text).toContain('<Gather')
  })

  it('cada respuesta es XML válido (tiene declaración XML)', async () => {
    for (const digit of ['1', '2', '3', '4', '9']) {
      const res = await request(buildApp())
        .post('/api/voice/menu')
        .send({ Digits: digit })
      expect(res.text).toMatch(/^<\?xml/)
    }
  })
})

// ─── GET /api/voice (sanity check) ───────────────────────────────────────────

describe('GET /api/voice', () => {
  it('responde 200 con XML', async () => {
    const res = await request(buildApp()).get('/api/voice')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/xml/)
  })
})
