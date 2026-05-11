import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLAYERS = [
  { username: "SpeedKing", country: "🇵🇰", wpm: 142, acc: 98.5 },
  { username: "TypeMaster", country: "🇮🇳", wpm: 136, acc: 99.1 },
  { username: "KeyWarrior", country: "🇺🇸", wpm: 128, acc: 97.8 },
  { username: "SwiftFingers", country: "🇬🇧", wpm: 125, acc: 98.2 },
  { username: "ProTypist", country: "🇵🇰", wpm: 119, acc: 99.0 },
  { username: "RapidCoder", country: "🇩🇪", wpm: 115, acc: 97.5 },
  { username: "FlashType", country: "🇨🇦", wpm: 112, acc: 98.8 },
  { username: "NitroKeys", country: "🇦🇺", wpm: 108, acc: 96.9 },
  { username: "TurboTyper", country: "🇫🇷", wpm: 105, acc: 97.3 },
  { username: "AlphaRacer", country: "🇧🇷", wpm: 102, acc: 98.1 },
  { username: "PhantomKeys", country: "🇰🇷", wpm: 98, acc: 97.0 },
  { username: "DigitalStorm", country: "🇯🇵", wpm: 95, acc: 96.5 },
  { username: "ByteRunner", country: "🇳🇬", wpm: 93, acc: 98.4 },
  { username: "NeonTypist", country: "🇵🇰", wpm: 90, acc: 97.7 },
  { username: "CyberFingers", country: "🇹🇷", wpm: 88, acc: 96.2 },
  { username: "VelocityKey", country: "🇮🇩", wpm: 85, acc: 97.9 },
  { username: "ThunderType", country: "🇲🇽", wpm: 82, acc: 95.8 },
  { username: "QuantumTyper", country: "🇪🇸", wpm: 79, acc: 97.1 },
  { username: "ShadowKeys", country: "🇮🇹", wpm: 76, acc: 96.8 },
  { username: "BlitzFingers", country: "🇵🇱", wpm: 73, acc: 95.5 },
];

async function seed() {
  const hash = await bcrypt.hash("player123456", 10);
  
  for (const p of PLAYERS) {
    const email = `${p.username.toLowerCase()}@typmn.com`;
    
    // Create or find user
    let user = await prisma.user.findUnique({ where: { username: p.username } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email, username: p.username, passwordHash: hash,
          role: "USER", status: "ACTIVE", country: p.country, emailVerified: true,
        },
      });
      await prisma.userStats.create({
        data: {
          userId: user.id, level: Math.floor(p.wpm / 5),
          bestWpm: p.wpm, avgWpm: p.wpm - 8,
          bestAccuracy: p.acc, avgAccuracy: p.acc - 1,
          totalPractices: 10 + Math.floor(Math.random() * 50),
          totalXp: p.wpm * 20, totalTypingTime: 3600 + Math.floor(Math.random() * 7200),
        },
      });
    }
    
    // Create multiple practice sessions (for leaderboard data)
    const sessions = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < sessions; i++) {
      const hoursAgo = Math.floor(Math.random() * 48);
      const wpmVar = p.wpm + Math.floor(Math.random() * 20 - 10);
      const accVar = Math.min(100, p.acc + (Math.random() * 3 - 1.5));
      
      await prisma.practiceSession.create({
        data: {
          userId: user.id, mode: "TIME_60",
          wpm: wpmVar, cpm: wpmVar * 5, accuracy: Math.round(accVar * 10) / 10,
          errors: Math.floor((100 - accVar) / 2), consistency: 85 + Math.random() * 10,
          duration: 60, textLength: wpmVar * 5, xpEarned: Math.floor(wpmVar * 0.8),
          createdAt: new Date(Date.now() - hoursAgo * 3600000),
        },
      });
    }
  }
  
  // Clear Redis cache so leaderboard refreshes
  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const keys = await redis.keys('leaderboard:*');
  if (keys.length > 0) await redis.del(...keys);
  await redis.quit();
  
  console.log(`✅ Seeded ${PLAYERS.length} players with practice sessions`);
  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
