import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFilename, buildExportSeries, exportVolumeDb, EXPORT_DURATION, EXPORT_FADE } from './exportWav.js'
import { buildSeries, nyquistLimit } from './fibonacci.js'
import { MIN_DB, MAX_DB, MUTE_DB } from './constants.js'

const STATE = {
  fundamental: 220,
  cantArmonicos: 5,
  offset: 2,
  mappingMode: 'fibonacci',
  oscillatorType: 'sine',
  volumeSlider: 80,
  delaySend: 35,
  delayTime: 0.4,
  delayFeedback: 0.45
}

test('the exported file is named after the preset and the date', () => {
  const date = new Date(2024, 4, 7, 9, 5)
  assert.equal(buildFilename('Warm Pad', date), 'fibonacci-harmonics-warm-pad-2024-05-07-0905.wav')
})

test('a session without a preset gets a generic name', () => {
  const date = new Date(2024, 11, 31, 23, 59)
  assert.equal(buildFilename(null, date), 'fibonacci-harmonics-session-2024-12-31-2359.wav')
  assert.equal(buildFilename(undefined, date), 'fibonacci-harmonics-session-2024-12-31-2359.wav')
})

test('the name only holds safe characters', () => {
  const name = buildFilename('Fundamental Drift / "Up-Down"!', new Date(2024, 0, 2, 3, 4))
  assert.match(name, /^fibonacci-harmonics-[a-z0-9-]+-\d{4}-\d{2}-\d{2}-\d{4}\.wav$/)
})

test('the render lasts six seconds with a fade of about 100 ms', () => {
  assert.equal(EXPORT_DURATION, 6)
  assert.ok(Math.abs(EXPORT_FADE - 0.1) < 0.001)
})

test('the exported series is exactly the series of the app', () => {
  const sampleRate = 48000
  const expected = buildSeries(220, 5, 2, 'fibonacci', nyquistLimit(sampleRate))
  assert.deepEqual(buildExportSeries(STATE, sampleRate), expected)
  assert.equal(expected[0], 220)
})

test('the exported series respects the Nyquist guard of the render', () => {
  const sampleRate = 44100
  const series = buildExportSeries({ ...STATE, fundamental: 3000, cantArmonicos: 10 }, sampleRate)
  const limit = nyquistLimit(sampleRate)
  assert.ok(series.length > 0)
  series.slice(1).forEach(frequency => assert.ok(frequency <= limit))
})

test('the exported volume is the volume of the app', () => {
  const expected = MIN_DB + (80 / 100) * (MAX_DB - MIN_DB)
  assert.equal(exportVolumeDb(STATE), expected)
  // a muted session is rendered silent
  assert.equal(exportVolumeDb({ ...STATE, volumeSlider: 0 }), MUTE_DB)
})
