// Pure state handling for the built-in presets and the shareable links.
// This module must not import Vue nor Tone.js, so it can be tested with node --test.

export const MAPPING_MODES = ['fibonacci', 'harmonic', 'legacy']
export const ARPEGGIATOR_TYPES = ['up', 'down', 'updown', 'random']
export const LFO_TYPES = ['sine', 'triangle', 'square', 'sawtooth', 'inv sawtooth']

const OSCILLATOR_BASES = ['sine', 'sawtooth', 'triangle', 'square']
export const OSCILLATOR_TYPES = OSCILLATOR_BASES.flatMap(base => [base].concat(['2', '3', '4', '5'].map(n => base + n)))

// Valid range of every scalar field of the state
export const STATE_LIMITS = {
  fundamental: [80, 3000],
  cantArmonicos: [1, 10],
  offset: [0, 20],
  volumeSlider: [0, 100],
  delaySend: [0, 100],
  delayTime: [0.05, 1],
  delayFeedback: [0, 0.9],
  arpeggiatorTempo: [50, 500]
}

// Valid range of the range slider of every LFO
export const LFO_LIMITS = {
  fundamental: [80, 3000],
  cantArmonicos: [1, 10],
  offset: [0, 20]
}

// Speed of the LFOs, in Hz (the UI slider is exponential between both values)
export const LFO_SPEED_LIMITS = [0.01, 5]

// Step of the arpeggiator tempo slider, in milliseconds
export const TEMPO_STEP = 10

export const STATE_VERSION = 1
export const HASH_PREFIX = '#s='

export const DEFAULT_STATE = {
  fundamental: 440,
  cantArmonicos: 3,
  offset: 2,
  mappingMode: 'fibonacci',
  oscillatorType: 'sine',
  volumeSlider: 80,
  delaySend: 25,
  delayTime: 0.25,
  delayFeedback: 0.4,
  arpeggiatorType: 'up',
  arpeggiatorTempo: 150,
  lfos: {
    fundamental: { active: false, type: 'sine', speed: 0.5, range: [220, 660] },
    cantArmonicos: { active: false, type: 'triangle', speed: 0.2, range: [2, 6] },
    offset: { active: false, type: 'sine', speed: 0.1, range: [0, 5] }
  }
}

export const BUILTIN_PRESETS = [
  {
    name: 'Warm Pad',
    state: {
      fundamental: 220,
      cantArmonicos: 5,
      offset: 0,
      mappingMode: 'fibonacci',
      oscillatorType: 'sine',
      volumeSlider: 70,
      delaySend: 35,
      delayTime: 0.4,
      delayFeedback: 0.45,
      arpeggiatorType: 'up',
      arpeggiatorTempo: 320,
      lfos: {
        fundamental: { active: false, type: 'sine', speed: 0.08, range: [180, 260] },
        cantArmonicos: { active: false, type: 'triangle', speed: 0.05, range: [3, 6] },
        offset: { active: false, type: 'sine', speed: 0.03, range: [0, 3] }
      }
    }
  },
  {
    name: 'Legacy Cluster',
    state: {
      fundamental: 110,
      cantArmonicos: 8,
      offset: 0,
      mappingMode: 'legacy',
      oscillatorType: 'square',
      volumeSlider: 55,
      delaySend: 20,
      delayTime: 0.3,
      delayFeedback: 0.3,
      arpeggiatorType: 'up',
      arpeggiatorTempo: 200,
      lfos: {
        fundamental: { active: false, type: 'sawtooth', speed: 0.05, range: [100, 130] },
        cantArmonicos: { active: false, type: 'square', speed: 0.1, range: [4, 8] },
        offset: { active: false, type: 'sine', speed: 0.1, range: [0, 4] }
      }
    }
  },
  {
    name: 'Fundamental Drift',
    state: {
      fundamental: 330,
      cantArmonicos: 4,
      offset: 1,
      mappingMode: 'fibonacci',
      oscillatorType: 'triangle',
      volumeSlider: 75,
      delaySend: 25,
      delayTime: 0.5,
      delayFeedback: 0.5,
      arpeggiatorType: 'updown',
      arpeggiatorTempo: 180,
      lfos: {
        fundamental: { active: true, type: 'sine', speed: 0.12, range: [180, 520] },
        cantArmonicos: { active: false, type: 'triangle', speed: 0.05, range: [2, 5] },
        offset: { active: false, type: 'sine', speed: 0.03, range: [0, 3] }
      }
    }
  },
  {
    name: 'Bright Shimmer',
    state: {
      fundamental: 440,
      cantArmonicos: 7,
      offset: 3,
      mappingMode: 'harmonic',
      oscillatorType: 'sawtooth2',
      volumeSlider: 60,
      delaySend: 45,
      delayTime: 0.25,
      delayFeedback: 0.6,
      arpeggiatorType: 'up',
      arpeggiatorTempo: 120,
      lfos: {
        fundamental: { active: false, type: 'sine', speed: 0.2, range: [330, 660] },
        cantArmonicos: { active: false, type: 'square', speed: 0.08, range: [4, 7] },
        offset: { active: false, type: 'triangle', speed: 0.04, range: [0, 6] }
      }
    }
  },
  {
    name: 'Slow Swell',
    state: {
      fundamental: 110,
      cantArmonicos: 6,
      offset: 8,
      mappingMode: 'fibonacci',
      oscillatorType: 'sine',
      volumeSlider: 80,
      delaySend: 40,
      delayTime: 0.75,
      delayFeedback: 0.55,
      arpeggiatorType: 'down',
      arpeggiatorTempo: 420,
      lfos: {
        fundamental: { active: false, type: 'sine', speed: 0.05, range: [90, 140] },
        cantArmonicos: { active: true, type: 'triangle', speed: 0.04, range: [2, 8] },
        offset: { active: true, type: 'sine', speed: 0.02, range: [0, 12] }
      }
    }
  },
  {
    name: 'Random Machine',
    state: {
      fundamental: 330,
      cantArmonicos: 6,
      offset: 5,
      mappingMode: 'fibonacci',
      oscillatorType: 'square3',
      volumeSlider: 65,
      delaySend: 30,
      delayTime: 0.375,
      delayFeedback: 0.5,
      arpeggiatorType: 'random',
      arpeggiatorTempo: 90,
      lfos: {
        fundamental: { active: false, type: 'sawtooth', speed: 0.3, range: [220, 440] },
        cantArmonicos: { active: true, type: 'square', speed: 0.08, range: [3, 7] },
        offset: { active: false, type: 'sine', speed: 0.06, range: [0, 8] }
      }
    }
  }
]

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64_LOOKUP = (() => {
  const lookup = {}
  for (let i = 0; i < BASE64_CHARS.length; i++) lookup[BASE64_CHARS[i]] = i
  return lookup
})()

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function base64Encode(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined
    out += BASE64_CHARS[b0 >> 2]
    out += BASE64_CHARS[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)]
    out += b1 === undefined ? '=' : BASE64_CHARS[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)]
    out += b2 === undefined ? '=' : BASE64_CHARS[b2 & 63]
  }
  return out
}

function base64Decode(text) {
  const clean = text.replace(/=+$/, '')
  const bytes = []
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = [0, 1, 2, 3].map(offset => {
      const char = clean[i + offset]
      if (char === undefined) return -1
      const value = BASE64_LOOKUP[char]
      if (value === undefined) throw new Error('invalid base64 character')
      return value
    })
    const [c0, c1, c2, c3] = chunk
    bytes.push(((c0 << 2) | (c1 >> 4)) & 0xff)
    if (c2 >= 0) bytes.push(((c1 << 4) | (c2 >> 2)) & 0xff)
    if (c3 >= 0) bytes.push(((c2 << 6) | c3) & 0xff)
  }
  return new Uint8Array(bytes)
}

function toBase64Url(bytes) {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  return base64Decode(padded)
}

function normalizeLfo(key, lfo) {
  const base = DEFAULT_STATE.lfos[key]
  const [min, max] = LFO_LIMITS[key]
  const source = lfo && typeof lfo === 'object' ? lfo : {}
  const type = LFO_TYPES.includes(source.type) ? source.type : base.type
  const active = source.active === true
  const speed = clamp(toNumber(source.speed, base.speed), LFO_SPEED_LIMITS[0], LFO_SPEED_LIMITS[1])
  let range = base.range.slice()
  if (Array.isArray(source.range) && source.range.length === 2) {
    const a = clamp(toNumber(source.range[0], range[0]), min, max)
    const b = clamp(toNumber(source.range[1], range[1]), min, max)
    range = [Math.min(a, b), Math.max(a, b)]
  }
  return { active, type, speed, range }
}

// Clamps and completes a raw state. Returns null when the state is not usable.
export function normalizeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const normalized = {}
  Object.keys(STATE_LIMITS).forEach(key => {
    const [min, max] = STATE_LIMITS[key]
    let value = clamp(toNumber(state[key], DEFAULT_STATE[key]), min, max)
    if (key === 'cantArmonicos' || key === 'volumeSlider' || key === 'delaySend') {
      value = Math.round(value)
    } else if (key === 'arpeggiatorTempo') {
      // The tempo slider only moves in steps, so the state does too
      value = Math.round(value / TEMPO_STEP) * TEMPO_STEP
    }
    normalized[key] = value
  })
  normalized.mappingMode = MAPPING_MODES.includes(state.mappingMode) ? state.mappingMode : DEFAULT_STATE.mappingMode
  normalized.oscillatorType = OSCILLATOR_TYPES.includes(state.oscillatorType) ? state.oscillatorType : DEFAULT_STATE.oscillatorType
  normalized.arpeggiatorType = ARPEGGIATOR_TYPES.includes(state.arpeggiatorType) ? state.arpeggiatorType : DEFAULT_STATE.arpeggiatorType
  const lfos = state.lfos && typeof state.lfos === 'object' ? state.lfos : {}
  normalized.lfos = {}
  Object.keys(LFO_LIMITS).forEach(key => {
    normalized.lfos[key] = normalizeLfo(key, lfos[key])
  })
  return normalized
}

// JSON -> base64url. The result is safe to put in a URL hash.
export function serializeState(state) {
  const normalized = normalizeState(state)
  if (!normalized) return null
  const payload = JSON.stringify({ v: STATE_VERSION, s: normalized })
  return toBase64Url(new TextEncoder().encode(payload))
}

// base64url -> state. Returns null when the string is not a valid state.
export function deserializeState(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  try {
    const json = new TextDecoder().decode(fromBase64Url(text))
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || parsed.v !== STATE_VERSION) return null
    return normalizeState(parsed.s)
  } catch (e) {
    return null
  }
}

// The state as it is stored in the location hash
export function stateToHash(state) {
  const encoded = serializeState(state)
  return encoded === null ? null : HASH_PREFIX + encoded
}

export function stateFromHash(hash) {
  if (typeof hash !== 'string') return null
  const match = /[#&]s=([^&]+)/.exec(hash)
  if (!match) return null
  return deserializeState(decodeURIComponent(match[1]))
}

// Reads the state from the refs of the app
export function readState(sources) {
  if (!sources) return null
  const state = {}
  Object.keys(STATE_LIMITS).forEach(key => {
    state[key] = sources[key] ? sources[key].value : undefined
  })
  state.mappingMode = sources.mappingMode ? sources.mappingMode.value : undefined
  state.oscillatorType = sources.oscillatorType ? sources.oscillatorType.value : undefined
  state.arpeggiatorType = sources.arpeggiatorType ? sources.arpeggiatorType.value : undefined
  const lfos = sources.lfos ? sources.lfos.value : null
  state.lfos = {}
  Object.keys(LFO_LIMITS).forEach(key => {
    const lfo = lfos ? lfos[key] : null
    state.lfos[key] = {
      active: !!(lfo && lfo.active),
      type: lfo ? lfo.type : undefined,
      speed: lfo ? lfo.speed : undefined,
      range: lfo && lfo.range ? lfo.range.slice() : undefined
    }
  })
  return normalizeState(state)
}

function assignValue(target, key, value) {
  const holder = target[key]
  if (holder && typeof holder === 'object' && 'value' in holder) {
    holder.value = value
    return
  }
  target[key] = value
}

// Applies a state to the refs of the app. Every value is clamped to its range.
export function applyState(target, state) {
  const normalized = normalizeState(state)
  if (!normalized || !target) return false
  Object.keys(STATE_LIMITS).forEach(key => assignValue(target, key, normalized[key]))
  assignValue(target, 'mappingMode', normalized.mappingMode)
  assignValue(target, 'oscillatorType', normalized.oscillatorType)
  assignValue(target, 'arpeggiatorType', normalized.arpeggiatorType)
  const holder = target.lfos
  if (holder) {
    const lfos = holder.value !== undefined ? holder.value : holder
    if (lfos && typeof lfos === 'object') {
      Object.keys(normalized.lfos).forEach(key => {
        const next = normalized.lfos[key]
        lfos[key] = { active: next.active, type: next.type, speed: next.speed, range: next.range.slice() }
      })
    }
  }
  return true
}

// Finds a built-in preset by name
export function findPreset(name) {
  return BUILTIN_PRESETS.find(preset => preset.name === name) || null
}
