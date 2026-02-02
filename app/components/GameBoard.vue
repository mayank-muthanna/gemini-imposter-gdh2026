<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "../../convex/_generated/api";
import GameChat from "./GameChat.vue";
import GameTimer from "./GameTimer.vue";

const props = defineProps<{
  game: any;
  players: any[];
  myPlayer: any;
  sessionId: string;
}>();
const castVote = useConvexMutation(api.game.castVote);

const isVoting = computed(() => props.game.status === "voting");
const activePlayers = computed(() =>
  props.players.filter((p) => !p.isEliminated),
);

const handleVote = (targetId: any) => {
  if (props.myPlayer.hasVoted || props.myPlayer.isEliminated) return;
  castVote.mutate({
    gameId: props.game._id,
    sessionId: props.sessionId,
    targetId,
  });
};
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <!-- TIMER / PHASE HEADER -->
    <div class="text-center mb-6">
      <h2 class="text-2xl font-black uppercase text-[#D17C5A] mb-2">
        {{ game.status }}
      </h2>
      <GameTimer
        v-if="game.endTime"
        :endTime="game.endTime"
        :totalDuration="(game.endTime - game.startTime) / 1000"
      />
      <div v-if="isVoting" class="text-red-400 animate-pulse font-bold">
        VOTE FOR THE IMPOSTER
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-8 h-[600px]">
      <!-- LEFT SIDE: IMAGE or VOTING UI -->
      <div
        class="bg-[#3D3430] rounded-3xl p-6 border border-[#5A4D48] flex flex-col relative overflow-hidden"
      >
        <!-- VOTING OVERLAY -->
        <div
          v-if="isVoting"
          class="absolute inset-0 z-20 bg-[#2A2320]/95 flex flex-col items-center justify-center p-8"
        >
          <div class="grid grid-cols-3 gap-4 w-full">
            <button
              v-for="p in activePlayers"
              :key="p._id"
              @click="handleVote(p._id)"
              :disabled="
                myPlayer.hasVoted ||
                myPlayer.isEliminated ||
                p._id === myPlayer._id
              "
              class="aspect-square rounded-xl bg-[#3D3430] border-2 border-[#5A4D48] hover:border-[#D17C5A] hover:bg-[#D17C5A]/20 transition flex flex-col items-center justify-center gap-2"
              :class="{ 'opacity-50': myPlayer.hasVoted }"
            >
              <div class="text-2xl">{{ p.shape }}</div>
              <div
                v-if="myPlayer.hasVoted && !p.isEliminated"
                class="text-xs text-green-500"
              >
                ?
              </div>
            </button>
          </div>
          <div v-if="myPlayer.hasVoted" class="mt-8 text-[#D17C5A]">
            VOTE CAST. WAITING...
          </div>
        </div>

        <!-- IMAGE DISPLAY -->
        <div class="w-full h-full bg-black rounded-xl overflow-hidden relative">
          <div
            v-if="myPlayer.isAi"
            class="absolute inset-0 flex items-center justify-center bg-gray-900 text-center p-8"
          >
            <div>
              <h3 class="text-3xl font-black text-red-500 mb-4">
                YOU ARE THE AI
              </h3>
              <p class="text-gray-400">You cannot see the image.</p>
              <p class="text-gray-400">Read the chat. Blend in.</p>
            </div>
          </div>
          <img v-else :src="game.image" class="w-full h-full object-cover" />
        </div>
      </div>

      <!-- RIGHT SIDE: CHAT -->
      <GameChat
        :gameId="game._id"
        :sessionId="sessionId"
        :isEliminated="myPlayer.isEliminated"
        :isDisabled="isVoting"
      />
    </div>
  </div>
</template>
