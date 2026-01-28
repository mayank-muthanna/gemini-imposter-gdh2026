import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SHAPES = ["Circle", "Triangle", "Square", "Pentagon", "Star", "Diamond"];
const ABSTRACT_IMAGES = [
  "https://i.imgur.com/3q123.jpg", // Replace with real abstract URLs
  "https://i.imgur.com/4r567.jpg",
  "https://i.imgur.com/5t890.jpg",
];

// --- QUERIES ---

export const getGameState = query({
  args: { gameCode: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.gameCode))
      .first();
    if (!game) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    return { game, players };
  },
});

export const getMessages = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    // Join with player names for display
    return await Promise.all(
      msgs.map(async (m) => {
        const p = await ctx.db.get(m.playerId);
        return { ...m, playerName: p?.name || "Unknown", isAi: p?.isAi };
      }),
    );
  },
});

// --- MUTATIONS ---

export const createGame = mutation({
  args: {},
  handler: async (ctx) => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    return await ctx.db.insert("games", { code, status: "waiting", round: 0 });
  },
});

export const joinGame = mutation({
  args: { gameCode: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.gameCode))
      .first();
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting") throw new Error("Game already started");

    const existingPlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    if (existingPlayers.length >= 6) throw new Error("Lobby full");

    const assignedShape = SHAPES[existingPlayers.length];

    await ctx.db.insert("players", {
      gameId: game._id,
      name: assignedShape,
      sessionId: args.sessionId,
      isAi: false,
      isEliminated: false,
      avatar: assignedShape.toLowerCase(),
    });

    return game._id;
  },
});

export const startGame = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    if (players.length < 3) throw new Error("Need 3+ players");

    // 1. Pick AI randomly
    const aiIndex = Math.floor(Math.random() * players.length);
    const aiPlayer = players[aiIndex];
    await ctx.db.patch(aiPlayer._id, { isAi: true });

    // 2. Assign Images (Humans get same image, AI gets nothing)
    const randomImg =
      ABSTRACT_IMAGES[Math.floor(Math.random() * ABSTRACT_IMAGES.length)];
    for (const p of players) {
      if (p._id !== aiPlayer._id) {
        await ctx.db.patch(p._id, { assignedImage: randomImg });
      }
    }

    // 3. Start Timer (30s for first round)
    const endTime = Date.now() + 30 * 1000;
    await ctx.db.patch(args.gameId, {
      status: "playing",
      round: 1,
      roundEndTime: endTime,
    });
  },
});

export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // 1. Get Game by ID directly
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    // 2. Get Players
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    return { game, players };
  },
});

export const sendMessage = mutation({
  args: { gameId: v.id("games"), sessionId: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first();

    if (!player || player.isEliminated) return;

    await ctx.db.insert("messages", {
      gameId: args.gameId,
      playerId: player._id,
      text: args.text,
      timestamp: Date.now(),
    });
  },
});

// Helper for the AI Action to post back
export const postAiMessage = mutation({
  args: { gameId: v.id("games"), text: v.string() },
  handler: async (ctx, args) => {
    const aiPlayer = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("isAi"), true))
      .first();

    if (aiPlayer && !aiPlayer.isEliminated) {
      await ctx.db.insert("messages", {
        gameId: args.gameId,
        playerId: aiPlayer._id,
        text: args.text,
        timestamp: Date.now(),
      });
    }
  },
});
