import { ref, shallowRef, computed, watch } from 'vue'
import * as Tone from 'tone'
import { maxArmonicos, MIN_DB, MUTE_DB, DEFAULT_SAMPLE_RATE, PANIC_SILENCE_MS } from './constants.js'
import { buildSeries, nyquistLimit, panForPartial, sliderToDb } from './fibonacci.js'

// Paneo: la fundamental (índice 0) siempre al centro. El resto de parciales
// se reparten simétricamente de izquierda a derecha sobre [-1, 1].
//   n parciales -> la parcial i (i >= 1) queda en ((i - 1) / (n - 2)) * 2 - 1
// Casos límite: n == 1 (solo la fundamental) y n == 2 (una única parcial)
// quedan centradas, que es la única colocación simétrica posible.
// La función vive en fibonacci.js para poder reutilizarla en la exportación.

function currentSampleRate() {
  try {
    const context = Tone.getContext()
    return context && context.sampleRate ? context.sampleRate : DEFAULT_SAMPLE_RATE
  } catch (e) {
    return DEFAULT_SAMPLE_RATE
  }
}

export function useSynth() {
  // Mapping mode: how the partial number is turned into a frequency
  const mappingModes = [
    { label: 'Fibonacci ratios (×)', value: 'fibonacci' },
    { label: 'Harmonic series (×)', value: 'harmonic' },
    { label: 'Legacy distance (+)', value: 'legacy' }
  ]
  const mappingMode = ref('fibonacci')

  const oscillatorTypes = []
  const baseOscillatorTypes = ["sine", "sawtooth", "triangle", "square"]
  baseOscillatorTypes.forEach(v => {
    oscillatorTypes.push(v)
    for (let i = 2; i < 6; i++) {
      oscillatorTypes.push(v + i.toString())
    }
  })
  const oscillatorType = ref('sine')

  const fundamental = ref(440)
  const cantArmonicos = ref(4)
  const offset = ref(2)
  // Partials dropped by the Nyquist guard on the last calculation
  const droppedPartials = ref(0)
  const armonicos = shallowRef([])

  // 0-100 linear slider value for smoother UI control
  const volumeSlider = ref(80)
  // Actual dB value calculated from slider
  const volumeDb = ref(-20)
  const isMuted = computed(() => volumeSlider.value <= 0)
  // dB value pushed to the synths: the mute floor or the current volumeDb
  const effectiveDb = computed(() => isMuted.value ? MUTE_DB : volumeDb.value)

  let syntArr = []
  let panVolArr = []
  let masterBus = null
  let limiter = null
  // Analyser placed after the limiter, so the spectrum shows exactly what is heard
  const analyser = shallowRef(null)
  // True while the main oscillators are muted, because the arpeggiator owns the output
  let mainOscillatorsMuted = false

  // Convert linear slider (0-100) to logarithmic dB scale
  // Range: MIN_DB (floor) to MAX_DB (ceiling). The slider at 0 mutes.
  function updateVolume() {
    if (volumeSlider.value <= 0) {
      volumeDb.value = MIN_DB
    } else {
      // Linear mapping for consistent sensitivity across the range
      // Normalized (0-1) * Range + Min
      volumeDb.value = sliderToDb(volumeSlider.value)
    }
  }

  // Master chain: everything -> masterBus -> limiter -> analyser -> destination.
  // The delay send is taken from the master bus so the wet signal is
  // limited as well and can never feed back past full scale.
  // The analyser is connected AFTER the limiter: the spectrum then shows the
  // final mix (dry + delay wet) with the gain that is really reaching the
  // speakers, instead of the unlimited sum of the voices.
  function createMasterChain() {
    masterBus = new Tone.Gain(1)
    limiter = new Tone.Limiter(-1)
    analyser.value = new Tone.Analyser('fft', 1024)
    masterBus.connect(limiter)
    limiter.connect(analyser.value)
    analyser.value.toDestination()
    return { masterBus, limiter, analyser: analyser.value }
  }

  function createOscillators() {
    for (let index = 0; index < maxArmonicos; index++) {
      const synt = new Tone.Oscillator(440, 'sine')
      // The waveform is set after the construction, so the types with partials
      // (sine2, sawtooth3...) are built as periodic waves and never reach the
      // native oscillator as an invalid type
      synt.type = oscillatorType.value
      const panVol = new Tone.Panner(0)
      panVol.connect(masterBus)
      synt.connect(panVol)
      synt.volume.value = -100
      synt.start()

      panVolArr[index] = panVol
      syntArr[index] = synt
    }
  }

  // Every oscillator modulated by the fundamental LFO
  function detuneTargets() {
    const targets = []
    syntArr.forEach(osc => { if (osc) targets.push(osc.detune) })
    return targets
  }

  // Funciones para controlar los osciladores principales
  function muteMainOscillators() {
    for (let index = 0; index < syntArr.length; index++) {
      if (syntArr[index]) {
        syntArr[index].volume.rampTo(-100, 0.05)
      }
    }
    mainOscillatorsMuted = true
  }

  // El oscilador i toca la parcial i de la serie; el resto queda muteado
  function restoreMainOscillators() {
    const count = armonicos.value.length
    for (let index = 0; index < syntArr.length; index++) {
      if (!syntArr[index]) continue
      if (index < count) {
        syntArr[index].volume.rampTo(effectiveDb.value, 0.05)
      } else {
        syntArr[index].volume.rampTo(-100, 0.05)
      }
    }
    mainOscillatorsMuted = false
  }

  function setVolumes() {
    const wasMuted = mainOscillatorsMuted
    restoreMainOscillators()
    // Si el arpegiador está activo, apagar los osciladores principales
    if (wasMuted) {
      muteMainOscillators()
    }
  }

  // Panic: silences the voices for a moment and brings them back, so a stuck
  // note never leaves the engine hanging
  function panic() {
    const wasMuted = mainOscillatorsMuted
    for (let index = 0; index < syntArr.length; index++) {
      if (syntArr[index]) {
        syntArr[index].volume.rampTo(MUTE_DB, 0.02)
      }
    }
    setTimeout(() => {
      if (mainOscillatorsMuted !== wasMuted) return
      restoreMainOscillators()
    }, PANIC_SILENCE_MS)
  }

  function calcular() {
    const limit = nyquistLimit(currentSampleRate())
    const next = buildSeries(fundamental.value, cantArmonicos.value, parseFloat(offset.value), mappingMode.value, limit)

    armonicos.value = next
    droppedPartials.value = cantArmonicos.value - next.length

    for (let index = 0; index < syntArr.length; index++) {
      const synt = syntArr[index]
      if (!synt) continue
      if (index < next.length) {
        synt.frequency.rampTo(next[index], 0.02)
        if (!mainOscillatorsMuted) {
          synt.volume.rampTo(effectiveDb.value, 0.05)
        }
      } else {
        synt.volume.rampTo(-100, 0.05)
      }
      if (panVolArr[index]) {
        // Solo se panea lo que está dentro de la serie; los muteados al centro
        panVolArr[index].pan.value = index < next.length ? panForPartial(index, next.length) : 0
      }
    }
  }

  watch(volumeSlider, () => {
    updateVolume()
    setVolumes()
  })
  watch(oscillatorType, () => {
    for (let index = 0; index < syntArr.length; index++) {
      syntArr[index].type = oscillatorType.value
    }
  })

  function dispose() {
    if (masterBus) {
      masterBus.dispose()
      masterBus = null
    }
    if (limiter) {
      limiter.dispose()
      limiter = null
    }
    if (analyser.value) {
      analyser.value.dispose()
      analyser.value = null
    }
    syntArr.forEach(o => { o.stop(); o.dispose(); })
    panVolArr.forEach(p => p.dispose())
    syntArr = []
    panVolArr = []
  }

  return {
    // state
    fundamental,
    cantArmonicos,
    offset,
    mappingMode,
    mappingModes,
    oscillatorType,
    oscillatorTypes,
    volumeSlider,
    volumeDb,
    isMuted,
    effectiveDb,
    armonicos,
    droppedPartials,
    analyser,
    // methods
    createMasterChain,
    createOscillators,
    detuneTargets,
    updateVolume,
    setVolumes,
    muteMainOscillators,
    restoreMainOscillators,
    calcular,
    panic,
    getMasterBus: () => masterBus,
    getLimiter: () => limiter,
    getAnalyser: () => analyser.value,
    dispose
  }
}
