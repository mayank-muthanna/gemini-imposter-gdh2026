<script setup lang="ts">
import { useRoute } from "vue-router";
import { api } from "../../../convex/_generated/api";
import GameLobby from "~/components/GameLobby.vue";
import GameBoard from "~/components/GameBoard.vue";

const route = useRoute();
const gameId = route.params.id as any;
const sessionId =
  typeof window !== "undefined"
    ? localStorage.getItem("gemini_session") || ""
    : "";

// Standard Query
const { data: gameState } = useConvexQuery(api.game.getGameState, {
  gameId,
  sessionId,
});

// ACTIONS REPLACED WITH MUTATIONS
const triggerAiTurn = useConvexMutation(api.game.triggerAiTurn);
const triggerAiVote = useConvexMutation(api.game.triggerAiVote);

const isHost = computed(
  () => gameState.value?.players[0]?.sessionId === sessionId,
);

let aiInterval: any;

watch(
  () => gameState.value?.game.status,
  (status) => {
    if (isHost.value && status === "discussion") {
      // Trigger AI Chat
      aiInterval = setInterval(() => {
        triggerAiTurn.mutate({ gameId });
      }, 4000);
    } else if (isHost.value && status === "voting") {
      // Trigger AI Vote
      setTimeout(() => {
        triggerAiVote.mutate({ gameId });
      }, 2000);
      clearInterval(aiInterval);
    } else {
      clearInterval(aiInterval);
    }
  },
);
</script>

<template>
  <div
    v-if="!gameState"
    class="h-screen bg-[#2A2320] flex items-center justify-center text-[#D17C5A] animate-pulse font-bold"
  >
    LOADING SIGNAL...
  </div>

  <div v-else class="min-h-screen bg-[#2A2320] text-[#E0D8D4] font-mono p-4">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div
        class="text-xl font-bold bg-[#3D3430] px-4 py-2 rounded-lg border border-[#5A4D48]"
      >
        CODE: <span class="text-[#D17C5A]">{{ gameState.game.code }}</span>
      </div>
      <div v-if="gameState.myPlayer" class="flex items-center gap-2">
        <span class="text-sm opacity-60">YOU ARE</span>
        <span class="font-bold text-[#D17C5A]">{{
          gameState.myPlayer.shape
        }}</span>
      </div>
    </div>

    <!-- State Views -->
    <GameLobby
      v-if="gameState.game.status === 'waiting'"
      :players="gameState.players"
      :isHost="isHost"
      :gameId="gameState.game._id"
    />

    <div
      v-else-if="gameState.game.status === 'ended'"
      class="text-center mt-20 space-y-8"
    >
      <h1
        class="text-6xl font-black"
        :class="
          gameState.game.winner === 'humans' ? 'text-green-500' : 'text-red-500'
        "
      >
        {{ gameState.game.winner === "humans" ? "HUMANS WIN" : "AI WINS" }}
      </h1>
      <div class="grid grid-cols-2 gap-4 max-w-lg mx-auto">
        <div
          v-for="p in gameState.players"
          :key="p._id"
          class="p-4 bg-[#3D3430] rounded-xl border-2"
          :class="p.isAi ? 'border-red-500' : 'border-green-500'"
        >
          <div class="font-bold">{{ p.realName }}</div>
          <div class="text-xs opacity-70">
            {{ p.isAi ? "THE AI" : "HUMAN" }}
          </div>
        </div>
      </div>
      <button
        onclick="window.location.href = '/'"
        class="bg-white text-black px-8 py-3 rounded-xl font-bold"
      >
        HOME
      </button>
    </div>

    <GameBoard
      v-else
      :game="gameState.game"
      :players="gameState.players"
      :myPlayer="gameState.myPlayer"
      :sessionId="sessionId"
    />
  </div>
</template>
