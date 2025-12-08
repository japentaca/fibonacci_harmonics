<script setup>
import { ref, watch, onUnmounted, shallowRef } from 'vue'
import Tag from 'primevue/tag';
import Button from "primevue/button"
import Dropdown from "primevue/dropdown"
import Card from 'primevue/card';
import Slider from 'primevue/slider';
import * as Tone from 'tone'


Number.prototype.mapValues = function (in_min, in_max, out_min, out_max) {
  return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

const maxArmonicos = 10
const fundamental = ref(440)
const cantArmonicos = ref(4)
const multiplicador = ref(1)
const armonicos = shallowRef([])
const offset = ref(2)
// Volume control state
// 0-100 linear slider value for smoother UI control
const volumeSlider = ref(80) 
// Actual dB value calculated from slider
const volumeDb = ref(-20)

const audioStarted = ref(false)
let syntArr = []
let panVolArr = []
let arpeggiatorOsc = null
let arpeggiatorGain = null
let arpeggiatorOscillators = [] // Array para múltiples osciladores del arpegiador
let arpeggiatorPanners = [] // Array para los paneadores stereo
let arpeggiatorMasterVolume = null
let arpeggiatorEnvelopes = [] // Array para los envelopes ADSR
const maxArpeggiatorOscillators = 8 // Número máximo de osciladores para el arpegiador
const arpeggioAttack = 0.01 // Tiempo de ataque para evitar clicks
const arpeggioRelease = 0.05 // Tiempo de release para transiciones suaves
const arpeggiatorGainBoostDB = 6
const activeArpeggioIndex = ref(-1)
let tempoDebounceTimer = null


const oscillatorTypes = []
let t = ["sine", "sawtooth", "triangle", "square"]
t.map(v => {
  //console.log(v)
  oscillatorTypes.push(v)
  for (let i = 2; i < 6; i++) {
    oscillatorTypes.push(v + i.toString())
  }
})
const oscillatorType = ref("sine")

// Arpegiador
const arpeggiatorActive = ref(false)
const arpeggiatorType = ref('up')
const arpeggiatorTempo = ref(150) // ms entre notas
const arpeggiatorTypes = [
  { label: 'Arriba', value: 'up' },
  { label: 'Abajo', value: 'down' },
  { label: 'Arriba-Abajo', value: 'updown' },
  { label: 'Aleatorio', value: 'random' }
]
let arpeggiatorInterval = null
let currentArpeggioIndex = 0
let arpeggioDirection = 1

function fibonacci(n) {
  return n < 1 ? 0
    : n <= 2 ? 1
      : fibonacci(n - 1) + fibonacci(n - 2)
}


async function startAudio() {
  if (audioStarted.value) return
  await Tone.start()
  audioStarted.value = true


  for (let index = 0; index < maxArmonicos + 1; index++) {
    const synt = new Tone.Oscillator(440, oscillatorType.value)
    let panVol = new Tone.Panner(-0.25).toDestination();
    synt.connect(panVol)
    synt.volume.value = -100
    synt.start()
    //synt.triggerAttack(440)

    panVol.pan.value = index.mapValues(0, maxArmonicos, -1, 1)
    panVolArr[index] = panVol
    syntArr[index] = synt

  }
  cantArmonicos.value = 2
  
  // Initialize volume based on slider
  updateVolume()
}

// Convert linear slider (0-100) to logarithmic dB scale
// Range: -Infinity (mute) to -10dB (max)
function updateVolume() {
  const minDb = -60 // Floor for audible range
  const maxDb = -10 // Ceiling
  
  if (volumeSlider.value <= 0) {
    volumeDb.value = -Infinity
  } else {
    // Linear mapping for consistent sensitivity across the range
    // Normalized (0-1) * Range + Min
    const normalized = volumeSlider.value / 100
    volumeDb.value = minDb + normalized * (maxDb - minDb)
  }
}

watch(volumeSlider, async () => {
  updateVolume()
  setVolumes()
  if (arpeggiatorMasterVolume) {
    arpeggiatorMasterVolume.volume.rampTo(volumeDb.value + arpeggiatorGainBoostDB, 0.05)
  }
})
watch([fundamental, cantArmonicos, multiplicador, offset], () => {
  calcular()
})
watch(oscillatorType, async () => {
  for (let index = 0; index < syntArr.length; index++) {
    syntArr[index].type = oscillatorType.value
  }
  // Actualizar también los osciladores del arpegiador si existen
  arpeggiatorOscillators.forEach(osc => {
    osc.type = oscillatorType.value
  })
  // Actualizar oscilador antiguo (para compatibilidad)
  if (arpeggiatorOsc) {
    arpeggiatorOsc.type = oscillatorType.value
  }
})
watch(arpeggiatorType, async () => {
  // Reiniciar el arpegiador si está activo
  if (arpeggiatorActive.value) {
    stopArpeggiator()
    startArpeggiator()
  }
})
watch(arpeggiatorTempo, async () => {
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
    }, 500)
  }
})
watch(cantArmonicos, async () => {
  // Si el arpegiador está activo, reiniciar para adaptarse a los nuevos armónicos
  if (arpeggiatorActive.value) {
    currentArpeggioIndex = 0 // Reiniciar índice
    arpeggioDirection = 1
  }
})
watch(armonicos, async () => {
  // Si el arpegiador está activo y el array cambia, ajustar el índice
  if (arpeggiatorActive.value && armonicos.value.length > 0) {
    if (currentArpeggioIndex >= armonicos.value.length) {
      currentArpeggioIndex = 0 // Reiniciar si el índice está fuera de rango
    }
  }
})
function setVolumes() {
  for (let index = 0; index < syntArr.length; index++) {
    if (syntArr[index]) {
      syntArr[index].volume.rampTo(volumeDb.value, 0.05)
    }
  }
  // Si el arpegiador está activo, apagar los osciladores principales
  if (arpeggiatorActive.value) {
    muteMainOscillators()
  }
}

// Funciones para controlar los osciladores principales
function muteMainOscillators() {
  for (let index = 0; index < syntArr.length; index++) {
    if (syntArr[index]) {
      syntArr[index].volume.rampTo(-100, 0.05)
    }
  }
}

function restoreMainOscillators() {
  for (let index = 0; index < syntArr.length; index++) {
    if (index === 0 || index <= cantArmonicos.value) {
      syntArr[index].volume.rampTo(volumeDb.value, 0.05)
    } else {
      syntArr[index].volume.rampTo(-100, 0.05)
    }
  }
}

// Funciones del arpegiador
function toggleArpeggiator() {
  arpeggiatorActive.value = !arpeggiatorActive.value
  
  if (arpeggiatorActive.value) {
    // Apagar los osciladores principales
    muteMainOscillators()
    startArpeggiator()
  } else {
    stopArpeggiator()
    // Restaurar los osciladores principales
    restoreMainOscillators()
  }
}

function startArpeggiator() {
  if (armonicos.value.length === 0) return
  
  currentArpeggioIndex = 0
  arpeggioDirection = 1
  
  // Crear múltiples osciladores para el arpegiador si no existen
  if (arpeggiatorOscillators.length === 0) {
    if (!arpeggiatorMasterVolume) {
      arpeggiatorMasterVolume = new Tone.Volume(volumeDb.value + arpeggiatorGainBoostDB).toDestination()
    }
    for (let i = 0; i < maxArpeggiatorOscillators; i++) {
      const osc = new Tone.Oscillator(440, oscillatorType.value)
      const envelope = new Tone.AmplitudeEnvelope({
        attack: arpeggioAttack,
        decay: 0.1,
        sustain: 1,
        release: arpeggioRelease
      })
      const panner = new Tone.Panner(0)
      
      // Distribuir los osciladores en el espectro stereo
      panner.pan.value = i.mapValues(0, maxArpeggiatorOscillators - 1, -1, 1)
      
      osc.connect(envelope)
      envelope.connect(panner)
      panner.connect(arpeggiatorMasterVolume)
      osc.start()
      
      arpeggiatorOscillators.push(osc)
      arpeggiatorPanners.push(panner)
      arpeggiatorEnvelopes.push(envelope)
    }
  }
  
  // Actualizar el tipo de oscilador para todos los osciladores
  arpeggiatorOscillators.forEach(osc => {
    osc.type = oscillatorType.value
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

function playArpeggioNote(time) {
  if (armonicos.value.length === 0 || arpeggiatorOscillators.length === 0) return
  
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
  const currentFreq = armonicos.value[currentArpeggioIndex]
  if (currentFreq && currentOscillator && currentEnvelope) {
    currentOscillator.frequency.setValueAtTime(currentFreq, t)
    currentOscillator.type = oscillatorType.value
    currentEnvelope.triggerAttack(t)
  }
  activeArpeggioIndex.value = currentArpeggioIndex
  
  // Calcular el siguiente índice según el tipo de arpegio
  const arrayLength = armonicos.value.length
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
function calcular() {
  if (syntArr[0]) {
    syntArr[0].frequency.rampTo(fundamental.value, 0.02)
    if (!arpeggiatorActive.value) {
      syntArr[0].volume.rampTo(volumeDb.value, 0.05)
    }
  }

  const prevArpeggioIndex = currentArpeggioIndex
  const next = []

  for (let i = 0; i < cantArmonicos.value; i++) {
    let v = parseFloat(fibonacci(i + 1 + parseFloat(offset.value))) * parseFloat(multiplicador.value) + parseFloat(fundamental.value)
    next.push(v)
    if (audioStarted.value) {
      if (syntArr[i + 1]) {
        syntArr[i + 1].frequency.rampTo(v, 0.02)
        if (!arpeggiatorActive.value) {
          syntArr[i + 1].volume.rampTo(volumeDb.value, 0.05)
        }
      }
      if (panVolArr[i + 1]) {
        panVolArr[i + 1].pan.value = i.mapValues(0, cantArmonicos.value, -1, 1)
      }
    }
  }

  armonicos.value = next

  for (let index = cantArmonicos.value + 1; index < syntArr.length; index++) {
    if (syntArr[index]) {
      syntArr[index].volume.rampTo(-100, 0.05)
    }
  }

  if (arpeggiatorActive.value && armonicos.value.length > 0) {
    if (prevArpeggioIndex >= armonicos.value.length) {
      currentArpeggioIndex = 0
    } else {
      currentArpeggioIndex = prevArpeggioIndex
    }
  }
}

// Limpiar cuando se desmonta el componente
onUnmounted(() => {
  if (arpeggiatorInterval !== null) {
    Tone.Transport.clear(arpeggiatorInterval)
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
  syntArr.forEach(o => { o.stop(); o.dispose(); })
  panVolArr.forEach(p => p.dispose())
  
  // Limpiar oscilador antiguo (para compatibilidad)
  if (arpeggiatorOsc) {
    arpeggiatorOsc.stop()
    arpeggiatorOsc.dispose()
  }
  if (arpeggiatorGain) {
    arpeggiatorGain.dispose()
  }
})

</script>

<style scoped>
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
  100% { transform: translateY(0px); }
}

.hero-image {
  animation: float 6s ease-in-out infinite;
}
</style>

<template>
  <div class="flex flex-column align-items-center justify-content-center min-h-screen p-4 surface-ground">
    <div v-if="!audioStarted" class="flex flex-column align-items-center gap-4 fadein animation-duration-1000">
      <img src="/fibonacci_harmonics/landing-hero.svg" alt="Fibonacci Harmonics Hero" class="w-20rem md:w-30rem h-auto hero-image" />
      <h1 class="text-4xl font-bold text-primary mb-0">Fibonacci Harmonics</h1>
      <p class="text-xl text-500 mt-0 mb-4">Explore the mathematics of sound</p>
      <Button @click="startAudio" size="large" label="Start Audio Engine" icon="pi pi-play" class="p-button-raised p-button-lg shadow-4" rounded />
    </div>
    
    <div v-if="audioStarted" class="w-full max-w-7 fadein animation-duration-500">
        <!-- Main Controls Header -->
        <div class="flex justify-content-between align-items-center mb-4 p-3 surface-card border-round shadow-2">
             <div class="flex gap-3 align-items-center">
                 <i class="pi pi-wave-pulse text-2xl text-primary"></i>
                 <span class="font-bold text-xl">Fibonacci Harmonics</span>
             </div>
             <div class="flex gap-3 align-items-center">
                 <Dropdown :options="oscillatorTypes" v-model="oscillatorType" class="w-10rem" />
             </div>
        </div>

        <div class="grid">
            <!-- Harmonics Controls (Left/Center) -->
            <div class="col-12 md:col-8">
                <Card class="h-full shadow-2">
                    <template #title>Harmonics Generator</template>
                    <template #content>
                        <div class="flex justify-content-around flex-wrap gap-4 mt-4">
                            <!-- Fundamental -->
                            <div class="flex flex-column align-items-center gap-3">
                                <Slider v-model="fundamental" :min="80" :max="3000" orientation="vertical" class="h-12rem" />
                                <div class="text-center">
                                    <span class="block font-medium text-sm mb-1">Fund</span>
                                    <span class="block text-xs text-500">{{ Math.round(fundamental) }} Hz</span>
                                </div>
                            </div>
                            <!-- Harmonics Count -->
                            <div class="flex flex-column align-items-center gap-3">
                                <Slider v-model="cantArmonicos" :min="1" :max="maxArmonicos" orientation="vertical" class="h-12rem" />
                                <div class="text-center">
                                    <span class="block font-medium text-sm mb-1">Count</span>
                                    <span class="block text-xs text-500">{{ cantArmonicos }}</span>
                                </div>
                            </div>
                            <!-- Multiplier -->
                            <div class="flex flex-column align-items-center gap-3">
                                <Slider v-model="multiplicador" :min="1" :max="60" :step="0.1" orientation="vertical" class="h-12rem" />
                                <div class="text-center">
                                    <span class="block font-medium text-sm mb-1">Mult</span>
                                    <span class="block text-xs text-500">{{ multiplicador.toFixed(1) }}</span>
                                </div>
                            </div>
                             <!-- Offset -->
                            <div class="flex flex-column align-items-center gap-3">
                                <Slider v-model="offset" :min="0" :max="20" orientation="vertical" class="h-12rem" />
                                <div class="text-center">
                                    <span class="block font-medium text-sm mb-1">Offset</span>
                                    <span class="block text-xs text-500">{{ offset }}</span>
                                </div>
                            </div>
                             <!-- Volume -->
                            <div class="flex flex-column align-items-center gap-3">
                                <Slider v-model="volumeSlider" :min="0" :max="100" orientation="vertical" class="h-12rem" />
                                <div class="text-center">
                                    <span class="block font-medium text-sm mb-1">Vol</span>
                                    <span class="block text-xs text-500">{{ Math.round(volumeDb) }} dB</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>

            <!-- Arpeggiator Controls (Right) -->
            <div class="col-12 md:col-4">
                <Card class="h-full shadow-2">
                    <template #title>
                        <div class="flex align-items-center justify-content-between">
                            <span>Arpeggiator</span>
                            <Button 
                                @click="toggleArpeggiator" 
                                :icon="arpeggiatorActive ? 'pi pi-stop' : 'pi pi-play'" 
                                :severity="arpeggiatorActive ? 'danger' : 'success'" 
                                rounded 
                                text
                            />
                        </div>
                    </template>
                    <template #content>
                        <div class="flex flex-column gap-5 mt-3">
                            <div class="flex flex-column gap-2">
                                <label class="text-sm font-medium text-500">Pattern</label>
                                <Dropdown 
                                    :options="arpeggiatorTypes" 
                                    optionLabel="label" 
                                    optionValue="value"
                                    v-model="arpeggiatorType"
                                    class="w-full"
                                />
                            </div>
                            <div class="flex flex-column gap-2">
                                <div class="flex justify-content-between">
                                    <label class="text-sm font-medium text-500">Tempo</label>
                                    <span class="text-sm font-bold">{{ arpeggiatorTempo }}ms</span>
                                </div>
                                <Slider v-model="arpeggiatorTempo" :min="50" :max="500" :step="10" />
                            </div>
                        </div>
                    </template>
                </Card>
            </div>
            
            <!-- Visualization (Bottom) -->
            <div class="col-12">
                 <div class="flex flex-wrap gap-2 justify-content-center mt-3">
                    <Tag 
                        v-for="(item, idx) in armonicos" 
                        :key="idx" 
                        :value="Math.round(item)"
                        :severity="arpeggiatorActive && idx === activeArpeggioIndex ? 'danger' : 'primary'"
                        class="text-base px-3 py-2 border-round-xl"
                    />
                 </div>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
</style>
