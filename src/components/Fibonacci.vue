<script setup>
import { ref, watch } from 'vue'
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


})
function setVolumes() {
  for (let index = 0; index < syntArr.length; index++) {
    syntArr[index].volume.value = volume.value
  }

}
function calcular() {


  syntArr[0].frequency.value = fundamental.value
  syntArr[0].volume.value = volume.value

  for (let i = 0; i < cantArmonicos.value; i++) {
    let v = parseFloat(fibonacci(i + 1 + parseFloat(offset.value))) * parseFloat(multiplicador.value) + parseFloat(fundamental.value)
    armonicos.value[i] = v
    if (audioStarted.value) {
      syntArr[i + 1].frequency.value = v
      syntArr[i + 1].volume.value = volume.value
      panVolArr[i + 1].pan.value = i.mapValues(0, cantArmonicos.value, -1, 1)
    }
  }

  for (let index = cantArmonicos.value + 1; index < syntArr.length; index++) {
    syntArr[index].volume.value = -100
  }
}

</script>

<template>
  <Button v-if="!audioStarted " @click="startAudio">Start</Button>
  <div v-if="audioStarted">
    <div class="card">
      <Dropdown :options="oscillatorTypes" v-model="oscillatorType"></Dropdown>
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

</style>
