<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../convex/_generated/api";

const props = defineProps<{ gameId: any; sessionId: string }>();
const messages = useConvexQuery(api.game.getMessages, { gameId: props.gameId });
const sendMessage = useConvexMutation(api.game.sendMessage);
const triggerAi = useConvexAction(api.actions.generateAiResponse); // Setup Action

const input = ref("");
const cooldown = ref(false);

const send = async () => {
  if (!input.value.trim() || cooldown.value) return;

  const text = input.value;
  input.value = "";
  cooldown.value = true;

  // 1. Send Human Message
  await sendMessage.mutate({
    gameId: props.gameId,
    sessionId: props.sessionId,
    text,
  });

  // 2. Trigger AI check (It decides internally if it should reply)
  // In a real hackathon, you might run this on a cron or after every N messages
  // Here we trigger it simply after a human message for reactivity
  triggerAi.run({ gameId: props.gameId });

  // Cooldown Reset
  setTimeout(() => {
    cooldown.value = false;
  }, 1500);
};
</script>

<template>
  <div
    class="flex flex-col h-[400px] w-full max-w-md bg-white rounded-xl border border-[#f0cdbb] overflow-hidden"
  >
    <div class="flex-1 overflow-y-auto p-4 space-y-2">
      <div
        v-for="m in messages"
        :key="m._id"
        class="p-2 rounded-lg text-sm max-w-[80%]"
        :class="m.isAi ? 'bg-red-100 ml-auto' : 'bg-gray-100'"
      >
        <span class="font-bold text-xs block mb-1">{{ m.playerName }}</span>
        {{ m.text }}
      </div>
    </div>
    <div class="p-2 bg-[#FFF4EE] border-t border-[#f0cdbb] flex gap-2">
      <input
        v-model="input"
        @keydown.enter="send"
        :disabled="cooldown"
        placeholder="Describe the image..."
        class="flex-1 px-3 py-2 rounded-lg border border-[#e6b8a2]"
      />
    </div>
  </div>
</template>
