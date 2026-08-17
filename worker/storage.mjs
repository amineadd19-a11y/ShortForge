import { createHmac } from 'node:crypto';

const endpoint = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '');
const secret = process.env.OUTPUT_SIGNING_SECRET;

export function createOutputUrl(key, ttlSeconds = 3600) {
  if (!endpoint || !secret) throw new Error('Output storage signing is not configured.');
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac('sha256', secret).update(`${key}:${exp}`).digest('hex');
  return `${endpoint}/${key}?expires=${exp}&signature=${sig}`;
}
