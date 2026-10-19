// Pure math for the harmonic series: no Vue state and no Tone.js here, so the
// series can be computed and tested in isolation.

import { DEFAULT_SAMPLE_RATE, NYQUIST_RATIO, MIN_DB, MAX_DB } from './constants.js'

// Highest partial index in use is ~31 (10 voices + offset 20), so 40 entries
// are enough for every reachable frequency.
export const FIB_CACHE_SIZE = 40

const fibCache = [0, 1, 1]
for (let i = 3; i < FIB_CACHE_SIZE; i++) {
  fibCache[i] = fibCache[i - 1] + fibCache[i - 2]
}

export function fibonacci(n) {
  if (n <= 0) return 0
  const lastIndex = fibCache.length - 1
  if (n >= lastIndex) return fibCache[lastIndex]
  const lower = Math.floor(n)
  const upper = Math.ceil(n)
  if (lower === upper) return fibCache[lower]
  const frac = n - lower
  return fibCache[lower] * (1 - frac) + fibCache[upper] * frac
}

// Frequency of the partial placed at position i (i >= 1) of the series.
// The partial number is p = i + offset, so offset shifts the starting partial.
export function partialFrequency(index, offsetValue, fundamental, mode) {
  const f = parseFloat(fundamental)
  const p = index + offsetValue
  switch (mode) {
    case 'harmonic':
      return f * (p + 1)
    case 'legacy':
      // legacy keeps the old additive cluster: fundamental + fib(p)
      return f + fibonacci(p)
    case 'fibonacci':
    default:
      return f * fibonacci(p + 2)
  }
}

// The series of frequencies played by the oscillators. The first entry is
// always the fundamental, the rest are partials shifted by the offset.
// Partials above the Nyquist limit are dropped as a suffix.
export function buildSeries(fundamental, count, offsetValue, mode, limit) {
  const f = parseFloat(fundamental)
  const series = []
  for (let i = 0; i < count; i++) {
    const v = i === 0 ? f : partialFrequency(i, offsetValue, fundamental, mode)
    // Frequencies grow with the partial number, so the guard always trims the tail
    if (i > 0 && v > limit) break
    series.push(v)
  }
  return series
}

// Upper limit for a partial: 95% of the Nyquist frequency
export function nyquistLimit(sampleRate = DEFAULT_SAMPLE_RATE) {
  return NYQUIST_RATIO * (sampleRate / 2)
}

// Linear remap of a value from one range to another.
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin
}

// Pan position of a partial: the fundamental stays in the center and the rest
// are spread symmetrically over [-1, 1].
export function panForPartial(index, total) {
  if (total <= 1 || index <= 0) return 0
  if (total === 2) return 0
  const span = total - 2
  const pos = index - 1
  const pan = (pos / span) * 2 - 1
  return Math.min(1, Math.max(-1, pan))
}

// Converts the linear volume slider (0-100) into the dB value of the synth.
export function sliderToDb(slider) {
  const normalized = Math.max(0, Math.min(100, Number(slider) || 0)) / 100
  return MIN_DB + normalized * (MAX_DB - MIN_DB)
}
