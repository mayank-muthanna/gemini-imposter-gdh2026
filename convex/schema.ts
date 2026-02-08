import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    code: v.string(),
    status: v.string(), // "waiting", "discussion", "voting", "ended"
    round: v.number(),
    startTime: v.number(), // Required for timer math
    roundDuration: v.number(), // Store how long this specific round is
    winner: v.optional(v.string()),
    image: v.optional(v.string()),
    // Mechanism to prevent AI overlapping
    aiProcessing: v.optional(v.boolean()),
  }).index("by_code", ["code"]),

  players: defineTable({
    gameId: v.id("games"),
    realName: v.string(),
    shape: v.string(),
    sessionId: v.string(),
    isAi: v.boolean(),
    isEliminated: v.boolean(),
    hasVoted: v.boolean(),
    // For the 1.5s cooldown
    lastMessageTime: v.optional(v.number()),
  }).index("by_game", ["gameId"]),

  messages: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    playerName: v.string(),
    text: v.string(),
    timestamp: v.number(),
    isAi: v.boolean(),
  }).index("by_game", ["gameId"]),

  votes: defineTable({
    gameId: v.id("games"),
    round: v.number(),
    voterId: v.id("players"),
    targetId: v.optional(v.id("players")),
  }).index("by_game_round", ["gameId", "round"]),
});
