import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BUILTIN_PRESETS,
  DEFAULT_STATE,
  STATE_LIMITS,
  LFO_LIMITS,
  LFO_SPEED_LIMITS,
  TEMPO_STEP,
  applyState,
  deserializeState,
  findPreset,
  normalizeState,
  readState,
  serializeState,
  stateFromHash,
  stateToHash
} from './presets.js'

function makeTarget() {
  const lfos = {
    fundamental: { active: false, type: 'sine', speed: 0.5, range: [220, 660] },
    cantArmonicos: { active: false, type: 'triangle', speed: 0.2, range: [2, 6] },
    offset: { active: false, type: 'sine', speed: 0.1, range: [0, 5] }
  }
  return {
    fundamental: { value: 440 },
    cantArmonicos: { value: 4 },
    offset: { value: 2 },
    mappingMode: { value: 'fibonacci' },
    oscillatorType: { value: 'sine' },
    volumeSlider: { value: 80 },
    delaySend: { value: 25 },
    delayTime: { value: 0.25 },
    delayFeedback: { value: 0.4 },
    arpeggiatorType: { value: 'up' },
    arpeggiatorTempo: { value: 150 },
    lfos: { value: lfos }
  }
}

test('serializeState and deserializeState round trip without losses', () => {
  const state = normalizeState(DEFAULT_STATE)
  const encoded = serializeState(state)
  assert.equal(typeof encoded, 'string')
  assert.ok(encoded.length > 0)
  assert.equal(encoded, encodeURIComponent(encoded), 'the encoding must be URL safe')
  assert.deepEqual(deserializeState(encoded), state)
})

test('serializeState keeps every field of the state', () => {
  const state = normalizeState({
    ...DEFAULT_STATE,
    fundamental: 123.45,
    mappingMode: 'harmonic',
    oscillatorType: 'sawtooth3',
    lfos: {
      fundamental: { active: true, type: 'triangle', speed: 0.25, range: [200, 400] },
      cantArmonicos: { active: true, type: 'square', speed: 0.75, range: [3, 7] },
      offset: { active: true, type: 'inv sawtooth', speed: 0.05, range: [1, 9] }
    }
  })
  const decoded = deserializeState(serializeState(state))
  assert.equal(decoded.fundamental, 123.45)
  assert.equal(decoded.mappingMode, 'harmonic')
  assert.equal(decoded.oscillatorType, 'sawtooth3')
  assert.equal(decoded.lfos.fundamental.active, true)
  assert.equal(decoded.lfos.fundamental.type, 'triangle')
  assert.equal(decoded.lfos.fundamental.speed, 0.25)
  assert.deepEqual(decoded.lfos.fundamental.range, [200, 400])
  assert.equal(decoded.lfos.offset.type, 'inv sawtooth')
  assert.deepEqual(decoded.lfos.offset.range, [1, 9])
})

test('deserializeState returns null for an invalid state', () => {
  assert.equal(deserializeState(''), null)
  assert.equal(deserializeState('not a valid state!!'), null)
  assert.equal(deserializeState('////'), null)
  assert.equal(deserializeState(null), null)
  assert.equal(deserializeState(undefined), null)
  assert.equal(deserializeState(42), null)
  // valid base64, but not a state
  const notAState = Buffer.from('{"v":1,"s":"nope"}').toString('base64url')
  assert.equal(deserializeState(notAState), null)
  const wrongVersion = Buffer.from('{"v":99,"s":{}}').toString('base64url')
  assert.equal(deserializeState(wrongVersion), null)
})

test('normalizeState clamps every value to its range', () => {
  const normalized = normalizeState({
    fundamental: 99999,
    cantArmonicos: 500,
    offset: -80,
    volumeSlider: 400,
    delaySend: -10,
    delayTime: 12,
    delayFeedback: 5,
    arpeggiatorTempo: 1000,
    mappingMode: 'nope',
    oscillatorType: 'nope',
    arpeggiatorType: 'nope'
  })
  assert.equal(normalized.fundamental, STATE_LIMITS.fundamental[1])
  assert.equal(normalized.cantArmonicos, STATE_LIMITS.cantArmonicos[1])
  assert.equal(normalized.offset, STATE_LIMITS.offset[0])
  assert.equal(normalized.volumeSlider, STATE_LIMITS.volumeSlider[1])
  assert.equal(normalized.delaySend, STATE_LIMITS.delaySend[0])
  assert.equal(normalized.delayTime, STATE_LIMITS.delayTime[1])
  assert.equal(normalized.delayFeedback, STATE_LIMITS.delayFeedback[1])
  assert.equal(normalized.arpeggiatorTempo, STATE_LIMITS.arpeggiatorTempo[1])
  assert.equal(normalized.mappingMode, DEFAULT_STATE.mappingMode)
  assert.equal(normalized.oscillatorType, DEFAULT_STATE.oscillatorType)
  assert.equal(normalized.arpeggiatorType, DEFAULT_STATE.arpeggiatorType)
})

test('normalizeState clamps the LFOs and sorts their range', () => {
  const normalized = normalizeState({
    lfos: {
      fundamental: { active: true, type: 'nope', speed: 900, range: [9000, 10] },
      cantArmonicos: { active: 'yes', type: 'square', speed: -1, range: [0, 99] },
      offset: { active: false, type: 'sawtooth', speed: 0.2, range: 'nope' }
    }
  })
  const fund = normalized.lfos.fundamental
  assert.equal(fund.active, true)
  assert.equal(fund.type, DEFAULT_STATE.lfos.fundamental.type)
  assert.equal(fund.speed, LFO_SPEED_LIMITS[1])
  assert.deepEqual(fund.range, [LFO_LIMITS.fundamental[0], LFO_LIMITS.fundamental[1]])
  assert.equal(normalized.lfos.cantArmonicos.active, false)
  assert.equal(normalized.lfos.cantArmonicos.speed, LFO_SPEED_LIMITS[0])
  assert.deepEqual(normalized.lfos.cantArmonicos.range, [1, 10])
  assert.deepEqual(normalized.lfos.offset.range, DEFAULT_STATE.lfos.offset.range)
})

test('normalizeState snaps the tempo to the step of the slider', () => {
  const normalized = normalizeState({ arpeggiatorTempo: 137 })
  assert.equal(normalized.arpeggiatorTempo, 140)
  assert.equal(normalized.arpeggiatorTempo % TEMPO_STEP, 0)
  // the limits are kept after the rounding
  const low = normalizeState({ arpeggiatorTempo: 50 })
  const high = normalizeState({ arpeggiatorTempo: 500 })
  assert.equal(low.arpeggiatorTempo, 50)
  assert.equal(high.arpeggiatorTempo, 500)
})

test('normalizeState rejects values that are not objects', () => {
  assert.equal(normalizeState(null), null)
  assert.equal(normalizeState(undefined), null)
  assert.equal(normalizeState('state'), null)
  assert.equal(normalizeState([1, 2]), null)
})

test('applyState writes the state into the refs of the app', () => {
  const target = makeTarget()
  const state = normalizeState({
    ...DEFAULT_STATE,
    fundamental: 330,
    cantArmonicos: 6,
    offset: 4,
    mappingMode: 'legacy',
    oscillatorType: 'square',
    volumeSlider: 50,
    delaySend: 60,
    delayTime: 0.5,
    delayFeedback: 0.7,
    arpeggiatorType: 'random',
    arpeggiatorTempo: 250
  })
  assert.equal(applyState(target, state), true)
  assert.equal(target.fundamental.value, 330)
  assert.equal(target.cantArmonicos.value, 6)
  assert.equal(target.offset.value, 4)
  assert.equal(target.mappingMode.value, 'legacy')
  assert.equal(target.oscillatorType.value, 'square')
  assert.equal(target.volumeSlider.value, 50)
  assert.equal(target.delaySend.value, 60)
  assert.equal(target.delayTime.value, 0.5)
  assert.equal(target.delayFeedback.value, 0.7)
  assert.equal(target.arpeggiatorType.value, 'random')
  assert.equal(target.arpeggiatorTempo.value, 250)
})

test('applyState clamps the values that are out of range', () => {
  const target = makeTarget()
  const applied = applyState(target, {
    fundamental: 99999,
    cantArmonicos: 0,
    offset: 100,
    volumeSlider: 500,
    delaySend: -1,
    delayTime: 0,
    delayFeedback: 5,
    arpeggiatorTempo: 9000
  })
  assert.equal(applied, true)
  assert.equal(target.fundamental.value, 3000)
  assert.equal(target.cantArmonicos.value, 1)
  assert.equal(target.offset.value, 20)
  assert.equal(target.volumeSlider.value, 100)
  assert.equal(target.delaySend.value, 0)
  assert.equal(target.delayTime.value, 0.05)
  assert.equal(target.delayFeedback.value, 0.9)
  assert.equal(target.arpeggiatorTempo.value, 500)
})

test('applyState clamps the LFOs and rejects an invalid state', () => {
  const target = makeTarget()
  applyState(target, {
    lfos: {
      fundamental: { active: true, type: 'square', speed: 99, range: [99999, 1] },
      cantArmonicos: { active: true, type: 'sawtooth', speed: 0.3, range: [2, 9] },
      offset: { active: false, type: 'sine', speed: 0.1, range: [0, 4] }
    }
  })
  assert.equal(target.lfos.value.fundamental.active, true)
  assert.equal(target.lfos.value.fundamental.type, 'square')
  assert.equal(target.lfos.value.fundamental.speed, 5)
  assert.deepEqual(target.lfos.value.fundamental.range, [80, 3000])
  assert.deepEqual(target.lfos.value.cantArmonicos.range, [2, 9])

  const before = target.fundamental.value
  assert.equal(applyState(target, 'not a state'), false)
  assert.equal(applyState(target, null), false)
  assert.equal(target.fundamental.value, before)
})

test('readState collects the state of the app and round trips it', () => {
  const target = makeTarget()
  target.fundamental.value = 512
  target.lfos.value.fundamental.active = true
  target.lfos.value.offset.speed = 0.42
  const state = readState(target)
  assert.equal(state.fundamental, 512)
  assert.equal(state.lfos.fundamental.active, true)
  assert.equal(state.lfos.offset.speed, 0.42)
  assert.deepEqual(deserializeState(serializeState(state)), state)
})

test('the state travels through the location hash', () => {
  const state = normalizeState(DEFAULT_STATE)
  const hash = stateToHash(state)
  assert.ok(hash.startsWith('#s='))
  assert.deepEqual(stateFromHash(hash), state)
  assert.equal(stateFromHash('#other=1'), null)
  assert.equal(stateFromHash(''), null)
  assert.equal(stateFromHash(null), null)
})

test('there are between five and six built-in presets and they are complete', () => {
  assert.ok(BUILTIN_PRESETS.length >= 5 && BUILTIN_PRESETS.length <= 6)
  const names = new Set()
  BUILTIN_PRESETS.forEach(preset => {
    assert.equal(typeof preset.name, 'string')
    assert.ok(preset.name.length > 0)
    assert.equal(names.has(preset.name), false, 'the preset names must be unique')
    names.add(preset.name)
    // a preset must be usable as it is: normalizing it cannot change anything
    assert.deepEqual(normalizeState(preset.state), normalizeState(preset.state))
    const normalized = normalizeState(preset.state)
    assert.deepEqual(normalized, preset.state, `the preset ${preset.name} is out of range`)
    // and it must survive a serialization round trip
    assert.deepEqual(deserializeState(serializeState(preset.state)), normalized)
  })
})

test('the built-in presets use the legacy mode and an active fundamental LFO', () => {
  const legacy = BUILTIN_PRESETS.find(preset => preset.state.mappingMode === 'legacy')
  assert.ok(legacy, 'there must be a preset with the legacy mode')
  const drift = BUILTIN_PRESETS.find(preset => preset.state.lfos.fundamental.active)
  assert.ok(drift, 'there must be a preset with the fundamental LFO active')
})

test('findPreset looks up a built-in preset by name', () => {
  assert.equal(findPreset('Warm Pad').name, 'Warm Pad')
  assert.equal(findPreset('Does not exist'), null)
})
