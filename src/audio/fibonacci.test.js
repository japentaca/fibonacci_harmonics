import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FIB_CACHE_SIZE,
  fibonacci,
  partialFrequency,
  buildSeries,
  nyquistLimit,
  mapRange
} from './fibonacci.js'

test('fibonacci returns the expected sequence', () => {
  assert.equal(fibonacci(0), 0)
  assert.equal(fibonacci(1), 1)
  assert.equal(fibonacci(2), 1)
  assert.equal(fibonacci(3), 2)
  assert.equal(fibonacci(4), 3)
  assert.equal(fibonacci(5), 5)
  assert.equal(fibonacci(6), 8)
  assert.equal(fibonacci(10), 55)
  assert.equal(fibonacci(20), 6765)
})

test('fibonacci returns 0 for non positive inputs', () => {
  assert.equal(fibonacci(-1), 0)
  assert.equal(fibonacci(-100), 0)
})

test('fibonacci interpolates fractional arguments', () => {
  assert.equal(fibonacci(2.5), 1.5)
  assert.equal(fibonacci(3.5), 2.5)
  assert.equal(fibonacci(10.5), 72)
})

test('fibonacci saturates at the end of the cache', () => {
  const last = FIB_CACHE_SIZE - 1
  assert.equal(fibonacci(last), 63245986)
  assert.equal(fibonacci(last), fibonacci(last + 1))
  assert.equal(fibonacci(last), fibonacci(1000))
  assert.equal(fibonacci(1e6), 63245986)
})

test('partialFrequency maps the partial number in every mode', () => {
  // fibonacci: fundamental * fib(p + 2)
  assert.equal(partialFrequency(1, 0, 440, 'fibonacci'), 880)
  assert.equal(partialFrequency(2, 0, 440, 'fibonacci'), 1320)
  assert.equal(partialFrequency(3, 0, 440, 'fibonacci'), 2200)

  // harmonic: fundamental * (p + 1)
  assert.equal(partialFrequency(1, 0, 440, 'harmonic'), 880)
  assert.equal(partialFrequency(2, 0, 440, 'harmonic'), 1320)
  assert.equal(partialFrequency(3, 0, 440, 'harmonic'), 1760)

  // legacy: fundamental + fib(p)
  assert.equal(partialFrequency(1, 0, 440, 'legacy'), 441)
  assert.equal(partialFrequency(2, 0, 440, 'legacy'), 441)
  assert.equal(partialFrequency(3, 0, 440, 'legacy'), 442)
})

test('partialFrequency shifts the partial number with the offset', () => {
  // p = index + offset
  assert.equal(partialFrequency(1, 2, 440, 'fibonacci'), 2200)
  assert.equal(partialFrequency(2, 2, 440, 'fibonacci'), 3520)
  assert.equal(partialFrequency(1, 3, 440, 'harmonic'), 2200)
  assert.equal(partialFrequency(2, 3, 440, 'harmonic'), 2640)
  assert.equal(partialFrequency(1, 5, 440, 'legacy'), 448)
  assert.equal(partialFrequency(3, 5, 440, 'legacy'), 461)
})

test('partialFrequency parses the fundamental and falls back to fibonacci', () => {
  assert.equal(partialFrequency(1, 0, '440.5', 'fibonacci'), 881)
  assert.equal(partialFrequency(1, 0, 440, 'unknown-mode'), 880)
})

test('nyquistLimit is 95% of the Nyquist frequency', () => {
  assert.equal(nyquistLimit(44100), 0.95 * (44100 / 2))
  assert.equal(nyquistLimit(48000), 0.95 * (48000 / 2))
  assert.equal(nyquistLimit(44100), 20947.5)
  assert.equal(nyquistLimit(48000), 22800)
})

test('buildSeries starts with the fundamental and follows the mode', () => {
  const limit = nyquistLimit(44100)
  assert.deepEqual(buildSeries(440, 4, 0, 'fibonacci', limit), [440, 880, 1320, 2200])
  assert.deepEqual(buildSeries(440, 4, 0, 'harmonic', limit), [440, 880, 1320, 1760])
  assert.deepEqual(buildSeries(440, 4, 0, 'legacy', limit), [440, 441, 441, 442])
  assert.deepEqual(buildSeries(440, 3, 2, 'fibonacci', limit), [440, 2200, 3520])
})

test('buildSeries trims the partials above the Nyquist limit', () => {
  const limit = nyquistLimit(44100)
  const series = buildSeries(440, 10, 0, 'fibonacci', limit)
  // fib(10) * 440 = 24200 > 20925, so the tail is dropped
  assert.equal(series.length, 8)
  assert.equal(series[7], 14960)
  assert.equal(10 - series.length, 2)
})

test('buildSeries never trims the fundamental itself', () => {
  const series = buildSeries(440, 3, 0, 'fibonacci', 100)
  assert.deepEqual(series, [440])
})

test('mapRange remaps linearly between ranges', () => {
  assert.equal(mapRange(0, 0, 10, -1, 1), -1)
  assert.equal(mapRange(5, 0, 10, -1, 1), 0)
  assert.equal(mapRange(10, 0, 10, -1, 1), 1)
  assert.equal(mapRange(0, 0, 7, -1, 1), -1)
  assert.equal(mapRange(3.5, 0, 7, -1, 1), 0)
  assert.equal(mapRange(7, 0, 7, -1, 1), 1)
})
