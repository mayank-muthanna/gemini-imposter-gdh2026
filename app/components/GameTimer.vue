<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps<{ endTime: number; totalDuration: number }>();
const timeLeft = ref(0);
const isVisible = ref(true);

const timer = setInterval(() => {
  const diff = Math.max(0, Math.ceil((props.endTime - Date.now()) / 1000));
  timeLeft.value = diff;

  // 1/3rd logic: If we have passed 1/3 of duration, hide.
  // Wait... prompt says "Once 1/3rd of the time PASSES" -> HIDE.
  const elapsed = props.totalDuration - diff;
  if (elapsed > props.totalDuration / 3) {
    isVisible.value = false;
  } else {
    isVisible.value = true;
  }
}, 500);

onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="h-8 font-mono text-xl font-bold">
    <span v-if="isVisible">{{ timeLeft }}s</span>
    <span v-else class="text-red-500 animate-pulse">???</span>
  </div>
</template>
