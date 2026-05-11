import prisma from '../config/database';
import { io } from '../index';

export function startTournamentScheduler() {
  console.log('⏱️ Tournament Scheduler started...');
  
  setInterval(async () => {
    try {
      const now = new Date();
      
      // Auto-start tournaments
      const toStart = await prisma.tournament.findMany({
        where: { status: 'REGISTRATION_OPEN', scheduledAt: { lte: now } }
      });
      
      for (const t of toStart) {
        await prisma.tournament.update({ where: { id: t.id }, data: { status: 'IN_PROGRESS', startedAt: now } });
        io.to(`tournament:${t.id}`).emit('tournament:status-changed', { status: 'IN_PROGRESS' });
        console.log(`🚀 Auto-started tournament: ${t.name}`);
      }
      
      // Auto-end tournaments
      const toEnd = await prisma.tournament.findMany({
        where: { status: 'IN_PROGRESS', endScheduledAt: { lte: now } },
        include: { participants: { include: { matches: true } } }
      });
      
      for (const t of toEnd) {
        // Rank participants and assign prizes/refunds
        const ranked = t.participants
          .filter(p => p.paymentVerified && p.matches.length > 0)
          .sort((a, b) => {
            const aProgress = Math.max(...a.matches.map(m => m.progress));
            const bProgress = Math.max(...b.matches.map(m => m.progress));
            const aWpm = Math.max(...a.matches.map(m => m.wpm));
            const bWpm = Math.max(...b.matches.map(m => m.wpm));
            
            if (bProgress !== aProgress) {
              return bProgress - aProgress; // Primary: Progress
            }
            return bWpm - aWpm; // Secondary: WPM
          });

        for (let i = 0; i < ranked.length; i++) {
          const rank = i + 1;
          const update: any = { finalRank: rank, isActive: false };

          if (t.type === 'TOP_RANKING') {
            const prizeTop = t.prizeTopCount || 3;
            const refundEnd = t.refundRankEnd || 10;
            if (rank <= prizeTop) {
              const dist = t.prizeDistribution as any[];
              const prize = dist?.find((d: any) => d.rank === rank);
              update.prizeAmount = prize?.amount || 0;
            } else if (rank <= refundEnd) {
              update.refunded = true;
            }
          } else {
            if (rank === 1) update.prizeAmount = t.prizePool;
          }

          await prisma.tournamentParticipant.update({ where: { id: ranked[i].id }, data: update });
        }

        await prisma.tournament.update({ where: { id: t.id }, data: { status: 'COMPLETED', endedAt: now } });
        io.to(`tournament:${t.id}`).emit('tournament:status-changed', { status: 'COMPLETED' });
        console.log(`✅ Auto-ended tournament: ${t.name}`);
      }
      
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 10000); // Check every 10 seconds
}
