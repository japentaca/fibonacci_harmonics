 setup

<script setup>

defineProps([
  "modelValue", "max", "min"
])

defineEmits(['update:modelValue'])

</script>
<template>
  <div>
    <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" orient="vertical" type="range"
      :min="min" :max="max" />
  </div>

</template>
<style scoped>
input[type="range"] {
  -webkit-appearance: slider-vertical;
}
</style>
