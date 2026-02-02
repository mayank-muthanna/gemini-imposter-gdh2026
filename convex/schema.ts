import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    code: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("discussion"),
      v.literal("voting"),
      v.literal("ended"),
    ),
    round: v.number(),
    startTime: v.optional(v.number()), // When current phase started
    endTime: v.optional(v.number()), // When current phase ends
    winner: v.optional(v.union(v.literal("ai"), v.literal("humans"))),
    image: v.optional(v.string()), // The abstract image for the round
  }).index("by_code", ["code"]),

  players: defineTable({
    gameId: v.id("games"),
    realName: v.string(), // User's inputted name (e.g., "Mayank")
    shape: v.string(), // Current visible mask (e.g., "Triangle")
    sessionId: v.string(), // LocalStorage ID
    isAi: v.boolean(),
    isEliminated: v.boolean(),
    hasVoted: v.boolean(), // Reset every round
  }).index("by_game", ["gameId"]),

  messages: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    playerName: v.string(), // Snapshot of shape name at time of sending
    text: v.string(),
    timestamp: v.number(),
    isAi: v.boolean(),
  }).index("by_game", ["gameId"]),

  votes: defineTable({
    gameId: v.id("games"),
    round: v.number(),
    voterId: v.id("players"),
    targetId: v.id("players"),
  }).index("by_game_round", ["gameId", "round"]),
});
