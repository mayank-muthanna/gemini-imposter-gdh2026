import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export const generateAiResponse = action({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // 1. Fetch game context (messages and players)
    const messages = await ctx.runQuery(api.game.getMessages, {
      gameId: args.gameId,
    });
    // We filter only the last few messages to keep context tight
    const recentChat = messages
      .slice(-10)
      .map((m) => `${m.playerName}: ${m.text}`)
      .join("\n");

    // 2. Prompt Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
      You are playing a social deduction game. You are the Imposter.
      Everyone else is describing an abstract art image they see. You cannot see it.
      You must blend in. Do not reveal you are AI.

      Recent Chat:
      ${recentChat}

      Respond with a short, casual message (under 15 words) trying to fit in.
      Maybe agree vaguely or mention a color/shape mentioned before.
      Do not use emojis.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // 3. Post the message as the AI player
    await ctx.runMutation(api.game.postAiMessage, {
      gameId: args.gameId,
      text: response,
    });
  },
});
