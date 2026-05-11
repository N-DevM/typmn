import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(20).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username required'),
  password: z.string().min(1, 'Password required'),
});

// Helper: Generate tokens
function generateTokens(user: { id: string; email: string; username: string; role: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

// Helper: Set cookie
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// ==========================================
// POST /api/auth/register
// ==========================================
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);

    // Check existing
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });
    if (existing) {
      const field = existing.email === data.email ? 'Email' : 'Username';
      res.status(409).json({ error: `${field} already taken` });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const emailVerifyToken = uuidv4();

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        emailVerifyToken,
        status: 'ACTIVE', // Auto-activate for now
        emailVerified: true, // Skip email verification for dev
        stats: { create: {} },
        streaks: { create: {} },
      },
      select: { id: true, email: true, username: true, role: true },
    });

    const { accessToken, refreshToken } = generateTokens(user);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      accessToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ==========================================
// POST /api/auth/login
// ==========================================
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.emailOrUsername },
          { username: data.emailOrUsername },
        ],
      },
      select: { id: true, email: true, username: true, role: true, passwordHash: true, status: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (user.status === 'BANNED') {
      res.status(403).json({ error: 'Account has been banned' });
      return;
    }

    const passwordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update last login
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const { accessToken, refreshToken } = generateTokens({
      id: user.id, email: user.email, username: user.username, role: user.role,
    });
    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      accessToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==========================================
// POST /api/auth/logout
// ==========================================
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

// ==========================================
// GET /api/auth/me
// ==========================================
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatar: true,
        country: true,
        bio: true,
        createdAt: true,
        stats: true,
        streaks: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==========================================
// POST /api/auth/refresh
// ==========================================
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, username: true, role: true, status: true },
    });

    if (!user || user.status === 'BANNED') {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const tokens = generateTokens(user);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({ accessToken: tokens.accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ==========================================
// POST /api/auth/forgot-password
// ==========================================
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: 'Email is required' }); return; }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether user exists
      res.json({ message: 'If an account exists with this email, a reset token has been generated.' });
      return;
    }

    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: resetToken, resetPasswordExpiry: resetExpiry },
    });

    // In production, send email with reset link. For now, return token directly.
    res.json({
      message: 'If an account exists with this email, a reset token has been generated.',
      // Include token in dev mode for testing
      ...(env.NODE_ENV === 'development' ? { resetToken, resetUrl: `${env.CLIENT_URL}/reset-password?token=${resetToken}` } : {}),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ==========================================
// POST /api/auth/reset-password
// ==========================================
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) { res.status(400).json({ error: 'Token and password are required' }); return; }
    if (password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetPasswordToken: null, resetPasswordExpiry: null },
    });

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
