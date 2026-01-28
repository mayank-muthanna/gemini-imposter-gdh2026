<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../convex/_generated/api";

const router = useRouter();
const createGame = useConvexMutation(api.game.createGame);
const joinGame = useConvexMutation(api.game.joinGame);

const joinCode = ref("");

const handleCreate = async () => {
  const gameId = await createGame.mutate({});
  // In real app, you'd get the code from the result, query it, then route
  // Simplified: we'll route to lobby and let the lobby fetch by ID/Code
  // Actually, let's just create a session ID here
  const sessionId = Math.random().toString(36);
  localStorage.setItem("gemini_game_session", sessionId);
  // Need to fetch the game code... assume createGame returns ID, we navigate to ID
  // But for better UX, let's redirect to a waiting room
  // (Assuming you can pass ID in URL)
  router.push(`/game/${gameId}`);
};

const handleJoin = async () => {
  if (!joinCode.value) return;
  const sessionId = Math.random().toString(36);
  localStorage.setItem("gemini_game_session", sessionId);
  try {
    // Join logic here usually returns ID
    // For this hackathon, we assume direct navigation logic handles join on mount
    router.push(`/game/${joinCode.value}`);
  } catch (e) {
    alert("Invalid code");
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#FFF4EE] flex items-center justify-center p-4">
    <div class="max-w-md w-full text-center space-y-8">
      <h1 class="text-4xl font-bold text-[#5a2d1a]">Mayank Muthanna</h1>

      <div class="space-y-4">
        <button
          @click="handleCreate"
          class="w-full py-4 bg-[#d17c5a] text-white rounded-2xl font-bold text-xl hover:bg-[#b96547] transition"
        >
          Create Lobby
        </button>

        <div class="relative">
          <input
            v-model="joinCode"
            placeholder="Enter Code"
            class="w-full py-4 px-6 rounded-2xl border-2 border-[#f0cdbb] text-center text-xl uppercase"
          />
        </div>
        <button
          @click="handleJoin"
          class="w-full py-3 bg-white border-2 border-[#d17c5a] text-[#d17c5a] rounded-xl font-bold"
        >
          Join Game
        </button>
      </div>
    </div>
  </div>
</template>
