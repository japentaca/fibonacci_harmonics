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
  // Actualizar también el oscilador del arpegiador si existe
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
    stopArpeggiator()
    startArpeggiator()
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
  
  // Crear oscilador dedicado para el arpegiador si no existe
  if (!arpeggiatorOsc) {
    arpeggiatorOsc = new Tone.Oscillator(440, oscillatorType.value)
    arpeggiatorGain = new Tone.Gain(0).toDestination()
    arpeggiatorOsc.connect(arpeggiatorGain)
    arpeggiatorOsc.start()
  }
  
  // Actualizar el tipo de oscilador
  arpeggiatorOsc.type = oscillatorType.value
  
  // Tempo del arpegiador basado en el slider
  arpeggiatorInterval = setInterval(() => {
    playArpeggioNote()
  }, arpeggiatorTempo.value)
}

function stopArpeggiator() {
  if (arpeggiatorInterval) {
    clearInterval(arpeggiatorInterval)
    arpeggiatorInterval = null
  }
  
  // Apagar el volumen del arpegiador
  if (arpeggiatorGain) {
    arpeggiatorGain.gain.value = 0
  }
}

function playArpeggioNote() {
  if (armonicos.value.length === 0 || !arpeggiatorOsc || !arpeggiatorGain) return
  
  // Encender la nota actual del arpegio usando el oscilador dedicado
  const currentFreq = armonicos.value[currentArpeggioIndex]
  if (currentFreq) {
    arpeggiatorOsc.frequency.value = currentFreq
    arpeggiatorOsc.type = oscillatorType.value
    arpeggiatorGain.gain.value = Tone.dbToGain(volume.value)
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
  if (arpeggiatorInterval) {
    clearInterval(arpeggiatorInterval)
  }
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
