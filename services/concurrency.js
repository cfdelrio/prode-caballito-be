'use strict'

/**
 * Runs `fn` over `items` with at most `concurrency` simultaneous promises.
 * Returns Promise.allSettled results in order.
 */
async function runConcurrent(items, fn, concurrency = 10) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const chunkResults = await Promise.allSettled(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

module.exports = { runConcurrent }
