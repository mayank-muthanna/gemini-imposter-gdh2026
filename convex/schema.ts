import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    code: v.string(), // Private room code
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished"),
    ),
    round: v.number(),
    roundEndTime: v.optional(v.number()), // Unix timestamp for timer
    winner: v.optional(v.string()), // "ai" or "humans"
  }).index("by_code", ["code"]),

  players: defineTable({
    gameId: v.id("games"),
    name: v.string(), // The visible shape name (e.g., "Triangle")
    sessionId: v.string(), // To identify the user locally
    isAi: v.boolean(),
    isEliminated: v.boolean(),
    assignedImage: v.optional(v.string()), // URL to the abstract image
    avatar: v.string(), // "triangle", "circle", etc.
  }).index("by_game", ["gameId"]),

  messages: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"), // Who sent it
    text: v.string(),
    timestamp: v.number(),
  }).index("by_game", ["gameId"]),

  votes: defineTable({
    gameId: v.id("games"),
    round: v.number(),
    voterId: v.id("players"),
    voteForId: v.id("players"),
  }).index("by_game_round", ["gameId", "round"]),
});
