import Redis from 'ioredis';
import { env } from './env';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

export default redis;
