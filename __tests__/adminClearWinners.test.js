'use strict'

jest.mock('../db/connection', () => ({
  db: { query: jest.fn().mockResolvedValue({ rows: [] }) },
}))
jest.mock('../middleware/auth', () => ({
  authMiddleware: (req, _res, next) => { req.user = { userId: 'admin-1' }; next() },
  requireAdmin: (_req, _res, next) => next(),
}))
jest.mock('../middleware/validation', () => ({
  adminTestWhatsappValidation: (_req, _res, next) => next(),
  adminWeeklyEmailValidation: (_req, _res, next) => next(),
  adminWinnerImageValidation: (_req, _res, next) => next(),
  adminRecalcMatchdayValidation: (_req, _res, next) => next(),
  adminSendWelcomeValidation: (_req, _res, next) => next(),
  adminTriggerWinnerValidation: (_req, _res, next) => next(),
}))
jest.mock('../services/whatsapp', () => ({ sendWhatsApp: jest.fn(), sendSMS: jest.fn() }))
jest.mock('../services/email', () => ({ sendWeeklyEmail: jest.fn(), sendWelcomeEmail: jest.fn() }))

const express = require('express')
const request = require('supertest')
const adminRouter = require('../routes/admin')
const { db } = require('../db/connection')

const app = express()
app.use(express.json())
app.use('/admin', adminRouter.default || adminRouter)

beforeEach(() => {
  db.query.mockClear()
  db.query.mockResolvedValue({ rows: [] })
})

describe('DELETE /admin/clear-winners', () => {
  it('retorna success:true y ejecuta dos queries', async () => {
    const res = await request(app).delete('/admin/clear-winners')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it('primer query upsertea ganadores_fechas con array vacío', async () => {
    await request(app).delete('/admin/clear-winners')
    const firstCall = db.query.mock.calls[0]
    expect(firstCall[0]).toContain('ganadores_fechas')
    expect(firstCall[0]).toContain("'[]'")
  })

  it('segundo query borra ganador_fecha', async () => {
    await request(app).delete('/admin/clear-winners')
    const secondCall = db.query.mock.calls[1]
    expect(secondCall[0]).toContain('DELETE FROM config')
    expect(secondCall[0]).toContain('ganador_fecha')
  })

  it('devuelve 500 si la DB falla', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'))
    const res = await request(app).delete('/admin/clear-winners')
    expect(res.status).toBe(500)
    expect(res.body.success).toBe(false)
  })
})
