 setup

<script setup>


defineProps({
  modelValue: Number, max: Number, min: Number
}
)

const emit = defineEmits(['update:modelValue'])

function inpevent(event) {
  let v = parseFloat(event.target.value)

  emit('update:modelValue', v)

}

</script>
<template>
  <div>
    <input :value="modelValue" @input="inpevent($event)" orient="vertical" type="range" :min="min" :max="max" />
  </div>

</template>
<style scoped>
input[type="range"] {
  -webkit-appearance: slider-vertical;
}
</style>
