import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemma-3-12b-it" }); // Use standard pro model for speed/consistency

export const decideAiAction = action({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // 1. Get Game State
    const { game, players } = await ctx.runQuery(api.game.getGameState, {
      gameId: args.gameId,
      sessionId: "SERVER",
    });

    if (!game || game.status !== "discussion") return;

    // 2. Timing Check
    const timeLeft = game.startTime! + game.roundDuration! * 1000 - Date.now();

    // Don't start typing if round is basically over (< 3 sec)
    if (timeLeft < 3000) return;

    const aiPlayer = players.find((p) => p.isAi && !p.isEliminated);
    if (!aiPlayer) return;

    // 3. Get Chat History
    const messages = await ctx.runQuery(api.game.getMessages, {
      gameId: args.gameId,
    });

    // 4. Decision Logic: Should I speak?
    // We filter out system messages for the AI context
    const recentHumanMsgs = messages
      .filter((m) => !m.isAi && m.playerName !== "SYSTEM")
      .slice(0, 5);
    const lastMsg = messages[0];

    // If AI was the very last person to speak, don't speak again immediately (prevent solo spam)
    if (lastMsg?.isAi) return;

    // Detect Accusation
    const myShape = aiPlayer.shape.toLowerCase();
    const isAccused = recentHumanMsgs.some((m) =>
      m.text.toLowerCase().includes(myShape),
    );

    // If not accused, and plenty of people are talking, chance to stay silent
    if (!isAccused && Math.random() > 0.7) {
      return;
    }

    // 5. Construct Prompt
    const chatLog = messages
      .slice(0, 10)
      .reverse()
      .map((m) => `${m.playerName}: ${m.text}`)
      .join("\n");

    const prompt = `
    Context: You are playing a social deduction game. You are the Impostor.
    Your Identity: ${aiPlayer.shape}.
    Current Phase: Discussion (Abstract Art interpretation).
    You CANNOT see the art. You must bluff.

    Time Remaining: ${Math.floor(timeLeft / 1000)} seconds.

    Chat History:
    ${chatLog}

    Instructions:
    1. If you are accused, defend yourself casually.
    2. If not, make a vague comment about "colors" or "shapes" to blend in.
    3. MAX 6 words.
    4. Lowercase only. No punctuation.
    5. Do not use words like "agree", "same", "bot", "ai".

    Response:
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response
        .text()
        .toLowerCase()
        .replace(/["'.,!?]/g, "") // Remove punctuation
        .trim();

      if (response) {
        await ctx.runMutation(internal.game.postAiMessage, {
          gameId: args.gameId,
          text: response,
        });
      }
    } catch (e) {
      console.error("AI Error", e);
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
    if (!aiPlayer) return;

    const humans = players.filter((p) => !p.isAi && !p.isEliminated);
    if (humans.length === 0) return;

    // Simple Logic: Vote Randomly among humans to create chaos
    // (Or you can implement the "Vote for accuser" logic here)
    const target = humans[Math.floor(Math.random() * humans.length)];

    await ctx.runMutation(api.game.castVote, {
      gameId: args.gameId,
      sessionId: aiPlayer.sessionId, // AI uses its session ID
      targetId: target._id,
    });
  },
});
