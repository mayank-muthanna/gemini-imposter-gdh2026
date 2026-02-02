import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export const runAiTurn = action({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // 1. Fetch State
    const { game, players } = await ctx.runQuery(api.game.getGameState, {
      gameId: args.gameId,
      sessionId: "SERVER",
    });
    if (!game || game.status !== "discussion") return;

    // 2. Identify AI Player
    const aiPlayer = players.find((p) => p.isAi && !p.isEliminated);
    if (!aiPlayer) return;

    // 3. Decide to chat (Random chance)
    if (Math.random() > 0.7) {
      const messages = await ctx.runQuery(api.game.getMessages, {
        gameId: args.gameId,
      });
      const context = messages
        .map((m) => `${m.playerName}: ${m.text}`)
        .reverse()
        .join("\n");

      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const prompt = `
        You are playing a game. You are ${aiPlayer.shape}. You are the Imposter.
        Others see an image. You do not.
        Goal: Blend in. Agree vaguely. Keep it under 10 words. Lowercase. No punctuation.
        Context:
        ${context}
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      await ctx.runMutation(api.game.sendMessage, {
        gameId: args.gameId,
        sessionId: aiPlayer.sessionId,
        text: text,
      });
    }
  },
});

export const runAiVote = action({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const { game, players } = await ctx.runQuery(api.game.getGameState, {
      gameId: args.gameId,
      sessionId: "SERVER",
    });
    if (game.status !== "voting") return;

    const aiPlayer = players.find((p) => p.isAi && !p.isEliminated);
    if (!aiPlayer || aiPlayer.hasVoted) return;

    // Pick a random human target
    const humans = players.filter((p) => !p.isAi && !p.isEliminated);
    if (humans.length === 0) return;
    const target = humans[Math.floor(Math.random() * humans.length)];

    await ctx.runMutation(api.game.castVote, {
      gameId: args.gameId,
      sessionId: aiPlayer.sessionId,
      targetId: target._id,
    });
  },
});
