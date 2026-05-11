import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth';

// Suspicious WPM thresholds
const MAX_REALISTIC_WPM = 200;  // World record is ~212 WPM
const SUSPICIOUS_WPM = 160;     // Flag for review above this
const MIN_TYPING_DURATION = 3;  // Minimum seconds for valid result
const MAX_ERROR_RATIO = 0.5;    // More than 50% errors is suspicious

interface AntiCheatData {
  wpm: number;
  accuracy: number;
  errors: number;
  duration: number;
  textLength: number;
  tabSwitches?: number;
  pasteAttempts?: number;
  focusLosses?: number;
  keystrokeIntervals?: { avg: number; stdDev: number; count: number };
}

export async function validateTypingResult(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data: AntiCheatData = req.body;
    const flags: string[] = [];
    const userId = req.user?.id;

    if (!userId) { next(); return; }

    // 1. Impossibly high WPM
    if (data.wpm > MAX_REALISTIC_WPM) {
      flags.push(`WPM exceeds maximum realistic threshold: ${data.wpm} WPM (max: ${MAX_REALISTIC_WPM})`);
    }

    // 2. Suspiciously high WPM (flag but don't block)
    if (data.wpm > SUSPICIOUS_WPM && data.wpm <= MAX_REALISTIC_WPM) {
      flags.push(`Suspiciously high WPM: ${data.wpm} WPM`);
    }

    // 3. Duration too short
    if (data.duration < MIN_TYPING_DURATION && data.textLength > 20) {
      flags.push(`Duration suspiciously short: ${data.duration}s for ${data.textLength} characters`);
    }

    // 4. WPM vs accuracy mismatch (very high WPM with very low accuracy is suspicious)
    if (data.wpm > 100 && data.accuracy < 60) {
      flags.push(`WPM/Accuracy mismatch: ${data.wpm} WPM with ${data.accuracy}% accuracy`);
    }

    // 5. Characters per second check
    const cps = data.textLength / Math.max(data.duration, 1);
    if (cps > 15) { // More than 15 chars/sec is very suspicious
      flags.push(`Characters per second too high: ${cps.toFixed(1)} CPS`);
    }

    // 6. Tab switches detected
    if (data.tabSwitches && data.tabSwitches > 3) {
      flags.push(`Excessive tab switches: ${data.tabSwitches} times`);
    }

    // 7. Paste attempts
    if (data.pasteAttempts && data.pasteAttempts > 0) {
      flags.push(`Paste attempts detected: ${data.pasteAttempts} times`);
    }

    // 8. Sudden WPM spike — check against user's average
    const userStats = await prisma.userStats.findUnique({ where: { userId } });
    if (userStats && userStats.avgWpm > 0 && data.wpm > userStats.avgWpm * 2) {
      flags.push(`WPM spike: ${data.wpm} WPM is ${(data.wpm / userStats.avgWpm).toFixed(1)}x their average (${userStats.avgWpm.toFixed(0)} WPM)`);
    }

    // 9. Keystroke timing analysis — detect bot-like uniform typing
    if (data.keystrokeIntervals && data.keystrokeIntervals.count > 20) {
      const { avg, stdDev, count } = data.keystrokeIntervals;
      // Coefficient of variation: human typing is typically > 0.25 (25%)
      // Bots/macros have very uniform intervals with CoV < 0.1 (10%)
      if (avg > 0) {
        const coefficientOfVariation = stdDev / avg;
        if (coefficientOfVariation < 0.08) {
          flags.push(`Bot-like keystroke timing detected: CoV=${(coefficientOfVariation * 100).toFixed(1)}% (${count} keys, avg=${avg}ms, stdDev=${stdDev}ms)`);
        } else if (coefficientOfVariation < 0.15 && data.wpm > 100) {
          flags.push(`Suspiciously uniform keystroke timing: CoV=${(coefficientOfVariation * 100).toFixed(1)}% at ${data.wpm} WPM`);
        }
      }
      // Impossibly fast sustained typing (avg < 30ms between keys = 33+ chars/sec)
      if (avg > 0 && avg < 30 && count > 50) {
        flags.push(`Impossibly fast sustained keystrokes: avg ${avg}ms between keys (${count} keys)`);
      }
    }

    // If there are flags, log them
    if (flags.length > 0) {
      const severity = data.wpm > MAX_REALISTIC_WPM || (data.pasteAttempts && data.pasteAttempts > 0)
        ? 'HIGH' : flags.length >= 3 ? 'MEDIUM' : 'LOW';

      // Upgrade severity for keystroke anomalies
      const hasKeystrokeAnomaly = flags.some(f => f.includes('Bot-like') || f.includes('Impossibly fast sustained'));
      const finalSeverity = hasKeystrokeAnomaly ? 'HIGH' : severity;

      await prisma.antiCheatFlag.create({
        data: {
          userId,
          type: flags.join(' | '),
          severity: finalSeverity,
          details: {
            wpm: data.wpm, accuracy: data.accuracy, errors: data.errors,
            duration: data.duration, textLength: data.textLength,
            tabSwitches: data.tabSwitches, pasteAttempts: data.pasteAttempts,
            keystrokeIntervals: data.keystrokeIntervals || null,
          },
        },
      });

      // Block impossibly high WPM
      if (data.wpm > MAX_REALISTIC_WPM) {
        res.status(403).json({ error: 'Result rejected: performance exceeds realistic limits', flagged: true });
        return;
      }
    }

    // Attach flags count to request for downstream use
    (req as any).antiCheatFlags = flags;
    next();
  } catch (error) {
    console.error('Anti-cheat validation error:', error);
    next(); // Don't block on anti-cheat errors
  }
}
