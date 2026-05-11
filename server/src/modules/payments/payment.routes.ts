import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import prisma from '../../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../../middleware/auth';
import { io } from '../../index';

const upload = multer({
  storage: multer.diskStorage({
    destination: './uploads/payments',
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const router = Router();

// POST /api/payments/submit — Submit payment proof
router.post('/submit', authenticate, upload.single('screenshot'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { participantId, amount, method, transactionId, senderName, senderAccount } = req.body;
    const screenshotUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;

    const participant = await prisma.tournamentParticipant.findUnique({
      where: { id: participantId },
      include: { tournament: true },
    });
    if (!participant) { res.status(404).json({ error: 'Participant not found' }); return; }
    if (participant.userId !== req.user!.id) { res.status(403).json({ error: 'Not your registration' }); return; }

    const payment = await prisma.payment.upsert({
      where: { participantId },
      update: {
        amount: parseFloat(amount), method, transactionId, senderName, senderAccount,
        ...(screenshotUrl ? { screenshotUrl } : {}),
        status: 'PENDING', rejectionReason: null, adminNotes: null
      },
      create: {
        userId: req.user!.id, participantId, amount: parseFloat(amount),
        method, transactionId, senderName, senderAccount, screenshotUrl,
      },
    });
    res.status(201).json({ payment });
  } catch (error) {
    console.error('Payment submit error:', error);
    res.status(500).json({ error: 'Payment submission failed' });
  }
});

// GET /api/payments/my — Get user's payments
router.get('/my', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { participant: { include: { tournament: { select: { name: true } } } } },
    });
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GET /api/admin/payments — Admin: list all pending payments
router.get('/admin/queue', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, username: true, email: true } },
        participant: { include: { tournament: { select: { id: true, name: true } } } },
      },
    });
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment queue' });
  }
});

// GET /api/admin/payments/history — Admin: list all processed payments
router.get('/admin/history', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: { in: ['VERIFIED', 'REJECTED', 'REFUNDED'] } },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, email: true } },
        participant: { include: { tournament: { select: { id: true, name: true } } } },
      },
    });
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// PATCH /api/admin/payments/:id/verify — Admin: approve/reject payment
router.patch('/admin/:id/verify', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, adminNotes, rejectionReason } = req.body;
    if (!['VERIFIED', 'REJECTED'].includes(action)) { res.status(400).json({ error: 'Invalid action' }); return; }

    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data: {
        status: action, adminNotes, rejectionReason: action === 'REJECTED' ? rejectionReason : null,
        verifiedBy: req.user!.id, verifiedAt: new Date(),
      },
    });

    // If verified, mark participant as payment verified. If rejected, revert it.
    if (payment.participantId) {
      await prisma.tournamentParticipant.update({
        where: { id: payment.participantId },
        data: { paymentVerified: action === 'VERIFIED' },
      });
    }

    // Log admin action
    await prisma.adminLog.create({
      data: { adminId: req.user!.id, action: `payment_${action.toLowerCase()}`, target: payment.id, details: { adminNotes, rejectionReason } },
    });

    // Real-time update to user
    io.emit(`payment:status_changed:${payment.userId}`, { 
      paymentId: payment.id, 
      status: action,
      tournamentId: payment.participantId ? (await prisma.tournamentParticipant.findUnique({ where: { id: payment.participantId } }))?.tournamentId : null
    });

    res.json({ payment });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /api/admin/payments/stats — Payment stats
router.get('/admin/stats', authenticate, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [pending, verified, rejected, total] = await Promise.all([
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'VERIFIED' } }),
      prisma.payment.count({ where: { status: 'REJECTED' } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'VERIFIED' } }),
    ]);
    res.json({ pending, verified, rejected, totalRevenue: total._sum.amount || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
