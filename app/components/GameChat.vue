<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { api } from "../../convex/_generated/api";

const props = defineProps<{
  gameId: any;
  sessionId: string;
  isEliminated: boolean;
  isDisabled: boolean;
}>();

const { data: messages } = useConvexQuery(api.game.getMessages, {
  gameId: props.gameId,
});

const sendMessage = useConvexMutation(api.game.sendMessage);

const input = ref("");
const cooldown = ref(false);
const scrollRef = ref<HTMLElement | null>(null);

// Watch for NEW messages and scroll
watch(
  () => messages.value,
  async (newMsgs) => {
    if (newMsgs && newMsgs.length > 0) {
      await nextTick();
      if (scrollRef.value) {
        scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
      }
    }
  },
  { deep: true, immediate: true },
);

const send = async () => {
  if (!input.value.trim() || cooldown.value || props.isEliminated) return;
  const txt = input.value;
  input.value = "";

  // Frontend Cooldown (Visual only) - Backend also checks this
  cooldown.value = true;
  setTimeout(() => (cooldown.value = false), 1500);

  try {
    await sendMessage.mutate({
      gameId: props.gameId,
      sessionId: props.sessionId,
      text: txt,
    });
  } catch (err: any) {
    console.error("Failed to send:", err);
    // If backend rejects (e.g. too fast), clear the input again or show error
  }
};
</script>

<template>
  <div
    class="flex flex-col h-full bg-[#3D3430] rounded-3xl border border-[#5A4D48] overflow-hidden"
  >
    <!-- Message List -->
    <div
      ref="scrollRef"
      class="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
    >
      <div v-if="!messages" class="text-center opacity-50 text-sm mt-10">
        Loading chat...
      </div>

      <div
        v-else-if="messages.length === 0"
        class="text-center opacity-50 text-sm mt-10"
      >
        No messages yet.
      </div>

      <div
        v-else
        v-for="m in messages.slice().reverse()"
        :key="m._id"
        class="flex flex-col items-start"
        :class="{ 'opacity-50': m.playerName === 'SYSTEM' }"
      >
        <div class="text-[10px] uppercase font-bold text-[#D17C5A] mb-0.5 ml-1">
          {{ m.playerName }}
        </div>

        <!-- System Message Style -->
        <div
          v-if="m.playerName === 'SYSTEM'"
          class="w-full text-center text-xs text-yellow-500 py-1 border-y border-yellow-500/20 bg-yellow-500/5"
        >
          {{ m.text }}
        </div>

        <!-- User Message Style -->
        <div
          v-else
          class="bg-[#2A2320] px-3 py-2 rounded-xl rounded-tl-none border border-[#5A4D48] max-w-[90%] text-sm break-words"
        >
          {{ m.text }}
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="p-3 bg-[#2A2320] border-t border-[#5A4D48]">
      <input
        v-model="input"
        @keydown.enter="send"
        :disabled="cooldown || isEliminated || isDisabled"
        :placeholder="
          isEliminated
            ? 'You are eliminated.'
            : isDisabled
              ? 'Voting in progress...'
              : 'Describe what you see...'
        "
        class="w-full bg-[#3D3430] text-white px-4 py-3 rounded-xl outline-none focus:ring-2 ring-[#D17C5A] disabled:opacity-50 transition placeholder-gray-500"
      />
    </div>
  </div>
</template>
