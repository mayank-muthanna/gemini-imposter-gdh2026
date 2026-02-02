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
const ABSTRACT_IMAGES = ["https://picsum.photos/200/300"];

function getRoundDuration(playerCount: number) {
  if (playerCount >= 6) return 30;
  if (playerCount === 5) return 25;
  if (playerCount === 4) return 20;
  return 15;
}

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

    // Sort to keep order stable
    players.sort((a, b) => a._id.localeCompare(b._id));

    const myPlayer = players.find((p) => p.sessionId === args.sessionId);

    // Hide AI identity from others unless game ended or it's you
    const sanitizedPlayers = players.map((p) => ({
      ...p,
      isAi:
        game.status === "ended"
          ? p.isAi
          : p.sessionId === args.sessionId
            ? p.isAi
            : undefined,
      realName:
        game.status === "ended" || p.sessionId === args.sessionId
          ? p.realName
          : "???",
    }));

    return { game, players: sanitizedPlayers, myPlayer };
  },
});

export const getMessages = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(50);
  },
});

// --- MUTATIONS ---

// UPDATED: Create Game now also joins the host immediately
export const createGame = mutation({
  args: { realName: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();

    const gameId = await ctx.db.insert("games", {
      code,
      status: "waiting",
      round: 0,
    });

    // Automatically Add Host
    await ctx.db.insert("players", {
      gameId: gameId,
      sessionId: args.sessionId,
      realName: args.realName,
      shape: "Pending",
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
    if (existing.length >= 8) throw new Error("Lobby full");

    const existingPlayer = existing.find((p) => p.sessionId === args.sessionId);
    if (existingPlayer) return game._id;

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
    if (players.length < 3) throw new Error("Need 3+ players");

    // 1. Assign AI
    const aiIndex = Math.floor(Math.random() * players.length);
    const aiPlayer = players[aiIndex];
    await ctx.db.patch(aiPlayer._id, { isAi: true });

    // 2. Assign Shapes
    const shuffledShapes = shuffleArray([...SHAPES]).slice(0, players.length);
    for (let i = 0; i < players.length; i++) {
      await ctx.db.patch(players[i]._id, { shape: shuffledShapes[i] });
    }

    // 3. Start Round 1
    await startRound(ctx, args.gameId);
  },
});

// --- NEW WRAPPERS FOR AI (To avoid useConvexAction on client) ---

export const triggerAiTurn = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    // Schedule the action to run immediately
    await ctx.scheduler.runAfter(0, internal.actions.runAiTurn, {
      gameId: args.gameId,
    });
  },
});

export const triggerAiVote = mutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.actions.runAiVote, {
      gameId: args.gameId,
    });
  },
});

// --- INTERNAL HELPERS ---

async function startRound(ctx: any, gameId: any) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_game", (q) => q.eq("gameId", gameId))
    .collect();
  const activePlayers = players.filter((p: any) => !p.isEliminated);

  const aiAlive = activePlayers.some((p: any) => p.isAi);
  const humansAlive = activePlayers.filter((p: any) => !p.isAi).length;

  if (!aiAlive) {
    await ctx.db.patch(gameId, { status: "ended", winner: "humans" });
    return;
  }
  if (humansAlive <= 1) {
    await ctx.db.patch(gameId, { status: "ended", winner: "ai" });
    return;
  }

  const duration = getRoundDuration(activePlayers.length);
  const startTime = Date.now();
  const endTime = startTime + duration * 1000;

  const randomImg =
    ABSTRACT_IMAGES[Math.floor(Math.random() * ABSTRACT_IMAGES.length)];

  for (const p of players) {
    await ctx.db.patch(p._id, { hasVoted: false });
  }

  await ctx.db.patch(gameId, {
    status: "discussion",
    image: randomImg,
    startTime,
    endTime,
    round: (await ctx.db.get(gameId)).round + 1,
  });

  await ctx.scheduler.runAt(endTime, internal.game.transitionToVoting, {
    gameId,
  });
}

export const transitionToVoting = internalMutation({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (game.status !== "discussion") return;
    await ctx.db.patch(args.gameId, { status: "voting", endTime: undefined });
  },
});

// Fixed async await issue here
export const castVote = mutation({
  args: {
    gameId: v.id("games"),
    sessionId: v.string(),
    targetId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    const player = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first();

    if (!player || player.isEliminated || player.hasVoted) return;

    // Use game.round (number) not await
    await ctx.db.insert("votes", {
      gameId: args.gameId,
      round: game.round,
      voterId: player._id,
      targetId: args.targetId,
    });

    await ctx.db.patch(player._id, { hasVoted: true });

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
    const activePlayers = players.filter((p) => !p.isEliminated);

    // Use game.round (number)
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
  votes.forEach((v) => {
    tally[v.targetId] = (tally[v.targetId] || 0) + 1;
  });

  let maxVotes = 0;
  let candidate = null;
  let tie = false;

  for (const [pid, count] of Object.entries(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
      candidate = pid;
      tie = false;
    } else if (count === maxVotes) {
      tie = true;
    }
  }

  if (candidate && !tie) {
    await ctx.db.patch(candidate as any, { isEliminated: true });
  }

  if (Math.random() > 0.5) {
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .collect();
    const activeShapes = players.map((p) => p.shape);
    const shuffledShapes = shuffleArray([...activeShapes]);

    for (let i = 0; i < players.length; i++) {
      await ctx.db.patch(players[i]._id, { shape: shuffledShapes[i] });
    }

    await ctx.db.insert("messages", {
      gameId,
      playerId: players[0]._id,
      playerName: "SYSTEM",
      text: "⚠️ SHAPES HAVE BEEN SHUFFLED!",
      timestamp: Date.now(),
      isAi: false,
    });
  }

  await startRound(ctx, gameId);
}

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
      playerName: player.shape,
      text: args.text,
      timestamp: Date.now(),
      isAi: player.isAi,
    });
  },
});
