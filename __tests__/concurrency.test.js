'use strict'

const { runConcurrent } = require('../services/concurrency')

describe('runConcurrent', () => {
  it('procesa todos los items y devuelve resultados en orden', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await runConcurrent(items, async (n) => n * 2)
    expect(results).toHaveLength(5)
    expect(results.map(r => r.value)).toEqual([2, 4, 6, 8, 10])
    expect(results.every(r => r.status === 'fulfilled')).toBe(true)
  })

  it('devuelve status rejected para items que fallan', async () => {
    const items = [1, 2, 3]
    const results = await runConcurrent(items, async (n) => {
      if (n === 2) throw new Error('fallo en 2')
      return n
    })
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 1 })
    expect(results[1]).toMatchObject({ status: 'rejected' })
    expect(results[1].reason.message).toBe('fallo en 2')
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: 3 })
  })

  it('no detiene el procesamiento si un item falla', async () => {
    const processed = []
    await runConcurrent([1, 2, 3, 4], async (n) => {
      if (n === 2) throw new Error('error')
      processed.push(n)
    })
    expect(processed).toEqual(expect.arrayContaining([1, 3, 4]))
  })

  it('respeta el límite de concurrencia', async () => {
    let activeConcurrent = 0
    let maxObserved = 0
    const concurrency = 3

    await runConcurrent([1, 2, 3, 4, 5, 6], async () => {
      activeConcurrent++
      maxObserved = Math.max(maxObserved, activeConcurrent)
      await new Promise(r => setTimeout(r, 10))
      activeConcurrent--
    }, concurrency)

    expect(maxObserved).toBeLessThanOrEqual(concurrency)
  })

  it('funciona con array vacío', async () => {
    const results = await runConcurrent([], async (x) => x)
    expect(results).toEqual([])
  })

  it('funciona con un solo item', async () => {
    const results = await runConcurrent(['solo'], async (x) => x.toUpperCase())
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'SOLO' })
  })

  it('usa concurrencia 10 por defecto', async () => {
    let maxActive = 0
    let active = 0
    const items = Array.from({ length: 25 }, (_, i) => i)
    await runConcurrent(items, async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise(r => setTimeout(r, 5))
      active--
    })
    expect(maxActive).toBeLessThanOrEqual(10)
  })
})
