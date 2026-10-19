// Shared constants for the audio engine.

export const maxArmonicos = 10
export const MIN_DB = -60
export const MAX_DB = -10
// Gain applied to the voices when muted: finite, never -Infinity
export const MUTE_DB = -100
// Control rate loop for the LFOs that drive discrete values
export const CONTROL_RATE_MS = 33
// Fade applied when the native fundamental LFO starts or stops
export const LFO_FADE = 0.05
export const ARPEGGIATOR_GAIN_BOOST_DB = 6
export const MAX_ARPEGGIATOR_OSCILLATORS = 8
export const ARPEGGIO_ATTACK = 0.01
export const ARPEGGIO_RELEASE = 0.05
export const TEMPO_DEBOUNCE_MS = 500
export const DEFAULT_SAMPLE_RATE = 44100
export const NYQUIST_RATIO = 0.95
// Time the voices stay silent during a panic, in milliseconds
export const PANIC_SILENCE_MS = 150

// Tone.js oscillator types used by the LFOs.
// Tone.js has no inverse sawtooth: it is a sawtooth with the range inverted.
export const LFO_TYPE_MAP = {
  sine: 'sine',
  triangle: 'triangle',
  square: 'square',
  sawtooth: 'sawtooth',
  'inv sawtooth': 'sawtooth'
}
