import prisma from '../config/database';
import { Server, Socket } from 'socket.io';

// ============================================================
// RACE MANAGER — Handles matchmaking, race lifecycle, ghosts
// ============================================================

interface QueuePlayer {
  socketId: string;
  userId: string | null;
  username: string;
  avgWpm: number;
}

interface ActiveRace {
  id: string;
  dbId?: string;
  text: string;
  status: 'WAITING' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
  type: 'PUBLIC' | 'PRIVATE';
  code?: string;
  players: Map<string, RacePlayerState>;
  createdAt: number;
  startedAt?: number;
  countdownTimer?: NodeJS.Timeout;
  matchmakingTimer?: NodeJS.Timeout;
}

interface RacePlayerState {
  socketId: string;
  userId: string | null;
  username: string;
  isGhost: boolean;
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  finishTime?: number;
  ghostInterval?: NodeJS.Timeout;
}

const MATCHMAKING_WAIT = 8000; // 8 seconds
const COUNTDOWN_DURATION = 5; // 5 seconds
const MAX_PLAYERS = 5;
const MIN_PLAYERS_TO_START = 2; // including ghosts

// Bot name prefixes
const BOT_PREFIXES = ['Swift', 'Pro', 'Speed', 'Key', 'Flash', 'Turbo', 'Quick', 'Rapid', 'Fast', 'Ultra'];

class RaceManager {
  private io: Server;
  private matchmakingQueue: QueuePlayer[] = [];
  private activeRaces: Map<string, ActiveRace> = new Map();
  private raceCounter = 0;

  constructor(io: Server) {
    this.io = io;
  }

  // === MATCHMAKING ===

  async joinQueue(socket: Socket, data: { userId?: string; username: string; avgWpm?: number }) {
    // Remove from queue if already there
    this.leaveQueue(socket.id);

    const player: QueuePlayer = {
      socketId: socket.id,
      userId: data.userId || null,
      username: data.username || 'Guest',
      avgWpm: data.avgWpm || 50,
    };

    this.matchmakingQueue.push(player);
    socket.emit('race:queue-status', { position: this.matchmakingQueue.length, waiting: this.matchmakingQueue.length });

    // Check if we have enough players
    if (this.matchmakingQueue.length >= MAX_PLAYERS) {
      await this.createPublicRace();
    } else if (this.matchmakingQueue.length === 1) {
      // Start matchmaking timer — after 8s, start with available + ghosts
      setTimeout(async () => {
        if (this.matchmakingQueue.length > 0) {
          await this.createPublicRace();
        }
      }, MATCHMAKING_WAIT);
    }

    // Broadcast queue update to all waiting players
    this.matchmakingQueue.forEach(p => {
      this.io.to(p.socketId).emit('race:queue-status', {
        position: this.matchmakingQueue.indexOf(p) + 1,
        waiting: this.matchmakingQueue.length,
      });
    });
  }

  leaveQueue(socketId: string) {
    this.matchmakingQueue = this.matchmakingQueue.filter(p => p.socketId !== socketId);
  }

  // === CREATE RACES ===

  private async createPublicRace() {
    const players = this.matchmakingQueue.splice(0, MAX_PLAYERS);
    if (players.length === 0) return;

    const raceId = `race_${++this.raceCounter}_${Date.now()}`;
    const quoteText = await this.getRandomQuote();

    const race: ActiveRace = {
      id: raceId,
      text: quoteText,
      status: 'WAITING',
      type: 'PUBLIC',
      players: new Map(),
      createdAt: Date.now(),
    };

    // Add real players
    for (const p of players) {
      race.players.set(p.socketId, {
        socketId: p.socketId,
        userId: p.userId,
        username: p.username,
        isGhost: false,
        progress: 0, wpm: 0, accuracy: 100,
        finished: false,
      });
    }

    // Fill with ghosts if less than MIN_PLAYERS
    const avgWpm = players.reduce((s, p) => s + p.avgWpm, 0) / players.length;
    const ghostCount = Math.max(0, MIN_PLAYERS_TO_START + Math.floor(Math.random() * 3) - players.length);
    if (ghostCount > 0) {
      await this.addGhosts(race, ghostCount, avgWpm);
    }

    this.activeRaces.set(raceId, race);

    // Save to DB
    try {
      const dbRace = await prisma.race.create({
        data: {
          type: 'PUBLIC', status: 'WAITING', quoteText,
          maxPlayers: MAX_PLAYERS,
        },
      });
      race.dbId = dbRace.id;
    } catch (e) { console.error('DB race create error:', e); }

    // Join all players to socket room
    for (const [sid] of race.players) {
      const socket = this.io.sockets.sockets.get(sid);
      if (socket) socket.join(raceId);
    }

    // Emit race found
    this.emitRaceState(raceId);

    // Start countdown after brief delay
    setTimeout(() => this.startCountdown(raceId), 1500);
  }

  async createPrivateRace(socket: Socket, data: { userId?: string; username: string }) {
    const code = this.generateRoomCode();
    const raceId = `private_${code}_${Date.now()}`;
    const quoteText = await this.getRandomQuote();

    const race: ActiveRace = {
      id: raceId,
      text: quoteText,
      status: 'WAITING',
      type: 'PRIVATE',
      code,
      players: new Map(),
      createdAt: Date.now(),
    };

    race.players.set(socket.id, {
      socketId: socket.id,
      userId: data.userId || null,
      username: data.username || 'Host',
      isGhost: false,
      progress: 0, wpm: 0, accuracy: 100,
      finished: false,
    });

    this.activeRaces.set(raceId, race);
    socket.join(raceId);

    // Save to DB
    try {
      const dbRace = await prisma.race.create({
        data: { code, type: 'PRIVATE', status: 'WAITING', quoteText, maxPlayers: MAX_PLAYERS },
      });
      race.dbId = dbRace.id;
    } catch (e) { console.error('DB private race create error:', e); }

    socket.emit('race:private-created', { raceId, code, text: quoteText });
    this.emitRaceState(raceId);
  }

  async joinPrivateRace(socket: Socket, data: { code: string; userId?: string; username: string }) {
    const race = Array.from(this.activeRaces.values()).find(r => r.code === data.code && r.status === 'WAITING');
    if (!race) {
      socket.emit('race:error', { message: 'Race not found or already started' });
      return;
    }
    if (race.players.size >= MAX_PLAYERS) {
      socket.emit('race:error', { message: 'Race is full' });
      return;
    }

    race.players.set(socket.id, {
      socketId: socket.id,
      userId: data.userId || null,
      username: data.username || 'Player',
      isGhost: false,
      progress: 0, wpm: 0, accuracy: 100,
      finished: false,
    });

    socket.join(race.id);
    this.emitRaceState(race.id);
  }

  startPrivateRace(socket: Socket, raceId: string) {
    const race = this.activeRaces.get(raceId);
    if (!race || race.status !== 'WAITING') return;

    // Check if the requester is in this race
    if (!race.players.has(socket.id)) return;

    this.startCountdown(raceId);
  }

  // === COUNTDOWN & START ===

  private startCountdown(raceId: string) {
    const race = this.activeRaces.get(raceId);
    if (!race) return;

    race.status = 'COUNTDOWN';
    let count = COUNTDOWN_DURATION;

    this.io.to(raceId).emit('race:countdown', { count, text: race.text });

    race.countdownTimer = setInterval(() => {
      count--;
      this.io.to(raceId).emit('race:countdown', { count, text: race.text });

      if (count <= 0) {
        clearInterval(race.countdownTimer!);
        this.startRacing(raceId);
      }
    }, 1000);
  }

  private startRacing(raceId: string) {
    const race = this.activeRaces.get(raceId);
    if (!race) return;

    race.status = 'RACING';
    race.startedAt = Date.now();

    this.io.to(raceId).emit('race:start', { text: race.text, startTime: race.startedAt });

    // Start ghost replays
    for (const [, player] of race.players) {
      if (player.isGhost) {
        this.startGhostReplay(raceId, player);
      }
    }

    // Update DB
    if (race.dbId) {
      prisma.race.update({ where: { id: race.dbId }, data: { status: 'RACING', startedAt: new Date() } }).catch(() => {});
    }
  }

  // === TYPING UPDATES ===

  handleTyping(socket: Socket, data: { raceId: string; progress: number; wpm: number; accuracy: number }) {
    const race = this.activeRaces.get(data.raceId);
    if (!race || race.status !== 'RACING') return;

    const player = race.players.get(socket.id);
    if (!player || player.isGhost) return;

    player.progress = data.progress;
    player.wpm = data.wpm;
    player.accuracy = data.accuracy;

    // Broadcast to room
    this.io.to(data.raceId).emit('race:player-update', {
      socketId: socket.id,
      username: player.username,
      progress: data.progress,
      wpm: data.wpm,
      accuracy: data.accuracy,
    });
  }

  handleFinished(socket: Socket, data: { raceId: string; wpm: number; accuracy: number }) {
    const race = this.activeRaces.get(data.raceId);
    if (!race || race.status !== 'RACING') return;

    const player = race.players.get(socket.id);
    if (!player || player.finished) return;

    player.finished = true;
    player.wpm = data.wpm;
    player.accuracy = data.accuracy;
    player.finishTime = Date.now() - (race.startedAt || Date.now());

    // Calculate position
    const finishedCount = Array.from(race.players.values()).filter(p => p.finished).length;
    player.progress = 100;

    this.io.to(data.raceId).emit('race:player-finished', {
      socketId: socket.id,
      username: player.username,
      wpm: data.wpm,
      accuracy: data.accuracy,
      position: finishedCount,
      finishTime: player.finishTime,
    });

    // Check if all real players finished
    const realPlayers = Array.from(race.players.values()).filter(p => !p.isGhost);
    const allFinished = realPlayers.every(p => p.finished);
    if (allFinished) {
      this.finishRace(data.raceId);
    }
  }

  // === FINISH RACE ===

  private async finishRace(raceId: string) {
    const race = this.activeRaces.get(raceId);
    if (!race || race.status === 'FINISHED') return;

    race.status = 'FINISHED';

    // Stop all ghost intervals
    for (const [, player] of race.players) {
      if (player.ghostInterval) clearInterval(player.ghostInterval);
    }

    // Sort by finish time / progress for rankings
    const rankings = Array.from(race.players.values())
      .sort((a, b) => {
        if (a.finished && !b.finished) return -1;
        if (!a.finished && b.finished) return 1;
        if (a.finished && b.finished) return (a.finishTime || Infinity) - (b.finishTime || Infinity);
        return b.progress - a.progress;
      })
      .map((p, i) => ({
        position: i + 1,
        username: p.username,
        wpm: p.wpm,
        accuracy: p.accuracy,
        isGhost: p.isGhost,
        finished: p.finished,
        finishTime: p.finishTime,
      }));

    this.io.to(raceId).emit('race:results', { rankings });

    // Save to DB
    if (race.dbId) {
      try {
        await prisma.race.update({
          where: { id: race.dbId },
          data: { status: 'FINISHED', finishedAt: new Date() },
        });

        for (const p of Array.from(race.players.values())) {
          await prisma.racePlayer.create({
            data: {
              raceId: race.dbId!,
              userId: p.userId, username: p.username,
              isGhost: p.isGhost, wpm: p.wpm, accuracy: p.accuracy,
              progress: p.progress, finishTime: p.finishTime || null,
              position: rankings.findIndex(r => r.username === p.username) + 1,
            },
          });
        }
      } catch (e) { console.error('DB race save error:', e); }
    }

    // Cleanup after 30 seconds
    setTimeout(() => { this.activeRaces.delete(raceId); }, 30000);
  }

  // === GHOST SYSTEM ===

  private async addGhosts(race: ActiveRace, count: number, targetWpm: number) {
    // Try to get real usernames from DB for ghost names
    let ghostNames: string[] = [];
    try {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { username: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      ghostNames = users.map(u => u.username).sort(() => Math.random() - 0.5);
    } catch {
      ghostNames = BOT_PREFIXES.map(p => `${p}Typer${Math.floor(Math.random() * 99)}`);
    }

    // Get existing player usernames to avoid duplicates
    const existingNames = new Set(Array.from(race.players.values()).map(p => p.username));

    for (let i = 0; i < count; i++) {
      // Pick a name not already used
      let name = ghostNames.find(n => !existingNames.has(n)) || `${BOT_PREFIXES[i % BOT_PREFIXES.length]}Typer${Math.floor(Math.random() * 99)}`;
      existingNames.add(name);

      // Randomize ghost WPM around target
      const ghostWpm = Math.max(20, targetWpm + (Math.random() * 40 - 20));
      const ghostId = `ghost_${i}_${Date.now()}`;

      race.players.set(ghostId, {
        socketId: ghostId,
        userId: null,
        username: name,
        isGhost: true,
        progress: 0, wpm: 0, accuracy: 95 + Math.random() * 4.5,
        finished: false,
      });

      // Store target WPM on the player state for replay
      (race.players.get(ghostId) as any)._targetWpm = ghostWpm;
    }
  }

  private startGhostReplay(raceId: string, ghost: RacePlayerState) {
    const race = this.activeRaces.get(raceId);
    if (!race) return;

    const textLength = race.text.length;
    const targetWpm = (ghost as any)._targetWpm || 50;
    // Calculate chars per second from WPM (WPM * 5 / 60)
    const cps = (targetWpm * 5) / 60;
    const totalTimeMs = (textLength / cps) * 1000;
    const updateInterval = 200; // update every 200ms
    let elapsed = 0;

    ghost.ghostInterval = setInterval(() => {
      if (race.status !== 'RACING') {
        clearInterval(ghost.ghostInterval!);
        return;
      }

      elapsed += updateInterval;
      // Add slight randomness to simulate human typing
      const jitter = 1 + (Math.random() * 0.1 - 0.05);
      const progress = Math.min(100, (elapsed / totalTimeMs) * 100 * jitter);
      const currentWpm = Math.round(targetWpm + (Math.random() * 6 - 3));

      ghost.progress = progress;
      ghost.wpm = currentWpm;

      this.io.to(raceId).emit('race:player-update', {
        socketId: ghost.socketId,
        username: ghost.username,
        progress: Math.round(progress * 10) / 10,
        wpm: currentWpm,
        accuracy: ghost.accuracy,
      });

      if (progress >= 100) {
        ghost.finished = true;
        ghost.progress = 100;
        ghost.finishTime = elapsed;
        clearInterval(ghost.ghostInterval!);

        this.io.to(raceId).emit('race:player-finished', {
          socketId: ghost.socketId,
          username: ghost.username,
          wpm: targetWpm,
          accuracy: ghost.accuracy,
          position: Array.from(race.players.values()).filter(p => p.finished).length,
          finishTime: elapsed,
        });
      }
    }, updateInterval);
  }

  // === DISCONNECT ===

  handleDisconnect(socketId: string) {
    this.leaveQueue(socketId);

    // Check active races
    for (const [raceId, race] of this.activeRaces) {
      if (race.players.has(socketId)) {
        race.players.delete(socketId);

        this.io.to(raceId).emit('race:player-left', { socketId });

        // If no real players left, cancel race
        const realPlayers = Array.from(race.players.values()).filter(p => !p.isGhost);
        if (realPlayers.length === 0 && race.status !== 'FINISHED') {
          race.status = 'FINISHED';
          for (const [, p] of race.players) {
            if (p.ghostInterval) clearInterval(p.ghostInterval);
          }
          if (race.countdownTimer) clearInterval(race.countdownTimer);
          this.activeRaces.delete(raceId);
        }
      }
    }
  }

  // === HELPERS ===

  private async getRandomQuote(): Promise<string> {
    try {
      const count = await prisma.quote.count({ where: { isActive: true } });
      if (count > 0) {
        const skip = Math.floor(Math.random() * count);
        const quotes = await prisma.quote.findMany({ where: { isActive: true }, take: 1, skip });
        if (quotes[0]) return quotes[0].text;
      }
    } catch {}
    // Fallback
    const fallbacks = [
      "The quick brown fox jumps over the lazy dog. This classic sentence contains every letter of the alphabet and has been used for typing practice for generations.",
      "Programming is the art of telling a computer what to do. Every great software application begins with a single line of code written by a passionate developer.",
      "Success is not final and failure is not fatal. It is the courage to continue that counts. Every champion was once a contender who refused to give up.",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  private emitRaceState(raceId: string) {
    const race = this.activeRaces.get(raceId);
    if (!race) return;

    const players = Array.from(race.players.values()).map(p => ({
      socketId: p.socketId,
      username: p.username,
      isGhost: p.isGhost,
      progress: p.progress,
      wpm: p.wpm,
    }));

    this.io.to(raceId).emit('race:state', {
      raceId: race.id,
      code: race.code,
      status: race.status,
      type: race.type,
      text: race.text,
      players,
    });
  }
}

export default RaceManager;
