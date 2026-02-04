import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const SHAPES = [
  "Circle",
  "Triangle",
  "Square",
  "Pentagon",
  "Star",
  "Diamond",
  "Hexagon",
  "Octagon",
];
const ABSTRACT_IMAGES = [
  "https://i.imgur.com/M6r6Z2c.jpeg",
  "https://i.imgur.com/2heE5mO.jpeg",
  "https://i.imgur.com/wt3qGqU.jpeg",
  "https://i.imgur.com/qM9B5dC.jpeg",
];

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- QUERIES ---

export const getGameState = query({
  args: { gameId: v.id("games"), sessionId: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Sort for consistent UI rendering
    players.sort((a, b) => a._id.localeCompare(b._id));

    // Security: Hide identities
    const isServerCall = args.sessionId === "SERVER";
    const isGameEnded = game.status === "ended";

    // Calculate if timer should be hidden (1/3rd time passed)
    // Client can use this logic too, but we send a flag for convenience
    const timeElapsed = Date.now() - (game.startTime || 0);
    const hideTimer =
      game.status === "discussion" &&
      timeElapsed > (game.roundDuration * 1000) / 3;

    const sanitizedPlayers = players.map((p) => ({
      ...p,
      isAi:
        isGameEnded || isServerCall || p.sessionId === args.sessionId
          ? p.isAi
          : false,
      realName:
        isGameEnded || isServerCall || p.sessionId === args.sessionId
          ? p.realName
          : "???",
    }));

    return {
      game: { ...game, hideTimer },
      players: sanitizedPlayers,
      myPlayer: players.find((p) => p.sessionId === args.sessionId),
    };
  },
});

export const getMessages = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("desc") // Newest first
      .take(50);
  },
});

// --- CORE GAME LOOP ---

export const createGame = mutation({
  args: { realName: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const gameId = await ctx.db.insert("games", {
      code,
      status: "waiting",
      round: 0,
      startTime: 0,
      roundDuration: 0,
    });
    await ctx.db.insert("players", {
      gameId,
      sessionId: args.sessionId,
      realName: args.realName,
      shape: "Host", // Placeholder
      isAi: false,
      isEliminated: false,
      hasVoted: false,
    });
    return gameId;
  },
});

export const joinGame = mutation({
  args: { gameCode: v.string(), realName: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.gameCode))
      .first();
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting") throw new Error("Game in progress");

    const existing = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .collect();
    if (existing.length >= 7) throw new Error("Lobby full");

    // Prevent duplicate join
    if (existing.some((p) => p.sessionId === args.sessionId)) return game._id;

    await ctx.db.insert("players", {
      gameId: game._id,
      sessionId: args.sessionId,
      realName: args.realName,
      shape: "Pending",
      isAi: false,
      isEliminated: false,
      hasVoted: false,
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
    // Rule: Min 3 players (Humans) + we will add 1 AI
    if (players.length < 3) throw new Error("Need at least 3 human players");

    // 1. Create Gemini
    const aiId = await ctx.db.insert("players", {
      gameId: args.gameId,
      sessionId: "GEMINI_" + Date.now(),
      realName: "Gemini",
      shape: "Pending",
      isAi: true,
      isEliminated: false,
      hasVoted: false,
    });

    // 2. Assign Initial Shapes
    await assignShapes(ctx, args.gameId);

    // 3. Start First Round
    await startRound(ctx, args.gameId);
  },
});

// Helper: Assign/Shuffle Shapes
async function assignShapes(ctx: any, gameId: any) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();
  const shuffledShapes = shuffleArray([...SHAPES]).slice(0, players.length);

  for (let i = 0; i < players.length; i++) {
    await ctx.db.patch(players[i]._id, { shape: shuffledShapes[i] });
  }
}

// Helper: Start Round with Dynamic Time
// Helper: Start Round with Dynamic Time
async function startRound(ctx: any, gameId: any) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();
  const activePlayers = players.filter((p: any) => !p.isEliminated);

  const aiAlive = activePlayers.some((p: any) => p.isAi);
  const humansAlive = activePlayers.filter((p: any) => !p.isAi).length;

  // --- WIN CONDITIONS ---
  if (!aiAlive) {
    await ctx.db.patch(gameId, { status: "ended", winner: "humans" });
    return;
  }
  if (humansAlive <= 1) {
    await ctx.db.patch(gameId, { status: "ended", winner: "ai" });
    return;
  }

  // --- DYNAMIC DURATION LOGIC ---
  // 6+ players = 30s, 5 = 25s, 4 = 20s, 3 = 15s
  let duration = 15;
  const count = activePlayers.length;
  if (count >= 6) duration = 90;
  else if (count === 5) duration = 90;
  else if (count === 4) duration = 90;
  else if (count === 3) duration = 90;

  const startTime = Date.now();

  // Ensure we pick an image that exists in our AI "Cheat Sheet" mapping
  const image =
    ABSTRACT_IMAGES[Math.floor(Math.random() * ABSTRACT_IMAGES.length)];

  // Reset votes
  for (const p of players) await ctx.db.patch(p._id, { hasVoted: false });

  await ctx.db.patch(gameId, {
    status: "discussion",
    round: (await ctx.db.get(gameId)).round + 1,
    startTime,
    roundDuration: duration,
    image,
    aiProcessing: false, // Unlock AI logic
  });

  // Schedule End of Round
  await ctx.scheduler.runAt(
    startTime + duration * 1000,
    internal.game.transitionToVoting,
    { gameId },
  );

  // --- AI STRATEGY TRIGGER ---
  // We schedule the AI to check the state 3.5 seconds in.
  // In actions.ts, we will have logic: "If 4s passed and nobody spoke, I speak."
  await ctx.scheduler.runAfter(3500, internal.actions.decideAiAction, {
    gameId,
  });
}

export const transitionToVoting = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (game.status !== "discussion") return;

    await ctx.db.patch(args.gameId, { status: "voting" });

    // Schedule AI Vote
    await ctx.scheduler.runAfter(2000, internal.actions.runAiVote, {
      gameId: args.gameId,
    });
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

    // --- 1.5s COOLDOWN LOGIC ---
    const now = Date.now();
    if (player.lastMessageTime && now - player.lastMessageTime < 1500) {
      throw new Error("Cool down! Wait a moment.");
    }
    await ctx.db.patch(player._id, { lastMessageTime: now });

    await ctx.db.insert("messages", {
      gameId: args.gameId,
      playerId: player._id,
      playerName: player.shape,
      text: args.text,
      timestamp: now,
      isAi: false,
    });

    // --- AI REACTION LOGIC ---
    const game = await ctx.db.get(args.gameId);

    // Only trigger if discussion is active and AI isn't currently generating
    if (game.status === "discussion" && !game.aiProcessing) {
      // Calculate "Reading Time"
      // Base delay 1.5s + 50ms per character.
      // e.g., "sus" (3 chars) = ~1.6s delay
      // e.g., "I think it is red and blue" (28 chars) = ~2.9s delay
      let responseDelay = 1500 + args.text.length * 50;

      // Cap the delay at 4.5s so it doesn't miss the round end
      responseDelay = Math.min(responseDelay, 4500);

      await ctx.scheduler.runAfter(
        responseDelay,
        internal.actions.decideAiAction,
        { gameId: args.gameId },
      );
    }
  },
});

// Used by AI Action to post message safely
export const postAiMessage = internalMutation({
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
        playerName: aiPlayer.shape,
        text: args.text,
        timestamp: Date.now(),
        isAi: true,
      });
      // Unlock processing flag so AI can speak again later
      await ctx.db.patch(args.gameId, { aiProcessing: false });
    }
  },
});

// --- VOTING & RESOLUTION ---

export const castVote = mutation({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
    targetId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first();

    if (!player || player.hasVoted || player.isEliminated) return;

    const game = await ctx.db.get(args.gameId);
    if (game.status !== "voting") return;

    await ctx.db.insert("votes", {
      gameId: args.gameId,
      round: game.round,
      voterId: player._id,
      targetId: args.targetId,
    });
    await ctx.db.patch(player._id, { hasVoted: true });

    // Check if everyone voted
    const activePlayers = (
      await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
        .collect()
    ).filter((p) => !p.isEliminated);

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_game_round", (q) =>
        q.eq("gameId", args.gameId).eq("round", game.round),
      )
      .collect();

    if (votes.length >= activePlayers.length) {
      await resolveVotes(ctx, args.gameId);
    }
  },
});

async function resolveVotes(ctx: any, gameId: any) {
  const game = await ctx.db.get(gameId);
  const votes = await ctx.db
    .query("votes")
    .withIndex("by_game_round", (q) =>
      q.eq("gameId", gameId).eq("round", game.round),
    )
    .collect();

  const tally: Record<string, number> = {};
  votes.forEach((v) => (tally[v.targetId] = (tally[v.targetId] || 0) + 1));

  let maxVotes = 0;
  let candidate = null;

  // Find player with most votes
  for (const [pid, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
      candidate = pid;
    } else if (count === maxVotes) {
      candidate = null; // Tie
    }
  }

  if (candidate) {
    await ctx.db.patch(candidate as any, { isEliminated: true });
    await ctx.db.insert("messages", {
      gameId,
      playerId: candidate as any,
      playerName: "SYSTEM",
      text: "Was eliminated.",
      timestamp: Date.now(),
      isAi: false,
    });
  } else {
    await ctx.db.insert("messages", {
      gameId,
      playerId: votes[0].voterId, // Hack to get ID, system uses name anyway
      playerName: "SYSTEM",
      text: "Tie vote. No one eliminated.",
      timestamp: Date.now(),
      isAi: false,
    });
  }

  // --- 50-50 SHAPE SWITCH LOGIC ---
  if (Math.random() > 0.5) {
    await assignShapes(ctx, gameId);
    await ctx.db.insert("messages", {
      gameId,
      playerId: votes[0].voterId,
      playerName: "SYSTEM",
      text: "⚠️ ALERT: All shapes have been swapped!",
      timestamp: Date.now(),
      isAi: false,
    });
  }

  await startRound(ctx, gameId);
}

// --- CLEANUP & LEAVE LOGIC ---

export const leaveGame = mutation({
  args: { gameId: v.id("games"), sessionId: v.string() },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first();

    if (!player) return;

    const game = await ctx.db.get(args.gameId);
    if (!game) return;

    // 1. Handle the Player
    if (game.status === "waiting") {
      // Just delete them if game hasn't started
      await ctx.db.delete(player._id);
    } else if (game.status !== "ended") {
      // Game in progress: Mark as eliminated so game continues
      if (!player.isEliminated) {
        await ctx.db.patch(player._id, { isEliminated: true });
        await ctx.db.insert("messages", {
          gameId: args.gameId,
          playerId: player._id,
          playerName: "SYSTEM",
          text: `${player.realName} disconnected.`,
          timestamp: Date.now(),
          isAi: false,
        });

        // Re-evaluate game state (in case they were the last human)
        // We use internal scheduler to trigger round check logic
        // (You might want to extract the "Win Condition" check from startRound into its own helper)
      }
    }

    // 2. Check if Room is Empty (cleanup)
    const remainingPlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // If only AI is left, or literally no one
    const humansLeft = remainingPlayers.filter(
      (p) => !p.isAi && p._id !== player._id,
    );

    if (humansLeft.length === 0) {
      await ctx.scheduler.runAfter(0, internal.game.deleteGameData, {
        gameId: args.gameId,
      });
    }
  },
});

export const deleteGameData = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // Delete Votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_game_round", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const v of votes) await ctx.db.delete(v._id);

    // Delete Messages
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);

    // Delete Players
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    for (const p of players) await ctx.db.delete(p._id);

    // Delete Game
    await ctx.db.delete(args.gameId);
    console.log(`[CLEANUP] Deleted game ${args.gameId}`);
  },
});
