<script setup lang="ts">
import { api } from "../../convex/_generated/api";
const props = defineProps<{ players: any[]; isHost: boolean; gameId: any }>();
const startGame = useConvexMutation(api.game.startGame);
</script>

<template>
  <div class="flex flex-col items-center gap-8 mt-10">
    <div class="text-center">
      <h2 class="text-3xl font-bold mb-2">WAITING FOR PLAYERS</h2>
      <p class="text-[#D17C5A]">{{ players.length }} / 8 JOINED</p>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl">
      <div
        v-for="p in players"
        :key="p._id"
        class="aspect-square bg-[#3D3430] rounded-xl flex items-center justify-center border-2 border-[#5A4D48] relative overflow-hidden group"
      >
        <div class="font-bold text-xl">{{ p.realName }}</div>
      </div>
      <!-- Empty slots -->
      <div
        v-for="i in Math.max(3, players.length + 1) - players.length"
        :key="i"
        class="aspect-square border-2 border-dashed border-[#5A4D48] rounded-xl opacity-30"
      ></div>
    </div>

    <button
      v-if="isHost"
      @click="startGame.mutate({ gameId })"
      :disabled="players.length < 3"
      class="mt-8 px-12 py-4 bg-[#D17C5A] text-white rounded-2xl font-bold text-xl hover:bg-[#B96547] disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      START GAME
    </button>
    <div v-else class="animate-pulse text-sm opacity-50">
      WAITING FOR HOST TO START...
    </div>
  </div>
</template>
