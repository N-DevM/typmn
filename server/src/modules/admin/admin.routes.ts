import { Router, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /api/admin/dashboard — Admin overview stats
router.get('/dashboard', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalUsers, activeUsers, totalTournaments, activeTournaments, pendingPayments, totalRevenue, totalPractices, antiCheatFlags] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.tournament.count(),
      prisma.tournament.count({ where: { status: { in: ['REGISTRATION_OPEN', 'IN_PROGRESS'] } } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'VERIFIED' } }),
      prisma.practiceSession.count(),
      prisma.antiCheatFlag.count({ where: { reviewed: false } }),
    ]);

    // Recent signups (last 7 days)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const recentSignups = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } });

    res.json({
      totalUsers, activeUsers, recentSignups,
      totalTournaments, activeTournaments,
      pendingPayments, totalRevenue: totalRevenue._sum.amount || 0,
      totalPractices, antiCheatFlags,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// GET /api/admin/users — List users
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status, page = '1', limit = '20' } = req.query;
    const where: any = {};
    if (search) where.OR = [{ username: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }];
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string), skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        select: { id: true, email: true, username: true, role: true, status: true, country: true, createdAt: true, lastLoginAt: true, stats: { select: { bestWpm: true, avgWpm: true, totalPractices: true, level: true, totalXp: true } } },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id — Update user (ban/unban/role)
router.patch('/users/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, role } = req.body;
    const data: any = {};
    if (status) data.status = status;
    if (role) data.role = role;

    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    await prisma.adminLog.create({
      data: { adminId: req.user!.id, action: 'user_update', target: req.params.id, details: data },
    });
    res.json({ user: { id: user.id, username: user.username, status: user.status, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/admin/anti-cheat — Review flags
router.get('/anti-cheat', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reviewed = 'false' } = req.query;
    const flags = await prisma.antiCheatFlag.findMany({
      where: { reviewed: reviewed === 'true' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    res.json({ flags });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch flags' });
  }
});

// PATCH /api/admin/anti-cheat/:id — Review a flag
router.patch('/anti-cheat/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reviewNotes, banUser } = req.body;
    await prisma.antiCheatFlag.update({
      where: { id: req.params.id },
      data: { reviewed: true, reviewedBy: req.user!.id, reviewNotes },
    });
    if (banUser) {
      const flag = await prisma.antiCheatFlag.findUnique({ where: { id: req.params.id } });
      if (flag) await prisma.user.update({ where: { id: flag.userId }, data: { status: 'BANNED' } });
    }
    res.json({ message: 'Flag reviewed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to review flag' });
  }
});

// GET /api/admin/announcements — List announcements
router.get('/announcements', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ announcements });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST /api/admin/announcements — Create announcement
router.post('/announcements', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, type, isPinned } = req.body;
    const announcement = await prisma.announcement.create({
      data: { title, content, type: type || 'info', isPinned: isPinned || false, createdBy: req.user!.id },
    });
    res.status(201).json({ announcement });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// GET /api/admin/logs — Admin audit logs
router.get('/logs', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const logs = await prisma.adminLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/admin/anti-cheat — List anti-cheat flags
router.get('/anti-cheat', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reviewed = req.query.reviewed === 'true';
    const flags = await prisma.antiCheatFlag.findMany({
      where: { reviewed },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, username: true, email: true, status: true } },
      },
    });
    const total = await prisma.antiCheatFlag.count({ where: { reviewed } });
    res.json({ flags, total });
  } catch (error) {
    console.error('Anti-cheat fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch anti-cheat flags' });
  }
});

// PATCH /api/admin/anti-cheat/:id — Review/dismiss anti-cheat flag
router.patch('/anti-cheat/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, banUser } = req.body;
    if (!['dismiss', 'confirm'].includes(action)) {
      res.status(400).json({ error: 'Invalid action. Use dismiss or confirm.' });
      return;
    }

    const flag = await prisma.antiCheatFlag.update({
      where: { id: req.params.id },
      data: { reviewed: true, reviewedBy: req.user!.id, reviewedAt: new Date() },
    });

    // If confirming and banning the user
    if (action === 'confirm' && banUser && flag.userId) {
      await prisma.user.update({
        where: { id: flag.userId },
        data: { status: 'BANNED' },
      });
    }

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: `anticheat_${action}`,
        target: flag.id,
        details: { flagId: flag.id, userId: flag.userId, banUser: !!banUser },
      },
    });

    res.json({ flag, message: `Flag ${action}ed successfully${banUser ? ' and user banned' : ''}` });
  } catch (error) {
    console.error('Anti-cheat review error:', error);
    res.status(500).json({ error: 'Failed to review anti-cheat flag' });
  }
});

export default router;
