import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import prisma from './config/database';
import redis from './config/redis';
import authRoutes from './modules/auth/auth.routes';
import practiceRoutes from './modules/practice/practice.routes';
import tournamentRoutes from './modules/tournaments/tournament.routes';
import paymentRoutes from './modules/payments/payment.routes';
import adminRoutes from './modules/admin/admin.routes';
import gamificationRoutes from './modules/gamification/gamification.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { startTournamentScheduler } from './services/tournamentScheduler';
import RaceManager from './services/raceManager';
import fs from 'fs';
import path from 'path';

const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
  cors: { origin: env.CLIENT_URL, credentials: true },
  pingTimeout: 60000,
});

// Middleware
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/payments');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gamification', gamificationRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.IO events
const raceManager = new RaceManager(io);

io.on('connection', (socket) => {
  console.log(`⚡ Socket connected: ${socket.id}`);

  socket.on('practice:start', (data) => {
    socket.join(`practice:${data.userId}`);
  });

  socket.on('practice:progress', (data) => {
    socket.to(`practice:${data.roomId}`).emit('practice:update', data);
  });

  socket.on('tournament:join', (data) => {
    socket.join(`tournament:${data.tournamentId}`);
    io.to(`tournament:${data.tournamentId}`).emit('tournament:participant-joined', {
      userId: data.userId, username: data.username,
    });
  });

  socket.on('tournament:typing', (data) => {
    socket.to(`tournament:${data.tournamentId}`).emit('tournament:typing-update', {
      userId: data.userId, progress: data.progress, wpm: data.wpm,
    });
  });

  socket.on('tournament:round-complete', async (data) => {
    try {
      const p = await prisma.tournamentParticipant.findUnique({
        where: { tournamentId_userId: { tournamentId: data.tournamentId, userId: data.userId } }
      });
      if (p) {
        let round = await prisma.tournamentRound.findFirst({ where: { tournamentId: data.tournamentId } });
        if (!round) {
          round = await prisma.tournamentRound.create({
            data: { tournamentId: data.tournamentId, roundNumber: 1, name: "Final", status: "IN_PROGRESS" }
          });
        }
        await prisma.tournamentMatch.upsert({
          where: { roundId_participantId: { roundId: round.id, participantId: p.id } },
          update: { wpm: data.wpm, progress: data.progress || 100, isFinished: true },
          create: { tournamentId: data.tournamentId, roundId: round.id, participantId: p.id, wpm: data.wpm, progress: data.progress || 100, isFinished: true }
        });
      }
    } catch (e) {
      console.error("Match save error", e);
    }
    io.to(`tournament:${data.tournamentId}`).emit('tournament:round-results', data);
  });

  // === RACE EVENTS ===
  socket.on('race:join-queue', (data) => raceManager.joinQueue(socket, data));
  socket.on('race:leave-queue', () => raceManager.leaveQueue(socket.id));
  socket.on('race:create-private', (data) => raceManager.createPrivateRace(socket, data));
  socket.on('race:join-private', (data) => raceManager.joinPrivateRace(socket, data));
  socket.on('race:start-private', (data) => raceManager.startPrivateRace(socket, data.raceId));
  socket.on('race:typing', (data) => raceManager.handleTyping(socket, data));
  socket.on('race:finished', (data) => raceManager.handleFinished(socket, data));

  socket.on('disconnect', () => {
    raceManager.handleDisconnect(socket.id);
    console.log(`💤 Socket disconnected: ${socket.id}`);
  });
});

// Start server
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    await redis.ping();
    console.log('✅ Redis connected');

    httpServer.listen(env.API_PORT, () => {
      console.log(`\n🚀 TypmN Server running on http://localhost:${env.API_PORT}`);
      console.log(`🔌 Socket.IO on same port`);
      console.log(`📊 Environment: ${env.NODE_ENV}\n`);
      
      startTournamentScheduler();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { io };
