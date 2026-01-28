<script setup lang="ts">
import { useRoute } from "vue-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel"; // Import ID type if needed

const route = useRoute();

// 1. Cast the route param to the correct ID type
const gameId = route.params.id as Id<"games">;

// 2. DESTRUCTURE 'data' (Fixes the "undefined" error)
// We rename 'data' to 'gameState' for clarity
const { data: gameState } = useConvexQuery(api.game.getGame, { gameId });

const sessionId =
  typeof window !== "undefined"
    ? localStorage.getItem("gemini_game_session")
    : "";
const startGame = useConvexMutation(api.game.startGame);

const myPlayer = computed(() => {
  return gameState.value?.players.find((p: any) => p.sessionId === sessionId);
});

const isHost = computed(() => {
  return gameState.value?.players[0]?.sessionId === sessionId;
});

const handleStart = async () => {
  if (!gameState.value) return;
  await startGame.mutate({ gameId: gameState.value.game._id });
};

const roundDuration = computed(() => {
  if (!gameState.value) return 30;
  const count =
    gameState.value.players.filter((p: any) => !p.isEliminated).length || 6;
  if (count >= 6) return 30;
  if (count === 5) return 25;
  if (count === 4) return 20;
  return 15;
});
</script>

<template>
  <!-- 3. Add a loading state to prevent accessing null data -->
  <div
    v-if="!gameState"
    class="min-h-screen flex items-center justify-center bg-[#FFF4EE] text-[#5a2d1a]"
  >
    Loading Game...
  </div>

  <div v-else class="min-h-screen bg-[#FFF4EE] p-6">
    <header class="flex justify-between items-center mb-6">
      <div class="text-[#5a2d1a] font-bold">
        <!-- Now safely accesses nested properties -->
        Room Code: {{ gameState.game.code }}
      </div>
      <div
        v-if="myPlayer"
        class="px-3 py-1 bg-[#d17c5a] text-white rounded-full text-sm"
      >
        You are: {{ myPlayer.name }}
      </div>
    </header>

    <!-- LOBBY STATE -->
    <GameLobby
      v-if="gameState.game.status === 'waiting'"
      :players="gameState.players"
      :isHost="isHost"
      :gameId="gameState.game._id"
      @start="handleStart"
    />

    <!-- PLAYING STATE -->
    <main
      v-else-if="gameState.game.status === 'playing'"
      class="max-w-4xl mx-auto grid md:grid-cols-2 gap-6"
    >
      <div class="space-y-6">
        <GameTimer
          v-if="gameState.game.roundEndTime"
          :endTime="gameState.game.roundEndTime"
          :totalDuration="roundDuration"
        />

        <div
          class="aspect-square bg-gray-200 rounded-2xl overflow-hidden border-4 border-[#5a2d1a]"
        >
          <div
            v-if="myPlayer?.isAi"
            class="w-full h-full flex items-center justify-center text-center p-6 bg-gray-800 text-white"
          >
            <p>YOU ARE THE IMPOSTER<br />GLITCH THE SYSTEM</p>
          </div>
          <img
            v-else
            :src="myPlayer?.assignedImage"
            class="w-full h-full object-cover"
          />
        </div>
      </div>

      <div>
        <GameChat :gameId="gameState.game._id" :sessionId="sessionId" />
      </div>
    </main>
  </div>
</template>
