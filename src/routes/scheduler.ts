import { Hono } from 'hono';
import { reddit, TaskRequest, TaskResponse } from '@devvit/web/server';

export const scheduler = new Hono();

scheduler.post('/one-off-source-time-limit', async (c) => {
  const req = await c.req.json<TaskRequest<{ postId: string }>>();
  const postId = req.data.postId;

  console.log('from scheduler postId:', postId);

  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
