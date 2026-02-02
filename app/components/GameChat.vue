<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { api } from "../../convex/_generated/api";

const props = defineProps<{
  gameId: any;
  sessionId: string;
  isEliminated: boolean;
  isDisabled: boolean;
}>();

// FIX 1: Destructure 'data' so 'messages' becomes the actual Ref<Array>
const { data: messages } = useConvexQuery(api.game.getMessages, {
  gameId: props.gameId,
});

const sendMessage = useConvexMutation(api.game.sendMessage);

const input = ref("");
const cooldown = ref(false);
const scrollRef = ref<HTMLElement | null>(null);

// FIX 2: Watch the messages Ref directly
watch(
  messages,
  async () => {
    await nextTick();
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    }
  },
  { deep: true },
);

const send = async () => {
  if (!input.value.trim() || cooldown.value || props.isEliminated) return;
  const txt = input.value;
  input.value = "";
  cooldown.value = true;

  await sendMessage.mutate({
    gameId: props.gameId,
    sessionId: props.sessionId,
    text: txt,
  });

  setTimeout(() => (cooldown.value = false), 1500);
};
</script>

<template>
  <div
    class="flex flex-col h-full bg-[#3D3430] rounded-3xl border border-[#5A4D48] overflow-hidden"
  >
    <!-- Message List -->
    <div ref="scrollRef" class="flex-1 overflow-y-auto p-4 space-y-3">
      <!-- FIX 3: Optional chaining is now safe because messages is the data Ref -->
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
      >
        <div class="text-[10px] uppercase font-bold text-[#D17C5A] mb-0.5 ml-1">
          {{ m.playerName }}
        </div>
        <div
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
            ? 'You are dead.'
            : isDisabled
              ? 'Voting in progress...'
              : 'Describe image...'
        "
        class="w-full bg-[#3D3430] text-white px-4 py-3 rounded-xl outline-none focus:ring-2 ring-[#D17C5A] disabled:opacity-50 transition placeholder-gray-500"
      />
    </div>
  </div>
</template>
