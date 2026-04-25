'use strict'

const cache = require('../services/cache')

beforeEach(() => {
  // Reset store between tests by invalidating everything
  // We call invalidatePrefix('') which matches all keys
  cache.invalidatePrefix('')
})

describe('get / set', () => {
  it('devuelve null para clave inexistente', () => {
    expect(cache.get('no-existe')).toBeNull()
  })

  it('devuelve el valor almacenado', () => {
    cache.set('k1', { foo: 'bar' })
    expect(cache.get('k1')).toEqual({ foo: 'bar' })
  })

  it('devuelve null después de que expira el TTL', async () => {
    cache.set('k2', 'val', 10) // TTL 10ms
    await new Promise(r => setTimeout(r, 20))
    expect(cache.get('k2')).toBeNull()
  })

  it('no expira antes del TTL', async () => {
    cache.set('k3', 'vivo', 500)
    await new Promise(r => setTimeout(r, 10))
    expect(cache.get('k3')).toBe('vivo')
  })

  it('sobreescribe valor existente', () => {
    cache.set('k4', 'v1')
    cache.set('k4', 'v2')
    expect(cache.get('k4')).toBe('v2')
  })
})

describe('invalidate', () => {
  it('elimina una clave específica', () => {
    cache.set('a', 1)
    cache.set('b', 2)
    cache.invalidate('a')
    expect(cache.get('a')).toBeNull()
    expect(cache.get('b')).toBe(2)
  })

  it('no lanza si la clave no existe', () => {
    expect(() => cache.invalidate('fantasma')).not.toThrow()
  })
})

describe('invalidatePrefix', () => {
  it('elimina todas las claves con el prefijo', () => {
    cache.set('tournaments:active', [1, 2])
    cache.set('tournaments:all', [3])
    cache.set('team_badges', { a: 'b' })
    cache.invalidatePrefix('tournaments:')
    expect(cache.get('tournaments:active')).toBeNull()
    expect(cache.get('tournaments:all')).toBeNull()
    expect(cache.get('team_badges')).toEqual({ a: 'b' })
  })

  it('no lanza si ninguna clave coincide', () => {
    expect(() => cache.invalidatePrefix('xyz:')).not.toThrow()
  })
})

describe('getOrFetch', () => {
  it('llama fetchFn en miss y cachea el resultado', async () => {
    const fetch = jest.fn().mockResolvedValue('fetched')
    const val = await cache.getOrFetch('miss-key', fetch)
    expect(val).toBe('fetched')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('no llama fetchFn en hit', async () => {
    cache.set('hit-key', 'cached')
    const fetch = jest.fn()
    const val = await cache.getOrFetch('hit-key', fetch)
    expect(val).toBe('cached')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('vuelve a llamar fetchFn después de expirar', async () => {
    const fetch = jest.fn().mockResolvedValue('nuevo')
    await cache.getOrFetch('exp-key', () => Promise.resolve('viejo'), 10)
    await new Promise(r => setTimeout(r, 20))
    const val = await cache.getOrFetch('exp-key', fetch)
    expect(val).toBe('nuevo')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('propaga errores del fetchFn sin cachear', async () => {
    const fetch = jest.fn().mockRejectedValue(new Error('db error'))
    await expect(cache.getOrFetch('err-key', fetch)).rejects.toThrow('db error')
    expect(cache.get('err-key')).toBeNull()
  })
})
