<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { onBeforeUnmount, watchEffect, computed } from "vue";
import { api } from "../../../convex/_generated/api";
import GameLobby from "~/components/GameLobby.vue";
import GameBoard from "~/components/GameBoard.vue";

const route = useRoute();
const router = useRouter();
const gameId = route.params.id as any;

// 1. Robust Session Management
const sessionId =
  typeof window !== "undefined"
    ? localStorage.getItem("gemini_session") ||
      "USER_" + Math.random().toString(36).substr(2, 9)
    : "";

// Save it back if it was generated
if (typeof window !== "undefined" && !localStorage.getItem("gemini_session")) {
  localStorage.setItem("gemini_session", sessionId);
}

const { data: gameState } = useConvexQuery(api.game.getGameState, {
  gameId,
  sessionId,
});

// 2. Exit Logic
const { mutate: leaveGame } = useConvexMutation(api.game.leaveGame);

const handleExit = () => {
  if (gameState.value?.game && gameState.value.game.status !== "ended") {
    // We use sendBeacon in 'beforeunload' usually, but here we try the mutation
    leaveGame({ gameId, sessionId });
  }
};

// Trigger when navigating away within Vue
onBeforeUnmount(() => {
  handleExit();
});

// Trigger when closing tab/browser
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", handleExit);
}

// 3. Auto-Redirect if Game is Deleted (Cleanup)
watchEffect(() => {
  if (gameState.value === null) {
    router.push("/");
  }
});

const isHost = computed(
  () => gameState.value?.players[0]?.sessionId === sessionId,
);
</script>

<template>
  <div
    v-if="!gameState"
    class="h-screen bg-[#2A2320] flex items-center justify-center text-[#D17C5A] animate-pulse font-bold"
  >
    CONNECTING...
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
          class="p-4 bg-[#3D3430] rounded-xl border-2 transition-all"
          :class="
            p.isAi
              ? 'border-red-500 scale-105 shadow-xl'
              : 'border-green-500 opacity-75'
          "
        >
          <div class="font-bold text-xl">{{ p.realName }}</div>
          <div class="text-xs uppercase tracking-widest mt-1">
            {{ p.isAi ? "THE IMPOSTOR" : "HUMAN" }}
          </div>
        </div>
      </div>
      <button
        @click="router.push('/')"
        class="bg-[#D17C5A] hover:bg-[#b56b4d] text-white px-8 py-3 rounded-xl font-bold transition-colors"
      >
        BACK TO HOME
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
