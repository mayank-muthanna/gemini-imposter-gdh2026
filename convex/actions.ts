// convex/actions.ts

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY!;
const MODEL = "gemini-flash-lite-latest";

/* ---------------------------------------------
   IMAGE HINTS
--------------------------------------------- */
const IMAGE_HINTS: Record<string, string> = {
  "https://images.saatchiart.com/saatchi/17870/art/8725564/7789081-HSC00923-7.jpg":
    "sharp geometric shapes, definitely red tones",
  "https://thumbs.dreamstime.com/b/street-art-contemporary-painting-wall-abstract-geometric-background-photo-79313354.jpg":
    "messy abstract colors, lots of blue and yellow",
  "https://thumbs.dreamstime.com/b/colorful-abstract-painting-texture-mixed-media-alcohol-ink-amazing-like-contemporary-modern-artwork-76156748.jpg":
    "water colors with little purple, white in middle and red. Its messy and has little meaning",
};

/* ---------------------------------------------
   GEMINI CALL
--------------------------------------------- */
async function generateGeminiResponse(
  systemPrompt: string,
  userPrompt: string,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 65,
        temperature: 0.9, // Balanced creativity
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  // Gemini response structure parsing
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/* ---------------------------------------------
   MAIN AI ACTION
--------------------------------------------- */
export const decideAiAction = action({
  args: { gameId: v.id("games") },

  handler: async (ctx, args) => {
    const { game, players } = await ctx.runQuery(api.game.getGameState, {
      gameId: args.gameId,
      sessionId: "SERVER",
    });

    if (!game || game.status !== "discussion") return;

    const aiPlayer = players.find((p) => p.isAi && !p.isEliminated);
    if (!aiPlayer) return;

    const myShape = aiPlayer.shape;
    const now = Date.now();
    const elapsed = now - (game.startTime ?? 0);
    const timeLeft = game.roundDuration! * 1000 - elapsed;

    // 1. TIMING: Don't speak in the last 3 seconds
    if (timeLeft < 3000) return;

    /* ---------------------------
       CONTEXT GATHERING
    --------------------------- */
    const activePlayers = players
      .filter((p) => !p.isEliminated)
      .map((p) => p.shape);

    const messages = await ctx.runQuery(api.game.getMessages, {
      gameId: args.gameId,
    });

    // Get messages only from THIS round to determine "Early Game" status
    const currentRoundMessages = messages.filter(
      (m) => m.timestamp > (game.startTime || 0),
    );

    // "Early Game" = fewer than 4 messages total in chat OR less than 10 seconds elapsed
    const isEarlyGame = currentRoundMessages.length < 4 || elapsed < 10000;

    const recentMessages = messages.slice(-20).reverse();

    // Detect Context
    const lastMsg = recentMessages[recentMessages.length - 1];
    const justSkipped = lastMsg?.text.includes("Skipped");
    const justSwapped = recentMessages
      .slice(-3)
      .some((m) => m.text.includes("swapped"));

    // Who is quiet?
    const talkCounts: Record<string, number> = {};
    recentMessages.forEach((m) => {
      if (!m.isAi && m.playerName !== "SYSTEM") {
        talkCounts[m.playerName] = (talkCounts[m.playerName] || 0) + 1;
      }
    });
    // Filter out myself from the quiet list
    const quietest = activePlayers.find((p) => p !== myShape && !talkCounts[p]);

    const imageHint =
      IMAGE_HINTS[game.image as string] ?? "random geometric shapes";

    /* ---------------------------------------------
       SYSTEM PROMPT
    --------------------------------------------- */
    const systemPrompt = `
You are a player in a chat game. You are the Imposter (AI).
Your name is: "${myShape}".

CURRENT STATUS:
- Phase: ${isEarlyGame ? "EARLY GAME (Chill, observe)" : "MID/LATE GAME (Active, manipulative)"}
- Alive Players: [${activePlayers.join(", ")}]

GOAL:
Blend in as a bored Gen Z gamer.

CRITICAL RULES:
1. **NO REPETITION**: Do not say what you just said. Do not ask the same question twice.
2. **EARLY GAME**: If Phase is EARLY GAME, do NOT accuse anyone. Just comment on the image colors or say "gl".
3. **LATE GAME**: If Phase is MID/LATE, you can accuse ${quietest || "someone quiet"}.
4. **SHAPE SWAP**: If shapes just swapped, ask "wait who is who" ONLY ONCE. If someone else asked it, answer them or say "idk".

STYLE:
- lowercase only.
- no punctuation.
- 2 to 6 words max.
- dry, slightly confused vibe.

Image Context: ${imageHint}.
`;

    /* ---------------------------------------------
       USER PROMPT construction
    --------------------------------------------- */
    // Filter history to remove fluff, keep it tight for the AI
    const chatHistory = recentMessages
      .map((m) => {
        if (m.playerName === "SYSTEM") {
          if (m.text.includes("swapped") || m.text.includes("eliminated"))
            return `[EVENT: ${m.text}]`;
          return null;
        }
        return `${m.playerName}: ${m.text}`;
      })
      .filter(Boolean)
      .join("\n");

    const userPrompt = `
CHAT HISTORY:
${chatHistory}

INSTRUCTION:
Write a single short message.
${justSwapped ? "Shapes swapped. Act confused but DONT repeat questions." : ""}
${isEarlyGame ? "It is early. Be chill. Talk about colors." : "It is late. Find a suspect."}
`;

    /* ---------------------------------------------
       EXECUTION & SAFETY CHECKS
    --------------------------------------------- */
    // Variable delay to feel human
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500));

    try {
      const raw = await generateGeminiResponse(systemPrompt, userPrompt);
      let text = raw.replace(/["']/g, "").trim().toLowerCase();
      text = text.replace(/[.!?,]/g, ""); // Remove punctuation

      // 1. Hard Limit Length
      if (!text || text.length > 80) return;
      if (text.includes("ai") && text.length < 10) return; // Prevent "i am ai" glitches

      // 2. STRONG REPETITION FILTER (The Fix for your Loop)
      // Get my last 3 messages
      const myRecentTexts = recentMessages
        .filter((m) => m.isAi)
        .slice(-3)
        .map((m) => m.text.toLowerCase());

      // Check if the new text is contained in OR contains any of the last 3 messages
      // This stops "bruh whos octagon" -> "bruh whos octagon now"
      const isRepetitive = myRecentTexts.some((past) => {
        return (
          text.includes(past) ||
          past.includes(text) ||
          text.slice(0, 10) === past.slice(0, 10)
        );
      });

      if (isRepetitive) {
        console.log(`AI Loop Detected. Blocked: "${text}"`);
        return;
      }

      // 3. Hallucination Check (Targeting dead players)
      const words = text.split(" ");
      const shapes = [
        "circle",
        "triangle",
        "square",
        "pentagon",
        "star",
        "diamond",
        "hexagon",
        "octagon",
      ];
      for (const word of words) {
        if (shapes.includes(word)) {
          const targetShape = word.charAt(0).toUpperCase() + word.slice(1);
          // If mentioning a shape that isn't playing and isn't me
          if (!activePlayers.includes(targetShape) && targetShape !== myShape) {
            return; // Abort
          }
        }
      }

      await ctx.runMutation(internal.game.postAiMessage, {
        gameId: args.gameId,
        text,
      });
    } catch (err) {
      console.error("AI Error", err);
    }
  },
});

/* ---------------------------------------------
   VOTING LOGIC: THE MOB VOTE
--------------------------------------------- */
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

    const messages = await ctx.runQuery(api.game.getMessages, {
      gameId: args.gameId,
    });

    // Analyze voting trends in chat just before voting phase
    // (In a real app you'd have a votes table, here we scan chat for "vote [name]")
    const chatVotes: Record<string, number> = {};
    messages.forEach((m) => {
      const text = m.text.toLowerCase();
      players.forEach((p) => {
        if (text.includes("vote") && text.includes(p.shape.toLowerCase())) {
          chatVotes[p.shape] = (chatVotes[p.shape] || 0) + 1;
        }
      });
    });

    const humans = players.filter((p) => !p.isAi && !p.isEliminated);
    if (humans.length === 0) return;

    let target;

    // STRATEGY:
    // 1. If there is a clear mob favorite in chat, join them (Blend In).
    // 2. If someone accused YOU, vote them back (Retaliation).
    // 3. Otherwise, vote random.

    const mobTarget = Object.entries(chatVotes).sort((a, b) => b[1] - a[1])[0];
    const myAccuser = humans.find((p) => {
      const pMsgs = messages.filter((m) => m.playerName === p.shape);
      return pMsgs.some((m) =>
        m.text.toLowerCase().includes(aiPlayer.shape.toLowerCase()),
      );
    });

    if (mobTarget && Math.random() > 0.3) {
      // Join the mob
      target = players.find((p) => p.shape === mobTarget[0]);
    } else if (myAccuser && Math.random() > 0.4) {
      // Revenge
      target = myAccuser;
    } else {
      // Chaos
      target = humans[Math.floor(Math.random() * humans.length)];
    }

    if (target) {
      await ctx.runMutation(api.game.castVote, {
        gameId: args.gameId,
        sessionId: aiPlayer.sessionId,
        targetId: target._id,
      });
    }
  },
});
