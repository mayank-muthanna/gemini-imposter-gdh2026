<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";

const props = defineProps<{ endTime: number; totalDuration: number }>();
const timeLeft = ref(0);
const isVisible = ref(true);

const interval = setInterval(() => {
  const now = Date.now();
  const diff = Math.max(0, Math.ceil((props.endTime - now) / 1000));
  timeLeft.value = diff;

  // 1/3rd rule: Hide timer if time left is less than 2/3rds of total
  // Actually the prompt says: "Once 1/3rd of the time passes - the timer will disappear"
  const timePassed = props.totalDuration - diff;
  if (timePassed > props.totalDuration / 3) {
    isVisible.value = false;
  }
}, 1000);

onUnmounted(() => clearInterval(interval));
</script>

<template>
  <div class="text-center mb-4 h-8">
    <div v-if="isVisible" class="text-2xl font-mono font-bold text-[#d17c5a]">
      {{ timeLeft }}s
    </div>
    <div v-else class="text-sm font-bold text-red-500 animate-pulse">???</div>
  </div>
</template>
