<script setup lang="ts">
import { ref } from "vue";
import { api } from "../convex/_generated/api";

const { data: tasks } = useConvexQuery(api.tasks.get);
const createTask = useConvexMutation(api.tasks.create);
const removeTask = useConvexMutation(api.tasks.remove);

const newTask = ref("");

const submit = async () => {
  if (!newTask.value.trim()) return;
  await createTask.mutate({ text: newTask.value });
  newTask.value = "";
};
</script>

<template>
  <div class="min-h-screen bg-[#FFF4EE] relative overflow-hidden">
    <!-- dotted grid -->
    <div
      class="absolute inset-0 pointer-events-none opacity-30"
      style="
        background-image: radial-gradient(#e6b8a2 1px, transparent 1px);
        background-size: 20px 20px;
      "
    ></div>

    <header class="relative z-10 px-6 py-5 border-b border-[#f0cdbb]">
      <div class="max-w-4xl mx-auto flex justify-between">
        <h1 class="text-2xl font-semibold text-[#5a2d1a]">Peach Tasks</h1>
        <span class="text-sm text-[#8a4b32]">Shared • Live</span>
      </div>
    </header>

    <main class="relative z-10 max-w-4xl mx-auto px-6 py-10">
      <!-- input -->
      <div class="mb-6 flex gap-3">
        <input
          v-model="newTask"
          @keydown.enter="submit"
          placeholder="Add a task…"
          class="flex-1 rounded-xl border border-[#f0cdbb] px-4 py-3 bg-[#FFF4EE]"
        />
        <button
          @click="submit"
          class="px-5 rounded-xl bg-[#d17c5a] text-white"
        >
          Add
        </button>
      </div>

      <!-- tasks -->
      <div class="bg-[#FFE7DC] border rounded-2xl p-6">
        <ul class="space-y-3">
          <li
            v-for="task in tasks"
            :key="task._id"
            class="flex justify-between items-center bg-[#FFF4EE] px-4 py-3 rounded-xl"
          >
            <span class="text-[#5a2d1a]">{{ task.text }}</span>

            <button
              @click="removeTask.mutate({ id: task._id })"
              class="text-sm text-[#b96547]"
            >
              Delete
            </button>
          </li>

          <li v-if="!tasks?.length" class="italic text-sm text-[#8a4b32]">
            No tasks yet.
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>
