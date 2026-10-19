import { ref, reactive, watch } from 'vue'
import * as Tone from 'tone'
import { CONTROL_RATE_MS, LFO_FADE, LFO_TYPE_MAP, maxArmonicos } from './constants.js'

// Normalised (0..1) value of an LFO waveform at a given phase
function lfoWaveformValue(type, phase) {
  switch (type) {
    case 'sine':
      return (Math.sin(phase * 2 * Math.PI) + 1) / 2
    case 'triangle':
      return (Math.asin(Math.sin(phase * 2 * Math.PI)) / (Math.PI / 2) + 1) / 2
    case 'square':
      return phase < 0.5 ? 1 : 0
    case 'sawtooth':
      return phase
    case 'inv sawtooth':
      return 1 - phase
    default:
      return 0
  }
}

export function useLfo({ synth }) {
  const lfos = ref({
    fundamental: { active: false, type: 'sine', speed: 0.5, range: [220, 660] },
    cantArmonicos: { active: false, type: 'triangle', speed: 0.2, range: [2, 6] },
    offset: { active: false, type: 'sine', speed: 0.1, range: [0, 5] },
  })
  // Per-LFO phase accumulator. It is advanced by dt*speed on the audio clock
  // (instead of being computed from absolute time) so speed changes during a
  // drag are smooth — no phase jumps, no crazy values.
  const lfoPhases = reactive({ fundamental: 0, cantArmonicos: 0, offset: 0 })
  // Audio clock timestamp of every phase sample. The canvas uses it to
  // interpolate the cursor between control-rate updates.
  const lfoPhaseTimes = reactive({ fundamental: 0, cantArmonicos: 0, offset: 0 })
  const lfoLastAudioTime = { fundamental: 0, cantArmonicos: 0, offset: 0 }
  // Detune targets added by other parts of the engine (the arpeggiator voices)
  const extraDetuneTargets = []

  let controlLfoTimer = null
  // Native Tone.LFO that modulates the whole series in cents, and the gain
  // used to fade the modulation in and out
  let fundLfo = null
  let fundLfoGain = null
  let fundLfoFadeTimer = null
  let fundLfoType = 'sine'

  // Audio clock, the time base of every LFO
  function audioNow() {
    return Tone.getContext().currentTime
  }

  // Native LFO for the fundamental: it modulates the detune of every
  // oscillator in cents, so the whole series moves as one
  function createNativeLfo() {
    fundLfo = new Tone.LFO({
      frequency: lfos.value.fundamental.speed,
      min: 0,
      max: 0,
      type: LFO_TYPE_MAP[lfos.value.fundamental.type],
      units: 'cents'
    })
    fundLfoGain = new Tone.Gain(0)
    fundLfo.connect(fundLfoGain)
    fundLfoType = lfos.value.fundamental.type
    // The LFO can already be active when the state comes from a shared link
    if (lfos.value.fundamental.active) {
      startFundLfo()
    }
  }

  // Every oscillator modulated by the fundamental LFO
  function detuneTargets() {
    return [...synth.detuneTargets(), ...extraDetuneTargets]
  }

  // Extra voices (the arpeggiator) join the modulation of the fundamental LFO
  function registerDetuneTargets(targets) {
    targets.forEach(target => {
      extraDetuneTargets.push(target)
      if (fundLfoGain && lfos.value.fundamental.active) {
        fundLfoGain.connect(target)
      }
    })
  }

  function connectFundLfo() {
    if (!fundLfoGain) return
    detuneTargets().forEach(target => fundLfoGain.connect(target))
  }

  function disconnectFundLfo() {
    if (!fundLfoGain) return
    fundLfoGain.disconnect()
  }

  // Cents range of the fundamental LFO. The UI range is expressed in Hz, the
  // modulation is applied in cents relative to the current fundamental.
  function fundamentalLfoCents() {
    const lfo = lfos.value.fundamental
    const base = Math.max(parseFloat(synth.fundamental.value) || 1, 1)
    const lo = Math.max(lfo.range[0], 1)
    const hi = Math.max(lfo.range[1], 1)
    let min = 1200 * Math.log2(lo / base)
    let max = 1200 * Math.log2(hi / base)
    // An inverse sawtooth is a sawtooth with the range inverted
    if (lfo.type === 'inv sawtooth') {
      const swap = min
      min = max
      max = swap
    }
    return { min, max }
  }

  function updateFundLfoRange() {
    if (!fundLfo) return
    // An inactive LFO modulates exactly 0 cents
    const target = lfos.value.fundamental.active
      ? fundamentalLfoCents()
      : { min: 0, max: 0 }
    // Avoid scheduling the same range over and over again
    if (Math.abs(fundLfo.min - target.min) < 0.001 && Math.abs(fundLfo.max - target.max) < 0.001) return
    fundLfo.min = target.min
    fundLfo.max = target.max
  }

  function startFundLfo() {
    if (!fundLfo || !fundLfoGain) return
    if (fundLfoFadeTimer) {
      clearTimeout(fundLfoFadeTimer)
      fundLfoFadeTimer = null
    }
    // The native LFO always starts at the beginning of its cycle, so the
    // tracked phase is reset to keep the cursor and the sound in sync
    lfoPhases.fundamental = 0
    fundLfoType = lfos.value.fundamental.type
    fundLfo.type = LFO_TYPE_MAP[fundLfoType]
    updateFundLfoRange()
    connectFundLfo()
    fundLfo.start()
    lfoPhaseTimes.fundamental = audioNow()
    // The gain fades the modulation in, so there is no jump when it starts
    fundLfoGain.gain.rampTo(1, LFO_FADE)
  }

  function stopFundLfo() {
    if (!fundLfo || !fundLfoGain) return
    fundLfoGain.gain.rampTo(0, LFO_FADE)
    if (fundLfoFadeTimer) clearTimeout(fundLfoFadeTimer)
    fundLfoFadeTimer = setTimeout(() => {
      fundLfoFadeTimer = null
      if (!fundLfo || lfos.value.fundamental.active) return
      updateFundLfoRange()
      fundLfo.stop()
      disconnectFundLfo()
    }, LFO_FADE * 1000 + 20)
  }

  function startControlLoop() {
    if (controlLfoTimer) clearInterval(controlLfoTimer)
    const now = audioNow()
    lfoLastAudioTime.fundamental = now
    lfoLastAudioTime.cantArmonicos = now
    lfoLastAudioTime.offset = now
    lfoPhaseTimes.fundamental = now
    lfoPhaseTimes.cantArmonicos = now
    lfoPhaseTimes.offset = now
    controlLfoTimer = setInterval(tickLfos, CONTROL_RATE_MS)
  }

  function tickLfos() {
    const now = audioNow()
    // The fundamental LFO modulates the audio natively, only its phase is tracked here
    tickLfo('fundamental', now)
    applyControlLfo('cantArmonicos', now)
    applyControlLfo('offset', now)
  }

  // Advances the phase of an LFO on the audio clock and returns its raw value
  function tickLfo(key, now) {
    const lfo = lfos.value[key]
    const dt = now - lfoLastAudioTime[key]
    lfoLastAudioTime[key] = now
    if (!lfo || !lfo.active || dt <= 0) return null
    let phase = lfoPhases[key] + dt * lfo.speed
    phase = phase - Math.floor(phase) // keep in [0, 1)
    lfoPhases[key] = phase
    lfoPhaseTimes[key] = now
    const [min, max] = lfo.range
    return min + (max - min) * lfoWaveformValue(lfo.type, phase)
  }

  // The discrete LFOs only write to the refs when the value really changes
  function applyControlLfo(key, now) {
    const value = tickLfo(key, now)
    if (value === null) return
    if (key === 'cantArmonicos') {
      const rounded = Math.min(maxArmonicos, Math.max(1, Math.round(value)))
      if (rounded !== synth.cantArmonicos.value) synth.cantArmonicos.value = rounded
    } else if (Math.abs(value - synth.offset.value) > 0.02) {
      // The offset is interpolated, so a continuous glissando is intentional
      synth.offset.value = value
    }
  }

  watch(() => lfos.value.fundamental.active, (active) => {
    if (!fundLfo) return
    if (active) {
      startFundLfo()
    } else {
      stopFundLfo()
    }
  })
  watch(() => lfos.value.fundamental.type, (type) => {
    if (!fundLfo || fundLfoType === type) return
    fundLfoType = type
    fundLfo.type = LFO_TYPE_MAP[type]
    updateFundLfoRange()
  })
  watch(() => lfos.value.fundamental.speed, (speed) => {
    if (!fundLfo) return
    // Always ramp the speed, a step would jump the phase
    fundLfo.frequency.rampTo(speed, 0.05)
  })
  watch(() => lfos.value.fundamental.range, () => {
    updateFundLfoRange()
  })

  function dispose() {
    if (controlLfoTimer) {
      clearInterval(controlLfoTimer)
      controlLfoTimer = null
    }
    if (fundLfoFadeTimer) {
      clearTimeout(fundLfoFadeTimer)
      fundLfoFadeTimer = null
    }
    if (fundLfo) {
      fundLfo.stop()
      fundLfo.dispose()
      fundLfo = null
    }
    if (fundLfoGain) {
      fundLfoGain.disconnect()
      fundLfoGain.dispose()
      fundLfoGain = null
    }
  }

  return {
    lfos,
    lfoPhases,
    lfoPhaseTimes,
    createNativeLfo,
    registerDetuneTargets,
    updateFundLfoRange,
    startControlLoop,
    dispose
  }
}
