import Redis from 'ioredis';

export const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  db: Number(process.env.REDIS_DB) || 1,
});

redisClient.on('connect', () => {
  console.log('🛢️ Redis client connected');
});

redisClient.on('error', (error) => {
  console.error('Redis error:', error);
});
