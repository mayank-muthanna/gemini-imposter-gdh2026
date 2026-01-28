<script setup lang="ts">
const props = defineProps<{
  gameId: string;
  players: any[];
  isHost: boolean; // Just a logic check if player is 1st
}>();

const emit = defineEmits(['start']);
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <h2 class="text-3xl font-bold text-[#5a2d1a]">Lobby</h2>
    <div class="grid grid-cols-3 gap-4">
      <div v-for="p in players" :key="p._id" class="p-4 bg-white rounded-xl shadow border-2 border-[#f0cdbb]">
        <div class="font-bold">{{ p.name }}</div>
      </div>
    </div>
    <div v-if="players.length < 3" class="text-sm text-red-500">Waiting for players (3 min)...</div>
    <button
      v-if="isHost && players.length >= 3"
      @click="$emit('start')"
      class="px-8 py-3 bg-[#d17c5a] text-white rounded-xl font-bold hover:bg-[#b96547]"
    >
      Start Game
    </button>
  </div>
</template>
