import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';

export const scheduler = new Hono();

scheduler.post('/one-off-source-time-limit', async (c) => {
  return c.json({ status: 'ok' }, 200);
});