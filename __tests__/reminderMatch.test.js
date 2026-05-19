'use strict';

jest.mock('../db/connection', () => ({
  db: { query: jest.fn() },
}));
jest.mock('../services/push', () => ({
  pushToUser: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/whatsapp', () => ({
  sendSMS: jest.fn().mockResolvedValue({ id: 'sms1', status: 'PENDING_ACCEPTED' }),
}));

const { db } = require('../db/connection');
const { pushToUser } = require('../services/push');
const { sendSMS } = require('../services/whatsapp');
const { runMatchReminders } = require('../services/reminderMatch');

beforeEach(() => {
  db.query.mockReset();
  pushToUser.mockClear();
  sendSMS.mockClear();
});

const makeRow = (overrides = {}) => ({
  id: 'br1',
  user_id: 'u1',
  remind_minutes: 30,
  home_team: 'ARG',
  away_team: 'BRA',
  start_time: new Date(Date.now() + 31 * 60 * 1000),
  goles_local: 2,
  goles_visitante: 1,
  whatsapp_number: '+5491155996222',
  whatsapp_consent: true,
  ...overrides,
});

describe('runMatchReminders', () => {
  it('no-op si no hay reminders pendientes', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const out = await runMatchReminders();

    expect(out).toEqual({ reminders: 0, notified: 0 });
    expect(pushToUser).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('envía push y SMS con pronóstico para usuario con whatsapp', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [makeRow()] })      // SELECT pending
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'br1' }] }); // UPDATE mark sent

    const out = await runMatchReminders();

    expect(out).toEqual({ reminders: 1, notified: 1 });
    expect(pushToUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      title: '⏰ Empieza en 30 min',
      body: 'ARG vs BRA — tu pronóstico: 2-1',
    }));
    expect(sendSMS).toHaveBeenCalledWith(expect.objectContaining({
      to: '+5491155996222',
      body: expect.stringContaining('2-1'),
    }));
  });

  it('no envía SMS si el usuario no tiene whatsapp_number', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [makeRow({ whatsapp_number: null })] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'br1' }] });

    await runMatchReminders();

    expect(pushToUser).toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('no envía SMS si whatsapp_consent es false', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [makeRow({ whatsapp_consent: false })] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'br1' }] });

    await runMatchReminders();

    expect(pushToUser).toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('no re-procesa reminders ya enviados (rowCount = 0)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }); // already sent

    const out = await runMatchReminders();

    expect(out.notified).toBe(0);
    expect(pushToUser).not.toHaveBeenCalled();
  });

  it('el SMS incluye el pronóstico en formato local-visitante', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [makeRow({ goles_local: 0, goles_visitante: 3 })] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'br1' }] });

    await runMatchReminders();

    expect(sendSMS).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining('0-3'),
    }));
  });
});
