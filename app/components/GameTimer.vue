<script setup lang="ts">
import { ref, watchEffect } from "vue";

// Accepting startTime + duration aligns with the Convex schema provided
const props = defineProps<{
  startTime: number;
  duration: number; // in seconds
}>();

const timeLeft = ref(0);
const isVisible = ref(true);

watchEffect((onCleanup) => {
  const updateTimer = () => {
    const now = Date.now();
    const elapsedMs = now - props.startTime;
    const totalMs = props.duration * 1000;
    const remainingMs = totalMs - elapsedMs;

    // 1. Calculate Seconds Left
    timeLeft.value = Math.max(0, Math.ceil(remainingMs / 1000));

    // 2. Visibility Rule:
    // "Once 1/3rd of the time passes - the timer will disappear"
    // Example: 30s round. 1/3 is 10s.
    // If elapsed is 5s, it is visible. If elapsed is 12s, it is hidden.
    isVisible.value = elapsedMs < totalMs / 3;
  };

  // Run once immediately to prevent flicker
  updateTimer();

  // Run frequently to keep UI snappy
  const timer = setInterval(updateTimer, 250);

  // Cleanup when component unmounts OR when props change (new round)
  onCleanup(() => {
    clearInterval(timer);
  });
});
</script>

<template>
  <div class="h-8 font-mono text-xl font-bold flex items-center justify-center">
    <!-- Normal Timer -->
    <span v-if="isVisible" class="text-white transition-all duration-300">
      {{ timeLeft }}s
    </span>

    <!-- Tension Mode -->
    <span v-else class="text-red-500 animate-pulse tracking-widest text-2xl">
      ???
    </span>
  </div>
</template>
