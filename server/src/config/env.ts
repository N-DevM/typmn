import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env from server dir first, then root
const serverEnv = path.resolve(__dirname, '../../.env');
const rootEnv = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: fs.existsSync(serverEnv) ? serverEnv : rootEnv });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: parseInt(process.env.API_PORT || '5000', 10),
  SOCKET_PORT: parseInt(process.env.SOCKET_PORT || '5001', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
};
