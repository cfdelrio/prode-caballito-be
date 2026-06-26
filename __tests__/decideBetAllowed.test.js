'use strict';
const { decideBetAllowed } = require('../routes/bets');

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const PAST   = new Date(Date.now() - 60 * 60 * 1000);

describe('decideBetAllowed', () => {
  test('eliminatoria: allows bet before match cutoff even if locked', () => {
    const r = decideBetAllowed({ hasTournament: true, isEliminatoria: true, locked: true, isAdmin: false, now: new Date(), matchCutoff: FUTURE.toISOString(), tournamentCutoff: null });
    expect(r.allowed).toBe(true);
  });
  test('eliminatoria: blocks bet after match cutoff', () => {
    const r = decideBetAllowed({ hasTournament: true, isEliminatoria: true, locked: false, isAdmin: false, now: new Date(), matchCutoff: PAST.toISOString(), tournamentCutoff: null });
    expect(r.allowed).toBe(false);
    expect(r.error).toMatch(/finalizado/);
  });
  test('eliminatoria: admin bypasses match cutoff', () => {
    const r = decideBetAllowed({ hasTournament: true, isEliminatoria: true, locked: false, isAdmin: true, now: new Date(), matchCutoff: PAST.toISOString(), tournamentCutoff: null });
    expect(r.allowed).toBe(true);
  });
  test('grupos: blocks when planilla locked', () => {
    const r = decideBetAllowed({ hasTournament: true, isEliminatoria: false, locked: true, isAdmin: false, now: new Date(), matchCutoff: FUTURE.toISOString(), tournamentCutoff: FUTURE });
    expect(r.allowed).toBe(false);
    expect(r.error).toMatch(/cerrada/);
  });
  test('grupos: blocks when tournament cutoff passed', () => {
    const r = decideBetAllowed({ hasTournament: true, isEliminatoria: false, locked: false, isAdmin: false, now: new Date(), matchCutoff: FUTURE.toISOString(), tournamentCutoff: PAST });
    expect(r.allowed).toBe(false);
  });
  test('grupos: allows when cutoff future and not locked', () => {
    const r = decideBetAllowed({ hasTournament: true, isEliminatoria: false, locked: false, isAdmin: false, now: new Date(), matchCutoff: FUTURE.toISOString(), tournamentCutoff: FUTURE });
    expect(r.allowed).toBe(true);
  });
  test('grupos: blocks when tournament cutoff is null', () => {
    const r = decideBetAllowed({ hasTournament: true, isEliminatoria: false, locked: false, isAdmin: false, now: new Date(), matchCutoff: FUTURE.toISOString(), tournamentCutoff: null });
    expect(r.allowed).toBe(false);
  });
  test('no tournament: blocks when locked', () => {
    const r = decideBetAllowed({ hasTournament: false, isEliminatoria: false, locked: true, isAdmin: false, now: new Date(), matchCutoff: FUTURE.toISOString(), tournamentCutoff: null });
    expect(r.allowed).toBe(false);
  });
  test('no tournament: blocks when match cutoff passed', () => {
    const r = decideBetAllowed({ hasTournament: false, isEliminatoria: false, locked: false, isAdmin: false, now: new Date(), matchCutoff: PAST.toISOString(), tournamentCutoff: null });
    expect(r.allowed).toBe(false);
  });
  test('no tournament: allows before cutoff and not locked', () => {
    const r = decideBetAllowed({ hasTournament: false, isEliminatoria: false, locked: false, isAdmin: false, now: new Date(), matchCutoff: FUTURE.toISOString(), tournamentCutoff: null });
    expect(r.allowed).toBe(true);
  });
});
