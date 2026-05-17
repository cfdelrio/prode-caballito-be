'use strict'

jest.mock('../db/connection', () => ({
  db: { query: jest.fn() },
}))
jest.mock('../services/push', () => ({
  pushToUser: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../services/whatsapp', () => ({
  sendSMS: jest.fn().mockResolvedValue(undefined),
}))

const { db } = require('../db/connection')
const { pushToUser } = require('../services/push')
const { sendSMS } = require('../services/whatsapp')
const { runCutoffReminders, buildPayload, REMINDER_TYPE } = require('../services/reminderCutoff')

beforeEach(() => {
  db.query.mockReset()
  pushToUser.mockClear()
  sendSMS.mockClear()
})

describe('buildPayload', () => {
  it('mensaje específico cuando falta 1 solo partido', () => {
    const p = buildPayload({ pending: 1, firstMatch: { home_team: 'ARG', away_team: 'BRA' } })
    expect(p.title).toMatch(/30 min/)
    expect(p.body).toBe('ARG vs BRA — todavía no pronosticaste')
    expect(p.url).toBe('/apuestas')
  })

  it('mensaje genérico cuando faltan varios partidos', () => {
    const p = buildPayload({ pending: 3, firstMatch: { home_team: 'ARG', away_team: 'BRA' } })
    expect(p.body).toBe('Te faltan 3 pronósticos — entrá antes del cierre')
  })

  it('mensaje genérico con singular si pending=1 pero sin firstMatch', () => {
    const p = buildPayload({ pending: 1, firstMatch: null })
    expect(p.body).toBe('Te faltan 1 pronóstico — entrá antes del cierre')
  })
})

describe('runCutoffReminders', () => {
  it('no-op si no hay partidos en la ventana', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }) // matches query

    const out = await runCutoffReminders()

    expect(out).toEqual({ matches: 0, users_notified: 0 })
    expect(pushToUser).not.toHaveBeenCalled()
  })

  it('no-op si no hay usuarios con bets faltantes', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'm1', home_team: 'A', away_team: 'B', time_cutoff: new Date() }] })
      .mockResolvedValueOnce({ rows: [] }) // no missing bets

    const out = await runCutoffReminders()

    expect(out.matches).toBe(1)
    expect(out.users_notified).toBe(0)
    expect(pushToUser).not.toHaveBeenCalled()
  })

  it('envía push y registra reminder_sent para usuarios con bets faltantes', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'm1', home_team: 'ARG', away_team: 'BRA', time_cutoff: new Date() }] })
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', match_id: 'm1', home_team: 'ARG', away_team: 'BRA' }],
      })
      .mockResolvedValueOnce({ rows: [{ match_id: 'm1' }] }) // INSERT ... RETURNING
      .mockResolvedValueOnce({ rows: [] }) // SELECT whatsapp_number query

    const out = await runCutoffReminders()

    expect(out).toEqual({ matches: 1, users_notified: 1, skipped: 0 })
    expect(pushToUser).toHaveBeenCalledTimes(1)
    expect(pushToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      title: '⏰ Cierra en 30 min',
      body: 'ARG vs BRA — todavía no pronosticaste',
    }))
  })

  it('skip si reminder_sent ya tiene el registro (ON CONFLICT)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'm1', home_team: 'ARG', away_team: 'BRA', time_cutoff: new Date() }] })
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', match_id: 'm1', home_team: 'ARG', away_team: 'BRA' }],
      })
      .mockResolvedValueOnce({ rows: [] }) // INSERT returned 0 rows = all conflicts

    const out = await runCutoffReminders()

    expect(out.users_notified).toBe(0)
    expect(out.skipped).toBe(1)
    expect(pushToUser).not.toHaveBeenCalled()
  })

  it('agrupa múltiples partidos por usuario en un solo push', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 'm1', home_team: 'ARG', away_team: 'BRA', time_cutoff: new Date() },
          { id: 'm2', home_team: 'URU', away_team: 'CHI', time_cutoff: new Date() },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { user_id: 'u1', match_id: 'm1', home_team: 'ARG', away_team: 'BRA' },
          { user_id: 'u1', match_id: 'm2', home_team: 'URU', away_team: 'CHI' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ match_id: 'm1' }, { match_id: 'm2' }] })
      .mockResolvedValueOnce({ rows: [] }) // SELECT whatsapp_number query

    const out = await runCutoffReminders()

    expect(out.users_notified).toBe(1)
    expect(pushToUser).toHaveBeenCalledTimes(1)
    expect(pushToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      body: 'Te faltan 2 pronósticos — entrá antes del cierre',
    }))
  })

  it('no rompe si pushToUser falla — loggea y sigue', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'm1', home_team: 'A', away_team: 'B', time_cutoff: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', match_id: 'm1', home_team: 'A', away_team: 'B' }] })
      .mockResolvedValueOnce({ rows: [{ match_id: 'm1' }] })
      .mockResolvedValueOnce({ rows: [] }) // SELECT whatsapp_number query
    pushToUser.mockRejectedValueOnce(new Error('boom'))

    const out = await runCutoffReminders()

    expect(out.users_notified).toBe(1)
  })

  it('REMINDER_TYPE es estable', () => {
    expect(REMINDER_TYPE).toBe('cutoff_30min')
  })

  it('envía SMS si el usuario tiene whatsapp_number y whatsapp_consent', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'm1', home_team: 'ARG', away_team: 'BRA', time_cutoff: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', match_id: 'm1', home_team: 'ARG', away_team: 'BRA' }] })
      .mockResolvedValueOnce({ rows: [{ match_id: 'm1' }] })
      .mockResolvedValueOnce({ rows: [{ whatsapp_number: '+5491155996222', whatsapp_consent: true }] })

    await runCutoffReminders()

    expect(sendSMS).toHaveBeenCalledTimes(1)
    expect(sendSMS).toHaveBeenCalledWith(expect.objectContaining({
      to: '+5491155996222',
      body: expect.stringContaining('ARG vs BRA'),
    }))
  })

  it('no envía SMS si whatsapp_consent es false', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'm1', home_team: 'ARG', away_team: 'BRA', time_cutoff: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', match_id: 'm1', home_team: 'ARG', away_team: 'BRA' }] })
      .mockResolvedValueOnce({ rows: [{ match_id: 'm1' }] })
      .mockResolvedValueOnce({ rows: [{ whatsapp_number: '+5491155996222', whatsapp_consent: false }] })

    await runCutoffReminders()

    expect(sendSMS).not.toHaveBeenCalled()
  })

  it('no envía SMS si el usuario no tiene whatsapp_number', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'm1', home_team: 'ARG', away_team: 'BRA', time_cutoff: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', match_id: 'm1', home_team: 'ARG', away_team: 'BRA' }] })
      .mockResolvedValueOnce({ rows: [{ match_id: 'm1' }] })
      .mockResolvedValueOnce({ rows: [{ whatsapp_number: null, whatsapp_consent: true }] })

    await runCutoffReminders()

    expect(sendSMS).not.toHaveBeenCalled()
  })

  it('no rompe si sendSMS falla — loggea y sigue', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'm1', home_team: 'A', away_team: 'B', time_cutoff: new Date() }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', match_id: 'm1', home_team: 'A', away_team: 'B' }] })
      .mockResolvedValueOnce({ rows: [{ match_id: 'm1' }] })
      .mockResolvedValueOnce({ rows: [{ whatsapp_number: '+5491155996222', whatsapp_consent: true }] })
    sendSMS.mockRejectedValueOnce(new Error('infobip down'))

    const out = await runCutoffReminders()

    expect(out.users_notified).toBe(1)
  })
})
