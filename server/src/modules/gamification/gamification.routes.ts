import { Router, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import redis from '../../config/redis';

const router = Router();

// Achievement definitions
const ACHIEVEMENT_CHECKS: { badgeId: string; check: (stats: any, streaks: any) => boolean }[] = [
  { badgeId: 'first_practice', check: (s) => s.totalPractices >= 1 },
  { badgeId: 'speed_demon', check: (s) => s.bestWpm >= 100 },
  { badgeId: 'accuracy_master', check: (s) => s.bestAccuracy >= 99 },
  { badgeId: 'marathon_typist', check: (s) => s.totalPractices >= 100 },
  { badgeId: 'streak_warrior', check: (_s, st) => st?.currentStreak >= 7 },
  { badgeId: 'xp_grinder', check: (s) => s.totalXp >= 5000 },
  { badgeId: 'level_up', check: (s) => s.level >= 10 },
  { badgeId: 'speed_100', check: (s) => s.bestWpm >= 80 },
  { badgeId: 'perfectionist', check: (s) => s.bestAccuracy >= 100 },
  { badgeId: 'dedicated', check: (s) => s.totalTypingTime >= 3600 },
];

// POST /api/gamification/check-achievements — Check and award achievements
router.post('/check-achievements', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const [stats, streaks, existingAchievements, allBadges] = await Promise.all([
      prisma.userStats.findUnique({ where: { userId } }),
      prisma.streak.findUnique({ where: { userId } }),
      prisma.userAchievement.findMany({ where: { userId }, select: { badgeId: true } }),
      prisma.badge.findMany(),
    ]);

    if (!stats) { res.json({ newAchievements: [] }); return; }

    const earnedIds = new Set(existingAchievements.map(a => a.badgeId));
    const newAchievements: any[] = [];

    for (const check of ACHIEVEMENT_CHECKS) {
      const badge = allBadges.find(b => b.id === check.badgeId || b.name.toLowerCase().replace(/\s+/g, '_') === check.badgeId);
      if (!badge || earnedIds.has(badge.id)) continue;

      if (check.check(stats, streaks)) {
        const achievement = await prisma.userAchievement.create({
          data: { userId, badgeId: badge.id },
          include: { badge: true },
        });
        newAchievements.push(achievement);

        // Award XP for achievement
        const xpReward = badge.xpReward || 50;
        await prisma.userStats.update({
          where: { userId },
          data: { totalXp: { increment: xpReward } },
        });
        await prisma.xPLog.create({
          data: { userId, amount: xpReward, source: 'achievement', details: `Earned: ${badge.name}` },
        });
      }
    }

    res.json({ newAchievements });
  } catch (error) {
    console.error('Achievement check error:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

// GET /api/gamification/achievements — Get user achievements
router.get('/achievements', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [earned, allBadges] = await Promise.all([
      prisma.userAchievement.findMany({
        where: { userId: req.user!.id },
        include: { badge: true },
        orderBy: { unlockedAt: 'desc' },
      }),
      prisma.badge.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const earnedIds = new Set(earned.map(a => a.badgeId));
    const badges = allBadges.map(b => ({
      ...b, earned: earnedIds.has(b.id),
      unlockedAt: earned.find(a => a.badgeId === b.id)?.unlockedAt || null,
    }));

    res.json({ badges, totalEarned: earned.length, totalBadges: allBadges.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// GET /api/gamification/daily-challenge — Get today's challenge
router.get('/daily-challenge', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `daily_challenge:${today}`;
    const cached = await redis.get(cacheKey);

    if (cached) { res.json(JSON.parse(cached)); return; }

    // Generate daily challenges based on day
    const dayNum = Math.floor(Date.now() / 86400000);
    const challenges = [
      { id: `dc_${today}_1`, title: "Speed Run", description: "Achieve 60+ WPM in a 30-second practice", goal: 60, metric: "wpm", mode: "TIME_30", xpReward: 50 },
      { id: `dc_${today}_2`, title: "Perfect Accuracy", description: "Complete a practice with 98%+ accuracy", goal: 98, metric: "accuracy", mode: "any", xpReward: 40 },
      { id: `dc_${today}_3`, title: "Endurance Test", description: "Complete 3 practice sessions today", goal: 3, metric: "sessions", mode: "any", xpReward: 60 },
    ];

    // Pick 2 challenges for the day
    const selected = [challenges[dayNum % 3], challenges[(dayNum + 1) % 3]];
    const result = { date: today, challenges: selected };
    await redis.setex(cacheKey, 86400, JSON.stringify(result));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily challenge' });
  }
});

// POST /api/gamification/daily-challenge/check — Check challenge completion
router.post('/daily-challenge/check', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const todaySessions = await prisma.practiceSession.findMany({
      where: { userId, createdAt: { gte: today } },
    });

    const completedChallenges: string[] = [];
    const bestWpm = Math.max(...todaySessions.map(s => s.wpm), 0);
    const bestAccuracy = Math.max(...todaySessions.map(s => s.accuracy), 0);
    const sessionCount = todaySessions.length;

    if (bestWpm >= 60) completedChallenges.push('speed_run');
    if (bestAccuracy >= 98) completedChallenges.push('perfect_accuracy');
    if (sessionCount >= 3) completedChallenges.push('endurance_test');

    res.json({ completedChallenges, todayStats: { bestWpm, bestAccuracy, sessionCount } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check challenges' });
  }
});

// GET /api/gamification/xp-history — XP log
router.get('/xp-history', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await prisma.xPLog.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch XP history' });
  }
});

// POST /api/gamification/update-streak — Update daily streak
router.post('/update-streak', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const streak = await prisma.streak.findUnique({ where: { userId } });

    if (!streak) {
      const newStreak = await prisma.streak.create({
        data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: new Date() },
      });
      res.json({ streak: newStreak });
      return;
    }

    const lastDate = streak.lastActiveDate ? new Date(streak.lastActiveDate) : new Date(0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lastDay = new Date(lastDate); lastDay.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / 86400000);

    let newCurrent = streak.currentStreak;
    if (diffDays === 1) {
      newCurrent = streak.currentStreak + 1;
    } else if (diffDays > 1) {
      newCurrent = 1;
    }
    // diffDays === 0 means already practiced today, keep current

    const updated = await prisma.streak.update({
      where: { userId },
      data: {
        currentStreak: newCurrent,
        longestStreak: Math.max(streak.longestStreak, newCurrent),
        lastActiveDate: new Date(),
      },
    });

    // Streak bonus XP
    if (diffDays === 1 && newCurrent > 1) {
      const streakBonus = Math.min(newCurrent * 5, 50);
      await prisma.userStats.update({
        where: { userId },
        data: { totalXp: { increment: streakBonus } },
      });
      await prisma.xPLog.create({
        data: { userId, amount: streakBonus, source: 'streak', details: `${newCurrent}-day streak bonus` },
      });
    }

    res.json({ streak: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update streak' });
  }
});

export default router;
