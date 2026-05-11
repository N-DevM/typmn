import { Router, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../../middleware/auth';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { io } from '../../index';

const router = Router();

// GET /api/tournaments — List tournaments
router.get('/', async (req, res: Response): Promise<void> => {
  try {
    const { status, type, page = '1', limit = '10' } = req.query;
    const where: any = {};
    if (status) {
      const statusStr = status as string;
      if (statusStr.includes(',')) {
        where.status = { in: statusStr.split(',') };
      } else {
        where.status = statusStr;
      }
    }
    if (type) where.type = type;

    const authHeader = req.headers.authorization;
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], env.JWT_SECRET) as any;
        userId = decoded.id;
      } catch (e) {}
    }

    const [tournamentsRaw, total] = await Promise.all([
      prisma.tournament.findMany({
        where, orderBy: { scheduledAt: 'asc' },
        take: parseInt(limit as string),
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        include: { _count: { select: { participants: true } } },
      }),
      prisma.tournament.count({ where }),
    ]);

    let tournaments = tournamentsRaw.map(t => ({ ...t, userParticipantStatus: 'NOT_REGISTERED', participantId: null }));
    
    if (userId && tournaments.length > 0) {
      const userParticipants = await prisma.tournamentParticipant.findMany({
        where: { userId, tournamentId: { in: tournaments.map(t => t.id) } },
        include: { payment: true }
      });
      tournaments = tournaments.map(t => {
        const p = userParticipants.find(up => up.tournamentId === t.id);
        if (p) {
          let status = p.paymentVerified ? 'REGISTERED' : 'PENDING_PAYMENT';
          let rejectionReason = null;
          if (!p.paymentVerified && p.payment) {
            if (p.payment.status === 'PENDING') {
              status = 'PAYMENT_UNDER_REVIEW';
            } else if (p.payment.status === 'REJECTED') {
              status = 'PAYMENT_REJECTED';
              rejectionReason = p.payment.rejectionReason;
            }
          }
          return {
            ...t,
            userParticipantStatus: status,
            participantId: p.id,
            rejectionReason
          };
        }
        return t;
      });
    }

    res.json({ tournaments, total });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// GET /api/tournaments/:id — Tournament details
router.get('/:id', async (req, res: Response): Promise<void> => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        participants: { include: { user: { select: { id: true, username: true, avatar: true, country: true } }, matches: true }, orderBy: { registeredAt: 'asc' } },
        rounds: { orderBy: { roundNumber: 'asc' }, include: { matches: { include: { participant: { include: { user: { select: { username: true } } } } }, orderBy: { position: 'asc' } } } },
        _count: { select: { participants: true } },
      },
    });
    if (!tournament) { res.status(404).json({ error: 'Tournament not found' }); return; }
    res.json({ tournament });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// POST /api/tournaments/:id/register — Register for tournament
router.post('/:id/register', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { participants: true } } },
    });
    if (!tournament) { res.status(404).json({ error: 'Tournament not found' }); return; }
    if (tournament.status !== 'REGISTRATION_OPEN') { res.status(400).json({ error: 'Registration is closed' }); return; }
    if (tournament._count.participants >= tournament.maxParticipants) { res.status(400).json({ error: 'Tournament is full' }); return; }

    const existing = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: req.user!.id } },
    });
    if (existing) { res.status(409).json({ error: 'Already registered' }); return; }

    const participant = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, userId: req.user!.id, paymentVerified: tournament.entryFee === 0 },
    });
    res.status(201).json({ participant, requiresPayment: tournament.entryFee > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/admin/tournaments — Create tournament (admin)
const PARAGRAPHS = {
  easy: "The sun was shining brightly in the clear blue sky. A gentle breeze rustled the green leaves of the tall trees. Birds were singing sweet songs, and small animals scurried about in the soft grass. It was a perfect day for a picnic in the park. Children ran around, laughing and playing games, while their parents sat on colorful blankets, enjoying the warm weather and delicious food. Everyone felt happy and relaxed on this beautiful afternoon. The river flowed gently nearby, reflecting the bright sunlight like a mirror. Small fish swam in the clear water, darting between the smooth stones. It was a peaceful scene, full of life and joy. As the day went on, the sky slowly began to change color, turning a soft orange and pink as the sun started to set.",
  medium: "In the heart of the bustling city, towering skyscrapers reached towards the clouds, their glass facades reflecting the vibrant life below. Pedestrians hurried along the crowded sidewalks, a diverse tapestry of individuals each lost in their own world. The symphony of urban sounds—the blaring of horns, the chatter of crowds, the distant wail of a siren—created a relentless but oddly comforting backdrop. Street vendors offered an array of tantalizing aromas, from roasted chestnuts to exotic spices, tempting passersby. Amidst this organized chaos, small oases of tranquility could be found in the city's parks, where nature stubbornly thrived against the concrete landscape. Here, the pace slowed, allowing people to momentarily escape the relentless rhythm of urban existence.",
  hard: "The theory of quantum mechanics, established in the early 20th century (circa 1925-1927), fundamentally altered our comprehension of the physical universe at the subatomic level. Unlike classical physics, which relies on deterministic equations (e.g., F = m*a), quantum mechanics introduces probabilistic wave functions, famously encapsulated in Schrödinger's equation: iℏ(∂Ψ/∂t) = HΨ. This mathematical framework dictates that particles exist in a superposition of states until observed, a concept that continues to challenge our intuitive understanding of reality. Furthermore, phenomena such as quantum entanglement—described by Einstein as 'spooky action at a distance'—demonstrate correlations between particles that seemingly defy the speed of light limit (c = 299,792,458 m/s). The implications of these discoveries extend far beyond theoretical physics, forming the foundational basis for modern technologies including semiconductors, lasers, and emerging quantum computing systems."
};

router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, type, entryFee, prizePool, currency, maxParticipants, minParticipants, scheduledAt, endScheduledAt, difficulty, registrationEnd, advanceCount, topRankCount, prizeTopCount, refundRankStart, refundRankEnd, prizeDistribution, rules } = req.body;

    const assignedQuoteText = PARAGRAPHS[difficulty as keyof typeof PARAGRAPHS] || PARAGRAPHS.medium;

    const tournament = await prisma.tournament.create({
      data: {
        name, description, type, entryFee: entryFee || 0, prizePool: prizePool || 0,
        currency: currency || 'PKR', maxParticipants: maxParticipants || 100,
        minParticipants: minParticipants || 2, scheduledAt: new Date(scheduledAt),
        endScheduledAt: endScheduledAt ? new Date(endScheduledAt) : null,
        difficulty: difficulty || 'medium',
        registrationEnd: registrationEnd ? new Date(registrationEnd) : null,
        status: 'REGISTRATION_OPEN', advanceCount, topRankCount, prizeTopCount,
        refundRankStart, refundRankEnd, prizeDistribution, quoteText: assignedQuoteText, rules,
        createdBy: req.user!.id,
      },
    });

    io.emit('tournament:updated');
    res.status(201).json({ tournament });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// PATCH /api/admin/tournaments/:id — Update tournament (admin)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournament = await prisma.tournament.update({
      where: { id: req.params.id }, data: req.body,
    });
    io.emit('tournament:updated');
    res.json({ tournament });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// POST /api/tournaments/:id/start-round — Start a round (admin)
router.post('/:id/start-round', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roundNumber, name, quoteText, advanceCount } = req.body;
    const round = await prisma.tournamentRound.create({
      data: {
        tournamentId: req.params.id, roundNumber, name,
        quoteText, advanceCount, status: 'IN_PROGRESS', startedAt: new Date(),
      },
    });
    await prisma.tournament.update({ where: { id: req.params.id }, data: { status: 'IN_PROGRESS' } });
    
    io.emit('tournament:updated');
    io.to(`tournament:${req.params.id}`).emit('tournament:status-changed', { status: 'IN_PROGRESS' });
    
    res.status(201).json({ round });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start round' });
  }
});

// POST /api/tournaments/:id/submit-result — Submit typing result in tournament
router.post('/:id/submit-result', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roundId, wpm, accuracy, errors, duration } = req.body;
    const participant = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_userId: { tournamentId: req.params.id, userId: req.user!.id } },
    });
    if (!participant || !participant.paymentVerified) { res.status(403).json({ error: 'Not a verified participant' }); return; }

    const match = await prisma.tournamentMatch.create({
      data: { tournamentId: req.params.id, roundId, participantId: participant.id, wpm, accuracy, errors, duration, completedAt: new Date() },
    });

    // Update participant stats
    await prisma.tournamentParticipant.update({
      where: { id: participant.id },
      data: { totalWpm: (participant.totalWpm || 0) + wpm, totalAccuracy: accuracy },
    });

    res.status(201).json({ match });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit result' });
  }
});

// POST /api/tournaments/:id/finalize — Finalize tournament results (admin)
router.post('/:id/finalize', authenticate, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: { participants: { include: { matches: true } } },
    });
    if (!tournament) { res.status(404).json({ error: 'Not found' }); return; }

    // Rank participants by best WPM
    const ranked = tournament.participants
      .filter(p => p.paymentVerified && p.matches.length > 0)
      .sort((a, b) => {
        const aWpm = Math.max(...a.matches.map(m => m.wpm));
        const bWpm = Math.max(...b.matches.map(m => m.wpm));
        return bWpm - aWpm;
      });

    // Assign ranks and handle prizes/refunds based on type
    for (let i = 0; i < ranked.length; i++) {
      const rank = i + 1;
      const update: any = { finalRank: rank, isActive: false };

      if (tournament.type === 'TOP_RANKING') {
        const prizeTop = tournament.prizeTopCount || 3;
        const refundEnd = tournament.refundRankEnd || 10;
        if (rank <= prizeTop) {
          const dist = tournament.prizeDistribution as any[];
          const prize = dist?.find((d: any) => d.rank === rank);
          update.prizeAmount = prize?.amount || 0;
        } else if (rank <= refundEnd) {
          update.refunded = true;
        }
      } else {
        // Elimination: only winner gets prize
        if (rank === 1) update.prizeAmount = tournament.prizePool;
      }

      await prisma.tournamentParticipant.update({ where: { id: ranked[i].id }, data: update });
    }

    await prisma.tournament.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });

    io.emit('tournament:updated');
    io.to(`tournament:${req.params.id}`).emit('tournament:status-changed', { status: 'COMPLETED' });

    res.json({ message: 'Tournament finalized', rankings: ranked.map((p, i) => ({ rank: i + 1, participantId: p.id, userId: p.userId })) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to finalize' });
  }
});

export default router;
