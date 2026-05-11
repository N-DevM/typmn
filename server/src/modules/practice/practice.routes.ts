import { Router, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { validateTypingResult } from '../../middleware/antiCheat';
import redis from '../../config/redis';

const router = Router();

// GET /api/practice/quotes
router.get('/quotes', async (req, res: Response): Promise<void> => {
  try {
    const { category, difficulty, limit = '1' } = req.query;
    const where: any = { isActive: true };
    if (category) where.category = category;
    if (difficulty) where.difficulty = parseInt(difficulty as string);

    const count = await prisma.quote.count({ where });
    const skip = Math.max(0, Math.floor(Math.random() * count) - parseInt(limit as string));
    const quotes = await prisma.quote.findMany({ where, take: parseInt(limit as string), skip });
    res.json({ quotes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// POST /api/practice/results
router.post('/results', authenticate, validateTypingResult, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mode, wpm, cpm, accuracy, errors, consistency, duration, textLength, rawText, errorMap, wpmHistory, quoteId } = req.body;
    let xpEarned = Math.floor(wpm * 0.5 + accuracy * 0.3 + (duration / 10));
    if (accuracy >= 98) xpEarned += 20;
    if (wpm >= 80) xpEarned += 15;

    const session = await prisma.practiceSession.create({
      data: { userId: req.user!.id, quoteId: quoteId || null, mode, wpm, cpm, accuracy, errors, consistency, duration, textLength, rawText, errorMap, wpmHistory, xpEarned },
    });

    // Update stats
    const stats = await prisma.userStats.findUnique({ where: { userId: req.user!.id } });
    if (stats) {
      const n = stats.totalPractices + 1;
      await prisma.userStats.update({
        where: { userId: req.user!.id },
        data: {
          totalPractices: n, bestWpm: Math.max(stats.bestWpm, wpm),
          avgWpm: ((stats.avgWpm * stats.totalPractices) + wpm) / n,
          bestAccuracy: Math.max(stats.bestAccuracy, accuracy),
          avgAccuracy: ((stats.avgAccuracy * stats.totalPractices) + accuracy) / n,
          totalXp: stats.totalXp + xpEarned,
          totalTypingTime: stats.totalTypingTime + duration,
          totalWordsTyped: stats.totalWordsTyped + Math.floor(textLength / 5),
          level: Math.floor((stats.totalXp + xpEarned) / 500) + 1,
        },
      });
    }

    await prisma.xPLog.create({ data: { userId: req.user!.id, amount: xpEarned, source: 'practice', details: `${mode} - ${wpm} WPM` } });
    await redis.del('leaderboard:daily', 'leaderboard:weekly', 'leaderboard:alltime');
    res.status(201).json({ session, xpEarned });
  } catch (error) {
    console.error('Submit result error:', error);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

// GET /api/practice/history
router.get('/history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [sessions, total] = await Promise.all([
      prisma.practiceSession.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: parseInt(limit as string), skip }),
      prisma.practiceSession.count({ where: { userId: req.user!.id } }),
    ]);
    res.json({ sessions, total, page: parseInt(page as string) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/practice/stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await prisma.userStats.findUnique({ where: { userId: req.user!.id } });
    const recent = await prisma.practiceSession.findMany({
      where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { wpm: true, accuracy: true, createdAt: true, mode: true },
    });
    res.json({ stats, recentSessions: recent });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/practice/global-stats (Public)
router.get('/global-stats', async (req, res: Response): Promise<void> => {
  try {
    const cached = await redis.get('global_stats');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const [totalUsers, totalPractices, avgWpmResult] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.practiceSession.count(),
      prisma.practiceSession.aggregate({ _avg: { wpm: true } }),
    ]);

    const stats = {
      users: totalUsers,
      races: totalPractices,
      wpm: Math.round(avgWpmResult._avg.wpm || 0),
    };

    await redis.setex('global_stats', 60, JSON.stringify(stats)); // Cache for 60s
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch global stats' });
  }
});

// GET /api/practice/leaderboard
router.get('/leaderboard', async (req, res: Response): Promise<void> => {
  try {
    const { period = 'alltime', limit = '50' } = req.query;
    const cacheKey = `leaderboard:${period}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) { res.json(JSON.parse(cached)); return; }

    let dateFilter: any = {};
    const now = new Date();
    if (period === 'daily' || period === 'today') {
      const today = new Date(now); today.setHours(0,0,0,0);
      dateFilter = { createdAt: { gte: today } };
    } else if (period === 'weekly' || period === 'week') {
      const w = new Date(now); w.setDate(w.getDate() - 7);
      dateFilter = { createdAt: { gte: w } };
    } else if (period === 'monthly' || period === 'month') {
      const m = new Date(now); m.setMonth(m.getMonth() - 1);
      dateFilter = { createdAt: { gte: m } };
    }

    const topUsers = await prisma.practiceSession.groupBy({
      by: ['userId'], where: dateFilter, _max: { wpm: true, createdAt: true }, _avg: { wpm: true, accuracy: true }, _count: { id: true },
      orderBy: { _max: { wpm: 'desc' } }, take: parseInt(limit as string),
    });

    const userIds = topUsers.map(u => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, avatar: true, country: true, stats: { select: { level: true } } },
    });

    const leaderboard = topUsers.map((e, i) => {
      const u = users.find(x => x.id === e.userId);
      return {
        rank: i + 1,
        username: u?.username || 'Unknown',
        avatar: u?.avatar,
        country: u?.country,
        level: u?.stats?.level || 1,
        bestWpm: Math.round((e._max.wpm || 0) * 10) / 10,
        avgWpm: Math.round((e._avg.wpm || 0) * 10) / 10,
        accuracy: Math.round((e._avg.accuracy || 0) * 10) / 10,
        races: e._count.id,
        lastRaceDate: e._max.createdAt || null,
      };
    });

    await redis.setex(cacheKey, 10, JSON.stringify({ leaderboard, period }));
    res.json({ leaderboard, period });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
