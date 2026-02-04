<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../convex/_generated/api";

const router = useRouter();

// Your existing code...
const testGemini = useConvexMutation(api.game.testGeminiTrigger);
const testStatus = ref("");

const runTest = async () => {
  testStatus.value = "Testing... (check browser console for logs)";
  try {
    const result = await testGemini.mutate({});
    testStatus.value = result.message;
  } catch (e: any) {
    testStatus.value = "Error: " + e.message;
  }
};

// DEFINE HOOKS HERE (Top Level)
const createGame = useConvexMutation(api.game.createGame);
const joinGame = useConvexMutation(api.game.joinGame);

const joinCode = ref("");
const userName = ref("");
const isLoading = ref(false);

const getSession = () => {
  let s = localStorage.getItem("gemini_session");
  if (!s) {
    s = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("gemini_session", s);
  }
  return s;
};

const handleCreate = async () => {
  if (!userName.value) return alert("Enter Name");
  isLoading.value = true;
  const sessionId = getSession();

  try {
    // Single mutation call. It creates game AND adds player.
    const gameId = await createGame.mutate({
      realName: userName.value,
      sessionId,
    });
    router.push(`/game/${gameId}`);
  } catch (e: any) {
    alert("Error creating game: " + e.message);
    isLoading.value = false;
  }
};

const handleJoin = async () => {
  if (!joinCode.value || !userName.value) return alert("Enter Name and Code");
  isLoading.value = true;
  const sessionId = getSession();
  try {
    const gameId = await joinGame.mutate({
      gameCode: joinCode.value.toUpperCase(),
      realName: userName.value,
      sessionId,
    });
    router.push(`/game/${gameId}`);
  } catch (e: any) {
    alert(e.message);
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="min-h-screen bg-[#2A2320] flex items-center justify-center p-4 font-mono"
  >
    <div
      class="max-w-md w-full text-center space-y-6 bg-[#3D3430] p-8 rounded-3xl shadow-2xl border-4 border-[#D17C5A]"
    >
      <h1 class="text-5xl font-black text-[#D17C5A] tracking-tighter">
        GEMINI<br /><span class="text-white text-2xl">IMPOSTER</span>
      </h1>

      <input
        v-model="userName"
        placeholder="YOUR NAME"
        class="w-full bg-[#2A2320] text-white p-4 rounded-xl text-center font-bold text-xl outline-none border-2 border-transparent focus:border-[#D17C5A] transition"
      />

      <div class="space-y-4 pt-4 border-t border-gray-600">
        <button
          @click="handleCreate"
          :disabled="isLoading"
          class="w-full py-4 bg-[#D17C5A] text-white rounded-xl font-bold text-xl hover:bg-[#B96547] transition shadow-[0_4px_0_#8a4b32] active:translate-y-1 active:shadow-none"
        >
          CREATE GAME
        </button>
        <div class="flex gap-2">
          <input
            v-model="joinCode"
            placeholder="CODE"
            class="w-24 bg-[#2A2320] text-white p-3 rounded-xl text-center font-bold uppercase"
          />
          <button
            @click="handleJoin"
            :disabled="isLoading"
            class="flex-1 py-3 bg-white text-[#2A2320] rounded-xl font-bold hover:bg-gray-200 transition"
          >
            JOIN
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
