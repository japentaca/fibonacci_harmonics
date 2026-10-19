import { ref, computed, watch } from 'vue'
import * as Tone from 'tone'
import {
  MUTE_DB,
  ARPEGGIATOR_GAIN_BOOST_DB,
  MAX_ARPEGGIATOR_OSCILLATORS,
  ARPEGGIO_ATTACK,
  ARPEGGIO_RELEASE,
  TEMPO_DEBOUNCE_MS
} from './constants.js'
import { mapRange } from './fibonacci.js'

export function useArpeggiator({ synth, lfo }) {
  const arpeggiatorActive = ref(false)
  const arpeggiatorType = ref('up')
  const arpeggiatorTempo = ref(150) // ms entre notas
  const arpeggiatorTypes = [
    { label: 'Up', value: 'up' },
    { label: 'Down', value: 'down' },
    { label: 'Up-Down', value: 'updown' },
    { label: 'Random', value: 'random' }
  ]
  const activeArpeggioIndex = ref(-1)
  // dB applied to the arpeggiator bus: always finite, silent when muted
  const arpeggiatorDb = computed(() =>
    synth.isMuted.value ? MUTE_DB : synth.volumeDb.value + ARPEGGIATOR_GAIN_BOOST_DB)

  let arpeggiatorOscillators = [] // Array para múltiples osciladores del arpegiador
  let arpeggiatorPanners = [] // Array para los paneadores stereo
  let arpeggiatorEnvelopes = [] // Array para los envelopes ADSR
  let arpeggiatorMasterVolume = null
  let arpeggiatorInterval = null
  let currentArpeggioIndex = 0
  let arpeggioDirection = 1
  let tempoDebounceTimer = null

  function getCurrentIndex() {
    return currentArpeggioIndex
  }

  // The series changed: keep the playhead inside the new range
  function onSeriesChanged(prevIndex) {
    if (!arpeggiatorActive.value) return
    const length = synth.armonicos.value.length
    if (length === 0) return
    currentArpeggioIndex = prevIndex >= length ? 0 : prevIndex
  }

  function toggleArpeggiator() {
    arpeggiatorActive.value = !arpeggiatorActive.value

    if (arpeggiatorActive.value) {
      // Apagar los osciladores principales
      synth.muteMainOscillators()
      startArpeggiator()
    } else {
      stopArpeggiator()
      // Restaurar los osciladores principales
      synth.restoreMainOscillators()
    }
  }

  function startArpeggiator() {
    if (synth.armonicos.value.length === 0) return

    currentArpeggioIndex = 0
    arpeggioDirection = 1

    // Crear múltiples osciladores para el arpegiador si no existen
    if (arpeggiatorOscillators.length === 0) {
      if (!arpeggiatorMasterVolume) {
        arpeggiatorMasterVolume = new Tone.Volume(arpeggiatorDb.value)
        const masterBus = synth.getMasterBus()
        if (masterBus) {
          arpeggiatorMasterVolume.connect(masterBus)
        }
      }
      for (let i = 0; i < MAX_ARPEGGIATOR_OSCILLATORS; i++) {
        const osc = new Tone.Oscillator(440, synth.oscillatorType.value)
        const envelope = new Tone.AmplitudeEnvelope({
          attack: ARPEGGIO_ATTACK,
          decay: 0.1,
          sustain: 1,
          release: ARPEGGIO_RELEASE
        })
        const panner = new Tone.Panner(0)

        // Distribuir los osciladores en el espectro stereo
        panner.pan.value = mapRange(i, 0, MAX_ARPEGGIATOR_OSCILLATORS - 1, -1, 1)

        osc.connect(envelope)
        envelope.connect(panner)
        panner.connect(arpeggiatorMasterVolume)
        osc.start()

        arpeggiatorOscillators.push(osc)
        arpeggiatorPanners.push(panner)
        arpeggiatorEnvelopes.push(envelope)
      }
      // The fundamental LFO modulates the arpeggiator voices as well
      lfo.registerDetuneTargets(arpeggiatorOscillators.map(osc => osc.detune))
    }

    // Actualizar el tipo de oscilador para todos los osciladores
    arpeggiatorOscillators.forEach(osc => {
      osc.type = synth.oscillatorType.value
    })
    const intervalSeconds = arpeggiatorTempo.value / 1000
    arpeggiatorInterval = Tone.Transport.scheduleRepeat((time) => {
      playArpeggioNote(time)
    }, intervalSeconds, Tone.Transport.seconds)
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start()
    }
    playArpeggioNote(Tone.now())
  }

  function stopArpeggiator() {
    if (arpeggiatorInterval !== null) {
      Tone.Transport.clear(arpeggiatorInterval)
      arpeggiatorInterval = null
    }

    // Apagar todos los envelopes del arpegiador
    arpeggiatorEnvelopes.forEach(envelope => {
      envelope.triggerRelease()
    })
    activeArpeggioIndex.value = -1
  }

  // Panic: releases every envelope, stops the sequence and gives the master
  // oscillators back, so no note is left hanging
  function panic() {
    if (arpeggiatorInterval !== null) {
      Tone.Transport.clear(arpeggiatorInterval)
      arpeggiatorInterval = null
    }
    arpeggiatorEnvelopes.forEach(envelope => {
      envelope.triggerRelease()
    })
    activeArpeggioIndex.value = -1
    if (arpeggiatorActive.value) {
      arpeggiatorActive.value = false
      synth.restoreMainOscillators()
    }
  }

  function playArpeggioNote(time) {
    if (synth.armonicos.value.length === 0 || arpeggiatorOscillators.length === 0) return

    const t = Number.isFinite(time) && time >= 0 ? time : Tone.now()
    // Seleccionar un oscilador basado en el índice actual para distribuir en stereo
    const oscillatorIndex = currentArpeggioIndex % arpeggiatorOscillators.length
    const currentOscillator = arpeggiatorOscillators[oscillatorIndex]
    const currentEnvelope = arpeggiatorEnvelopes[oscillatorIndex]

    // Apagar todos los envelopes primero para evitar superposición
    arpeggiatorEnvelopes.forEach((envelope, index) => {
      if (index !== oscillatorIndex) {
        envelope.triggerRelease(t)
      }
    })

    // Encender la nota actual del arpegio usando el oscilador seleccionado
    const currentFreq = synth.armonicos.value[currentArpeggioIndex]
    if (currentFreq && currentOscillator && currentEnvelope) {
      currentOscillator.frequency.setValueAtTime(currentFreq, t)
      currentOscillator.type = synth.oscillatorType.value
      currentEnvelope.triggerAttack(t)
    }
    activeArpeggioIndex.value = currentArpeggioIndex

    // Calcular el siguiente índice según el tipo de arpegio
    const arrayLength = synth.armonicos.value.length
    switch (arpeggiatorType.value) {
      case 'up':
        currentArpeggioIndex = (currentArpeggioIndex + 1) % arrayLength
        break
      case 'down':
        currentArpeggioIndex = (currentArpeggioIndex - 1 + arrayLength) % arrayLength
        break
      case 'updown':
        if (arrayLength <= 1) {
          currentArpeggioIndex = 0
          break
        }
        if (arpeggioDirection === 1) {
          if (currentArpeggioIndex >= arrayLength - 1) {
            arpeggioDirection = -1
          }
        } else {
          if (currentArpeggioIndex <= 0) {
            arpeggioDirection = 1
          }
        }
        currentArpeggioIndex += arpeggioDirection
        break
      case 'random':
        currentArpeggioIndex = Math.floor(Math.random() * arrayLength)
        break
    }
  }

  watch(arpeggiatorType, () => {
    // Reiniciar el arpegiador si está activo
    if (arpeggiatorActive.value) {
      stopArpeggiator()
      startArpeggiator()
    }
  })
  watch(arpeggiatorTempo, () => {
    if (tempoDebounceTimer) {
      clearTimeout(tempoDebounceTimer)
    }
    if (arpeggiatorActive.value) {
      tempoDebounceTimer = setTimeout(() => {
        if (arpeggiatorInterval !== null) {
          Tone.Transport.clear(arpeggiatorInterval)
          arpeggiatorInterval = null
        }
        const intervalSeconds = arpeggiatorTempo.value / 1000
        arpeggiatorInterval = Tone.Transport.scheduleRepeat((time) => {
          playArpeggioNote(time)
        }, intervalSeconds, Tone.Transport.seconds)
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.start()
        }
        playArpeggioNote(Tone.now())
      }, TEMPO_DEBOUNCE_MS)
    }
  })
  watch(() => synth.cantArmonicos.value, () => {
    // Si el arpegiador está activo, reiniciar para adaptarse a los nuevos armónicos
    if (arpeggiatorActive.value) {
      currentArpeggioIndex = 0 // Reiniciar índice
      arpeggioDirection = 1
    }
  })
  watch(() => synth.armonicos.value, () => {
    // Si el arpegiador está activo y el array cambia, ajustar el índice
    if (arpeggiatorActive.value && synth.armonicos.value.length > 0) {
      if (currentArpeggioIndex >= synth.armonicos.value.length) {
        currentArpeggioIndex = 0 // Reiniciar si el índice está fuera de rango
      }
    }
  })
  watch(() => synth.oscillatorType.value, () => {
    // Actualizar también los osciladores del arpegiador si existen
    arpeggiatorOscillators.forEach(osc => {
      osc.type = synth.oscillatorType.value
    })
  })
  watch(arpeggiatorDb, () => {
    if (arpeggiatorMasterVolume) {
      arpeggiatorMasterVolume.volume.rampTo(arpeggiatorDb.value, 0.05)
    }
  })

  function dispose() {
    if (arpeggiatorInterval !== null) {
      Tone.Transport.clear(arpeggiatorInterval)
      arpeggiatorInterval = null
    }
    Tone.Transport.stop()
    if (tempoDebounceTimer) {
      clearTimeout(tempoDebounceTimer)
      tempoDebounceTimer = null
    }
    // Limpiar todos los osciladores del arpegiador
    arpeggiatorOscillators.forEach(osc => {
      osc.stop()
      osc.dispose()
    })
    arpeggiatorEnvelopes.forEach(envelope => {
      envelope.dispose()
    })
    arpeggiatorOscillators = []
    arpeggiatorPanners = []
    arpeggiatorEnvelopes = []
    if (arpeggiatorMasterVolume) {
      arpeggiatorMasterVolume.dispose()
      arpeggiatorMasterVolume = null
    }
  }

  return {
    arpeggiatorActive,
    arpeggiatorType,
    arpeggiatorTempo,
    arpeggiatorTypes,
    activeArpeggioIndex,
    arpeggiatorDb,
    toggleArpeggiator,
    startArpeggiator,
    stopArpeggiator,
    panic,
    playArpeggioNote,
    getCurrentIndex,
    onSeriesChanged,
    dispose
  }
}
