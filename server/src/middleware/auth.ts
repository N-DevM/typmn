import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      username: string;
      role: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, username: true, role: true, status: true },
    });

    if (!user || user.status === 'BANNED') {
      res.status(401).json({ error: 'Account not found or banned' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      req.user = decoded;
    }
  } catch {
    // Token invalid/expired — continue without auth
  }
  next();
};
