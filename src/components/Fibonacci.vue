<script setup>
import { ref, watch, onUnmounted } from 'vue'
import Tag from 'primevue/tag';

import Button from "primevue/button"
import Dropdown from "primevue/dropdown"
import Card from 'primevue/card';
import VSlider from './vSlider.vue';
import * as Tone from 'tone'


Number.prototype.mapValues = function (in_min, in_max, out_min, out_max) {
  return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

const maxArmonicos = 10
const fundamental = ref(440)
const cantArmonicos = ref(4)
const multiplicador = ref(1)
const armonicos = ref([])
const offset = ref(2)
const volume = ref(-20)
const audioStarted = ref(false)
let syntArr = []
let panVolArr = []
let arpeggiatorOsc = null
let arpeggiatorGain = null
let arpeggiatorOscillators = [] // Array para múltiples osciladores del arpegiador
let arpeggiatorPanners = [] // Array para los paneadores stereo
let arpeggiatorGains = [] // Array para los nodos de ganancia
let arpeggiatorEnvelopes = [] // Array para los envelopes ADSR
const maxArpeggiatorOscillators = 8 // Número máximo de osciladores para el arpegiador
const arpeggioAttack = 0.01 // Tiempo de ataque para evitar clicks
const arpeggioRelease = 0.05 // Tiempo de release para transiciones suaves


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

}

watch(cantArmonicos, async () => {
  armonicos.value = []
  calcular()
})
watch(volume, async () => {
  setVolumes()
  // Actualizar también los envelopes del arpegiador si están activos
  if (arpeggiatorActive.value && arpeggiatorEnvelopes.length > 0) {
    arpeggiatorEnvelopes.forEach(envelope => {
      envelope.sustain = Tone.dbToGain(volume.value)
    })
  }
})
watch(multiplicador, async () => {
  calcular()
})
watch(fundamental, async () => {

  calcular()
})
watch(offset, async () => {
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
  // Reiniciar el arpegiador si está activo para aplicar el nuevo tempo
  if (arpeggiatorActive.value) {
    const tempoBPM = 60000 / arpeggiatorTempo.value // Convertir ms a BPM
    Tone.Transport.bpm.value = tempoBPM
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
    syntArr[index].volume.value = volume.value
  }
  // Si el arpegiador está activo, apagar los osciladores principales
  if (arpeggiatorActive.value) {
    muteMainOscillators()
  }
}

// Funciones para controlar los osciladores principales
function muteMainOscillators() {
  for (let index = 0; index < syntArr.length; index++) {
    syntArr[index].volume.value = -100
  }
}

function restoreMainOscillators() {
  for (let index = 0; index < syntArr.length; index++) {
    if (index === 0 || index <= cantArmonicos.value) {
      syntArr[index].volume.value = volume.value
    } else {
      syntArr[index].volume.value = -100
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
    for (let i = 0; i < maxArpeggiatorOscillators; i++) {
      const osc = new Tone.Oscillator(440, oscillatorType.value)
      const envelope = new Tone.AmplitudeEnvelope({
        attack: arpeggioAttack,
        decay: 0.1,
        sustain: Tone.dbToGain(volume.value),
        release: arpeggioRelease
      })
      const panner = new Tone.Panner(0).toDestination()
      
      // Distribuir los osciladores en el espectro stereo
      panner.pan.value = i.mapValues(0, maxArpeggiatorOscillators - 1, -1, 1)
      
      osc.connect(envelope)
      envelope.connect(panner)
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
  
  // Configurar el tempo usando Tone.Transport
  const tempoBPM = 60000 / arpeggiatorTempo.value // Convertir ms a BPM
  Tone.Transport.bpm.value = tempoBPM
  
  // Programar el evento del arpegiador
  arpeggiatorInterval = Tone.Transport.scheduleRepeat((time) => {
    playArpeggioNote(time)
  }, '8n') // Usar corcheas para mejor timing
  
  // Iniciar el transporte si no está corriendo
  if (Tone.Transport.state !== 'started') {
    Tone.Transport.start()
  }
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
}

function playArpeggioNote(time) {
  if (armonicos.value.length === 0 || arpeggiatorOscillators.length === 0) return
  
  // Seleccionar un oscilador basado en el índice actual para distribuir en stereo
  const oscillatorIndex = currentArpeggioIndex % arpeggiatorOscillators.length
  const currentOscillator = arpeggiatorOscillators[oscillatorIndex]
  const currentEnvelope = arpeggiatorEnvelopes[oscillatorIndex]
  
  // Apagar todos los envelopes primero para evitar superposición
  arpeggiatorEnvelopes.forEach((envelope, index) => {
    if (index !== oscillatorIndex) {
      envelope.triggerRelease(time)
    }
  })
  
  // Encender la nota actual del arpegio usando el oscilador seleccionado
  const currentFreq = armonicos.value[currentArpeggioIndex]
  if (currentFreq && currentOscillator && currentEnvelope) {
    currentOscillator.frequency.setValueAtTime(currentFreq, time)
    currentOscillator.type = oscillatorType.value
    currentEnvelope.triggerAttack(time)
  }
  
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
      currentArpeggioIndex += arpeggioDirection
      if (currentArpeggioIndex >= arrayLength) {
        currentArpeggioIndex = arrayLength - 2
        arpeggioDirection = -1
      } else if (currentArpeggioIndex < 0) {
        currentArpeggioIndex = 1
        arpeggioDirection = 1
      }
      break
    case 'random':
      currentArpeggioIndex = Math.floor(Math.random() * arrayLength)
      break
  }
}
function calcular() {

  syntArr[0].frequency.value = fundamental.value
  // Solo encender el oscilador fundamental si el arpegiador NO está activo
  if (!arpeggiatorActive.value) {
    syntArr[0].volume.value = volume.value
  }

  // Guardar el índice actual del arpegiador
  const prevArpeggioIndex = currentArpeggioIndex
  
  for (let i = 0; i < cantArmonicos.value; i++) {
    let v = parseFloat(fibonacci(i + 1 + parseFloat(offset.value))) * parseFloat(multiplicador.value) + parseFloat(fundamental.value)
    armonicos.value[i] = v
    if (audioStarted.value) {
      syntArr[i + 1].frequency.value = v
      // Solo encender el oscilador si el arpegiador NO está activo
      if (!arpeggiatorActive.value) {
        syntArr[i + 1].volume.value = volume.value
      }
      panVolArr[i + 1].pan.value = i.mapValues(0, cantArmonicos.value, -1, 1)
    }
  }

  for (let index = cantArmonicos.value + 1; index < syntArr.length; index++) {
    syntArr[index].volume.value = -100
  }
  
  // Si el arpegiador está activo y el array de armónicos cambió, ajustar el índice
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

<template>
  <Button v-if="!audioStarted " @click="startAudio">Start</Button>
  <div v-if="audioStarted">
    <div class="card">
      <Dropdown :options="oscillatorTypes" v-model="oscillatorType"></Dropdown>
      <p></p>
      
      <!-- Controles del Arpegiador -->
      <div class="arpeggiator-controls">
        <Button 
          @click="toggleArpeggiator" 
          :severity="arpeggiatorActive ? 'danger' : 'success'"
          class="mr-2"
        >
          {{ arpeggiatorActive ? 'Detener Arpegiador' : 'Iniciar Arpegiador' }}
        </Button>
        <Dropdown 
          :options="arpeggiatorTypes" 
          optionLabel="label" 
          optionValue="value"
          v-model="arpeggiatorType"
          placeholder="Tipo de Arpegio"
          class="mr-2"
        ></Dropdown>
        <Card class="flex">
          <template #content>
            <p>Tempo {{arpeggiatorTempo}}ms</p>
            <VSlider v-model="arpeggiatorTempo" :min="50" :max="500" step="10"></VSlider>
          </template>
        </Card>
      </div>
      <p></p>
      <div class="gap-3 card-container blue-container flex align-items-center justify-content-start">
        <Card class="flex">
          <template #content>
            <p>Fund {{fundamental}}</p>
            <VSlider v-model="fundamental" :min="80" :max="3000"></VSlider>
          </template>
        </Card>
        <Card class="flex">
          <template #content>
            <p>Armónicos {{cantArmonicos}}</p>
            <VSlider v-model="cantArmonicos" :min="1" :max="maxArmonicos"></VSlider>
          </template>
        </Card>
        <Card class="flex">
          <template #content>
            <p>Mult {{multiplicador}}</p>
            <VSlider v-model="multiplicador" :min=1 :max=60 step=0.1></VSlider>
          </template>
        </Card>
        <Card class="flex">
          <template #content>
            <p>Fib Offset {{offset}}</p>
            <VSlider v-model="offset" :min="0" :max="20"></VSlider>
          </template>
        </Card>
        <Card class="flex">
          <template #content>
            <p>volume {{volume}}</p>
            <VSlider v-model="volume" :min="-100" :max="-20"></VSlider>
          </template>
        </Card>
      </div>
    </div>

    <div>
      <Tag class="mr-2" v-for="item in armonicos">{{item}} </Tag>

    </div>
  </div>

</template>

<style scoped>
.arpeggiator-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
}

@media (max-width: 768px) {
  .arpeggiator-controls {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
