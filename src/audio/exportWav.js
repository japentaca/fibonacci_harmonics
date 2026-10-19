import * as Tone from 'tone'
import { buildSeries, nyquistLimit, panForPartial, sliderToDb } from './fibonacci.js'
import { encodeWav } from './wav.js'
import { MUTE_DB } from './constants.js'

export const EXPORT_DURATION = 6
export const EXPORT_FADE = 0.1
export const EXPORT_CHANNELS = 2

function pad(value) {
  return String(value).padStart(2, '0')
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Name of the exported file: fibonacci-harmonics-<preset or session>-<date>.wav
export function buildFilename(presetName, date = new Date()) {
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
  const label = presetName ? slugify(presetName) : 'session'
  return `fibonacci-harmonics-${label}-${stamp}.wav`
}

// The series of partials of the export: exactly the same one the app plays,
// with the same Nyquist guard of the sample rate of the render
export function buildExportSeries(state, sampleRate) {
  return buildSeries(
    state.fundamental,
    state.cantArmonicos,
    parseFloat(state.offset),
    state.mappingMode,
    nyquistLimit(sampleRate)
  )
}

// The dB the voices are rendered with: the same volume of the app
export function exportVolumeDb(state) {
  return state.volumeSlider <= 0 ? MUTE_DB : sliderToDb(state.volumeSlider)
}

// Renders the state with Tone.Offline: the same series of partials, the same
// oscillator type, the same volume and the same ping-pong delay of the app.
// The arpeggiator and the LFOs are not rendered: the series is static.
export async function renderOffline(state, options = {}) {
  const duration = options.duration || EXPORT_DURATION
  const fade = Math.min(options.fade === undefined ? EXPORT_FADE : options.fade, duration / 2)
  const channels = options.channels || EXPORT_CHANNELS

  return Tone.Offline((context) => {
    const masterBus = new Tone.Gain(1)
    const limiter = new Tone.Limiter(-1)
    const fadeGain = new Tone.Gain(0)
    masterBus.connect(limiter)
    limiter.connect(fadeGain)
    fadeGain.toDestination()

    // Ping-pong delay, taken from the master bus exactly like in the app
    const delayNode = new Tone.PingPongDelay(state.delayTime, state.delayFeedback)
    const delaySendGain = new Tone.Gain((state.delaySend || 0) / 100)
    delayNode.wet.value = 1
    masterBus.connect(delaySendGain)
    delaySendGain.connect(delayNode)
    delayNode.connect(limiter)

    const series = buildExportSeries(state, context.sampleRate)
    const db = exportVolumeDb(state)

    series.forEach((frequency, index) => {
      const osc = new Tone.Oscillator(frequency, 'sine')
      // The type is set after the construction, so the types with partials
      // (sine2, sawtooth3...) are built as periodic waves
      osc.type = state.oscillatorType || 'sine'
      const panner = new Tone.Panner(panForPartial(index, series.length))
      osc.volume.value = db
      osc.connect(panner)
      panner.connect(masterBus)
      osc.start(0)
      osc.stop(duration)
    })

    // Fade in and out, so the file never starts or ends with a click
    fadeGain.gain.setValueAtTime(0, 0)
    fadeGain.gain.linearRampToValueAtTime(1, fade)
    fadeGain.gain.setValueAtTime(1, duration - fade)
    fadeGain.gain.linearRampToValueAtTime(0, duration)
  }, duration, channels)
}

// Renders the state and encodes it as a 16-bit PCM WAV file
export async function exportWav(state, options = {}) {
  const buffer = await renderOffline(state, options)
  const arrayBuffer = encodeWav(buffer)
  const blob = new Blob([arrayBuffer], { type: 'audio/wav' })
  return {
    blob,
    filename: buildFilename(options.presetName, options.date),
    duration: buffer.duration,
    sampleRate: buffer.sampleRate
  }
}

// Saves the blob in the downloads of the browser
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return filename
}
