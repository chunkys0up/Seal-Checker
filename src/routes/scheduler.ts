import { Hono } from 'hono';
import { redis, TaskRequest, TaskResponse } from '@devvit/web/server';

export const scheduler = new Hono();

scheduler.post('/one-off-source-time-limit', async (c) => {
  const req = await c.req.json<TaskRequest<{ postId: string }>>();
  const postId = req.data.postId;

  const postInfo = await redis.hGetAll(postId);
  if (!postInfo) {
    console.log("postId from Scheduler not found:", postId);
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  }

  // lock, delete, report

  // delete redis key-value
  await redis.del(postId);

  console.log('from scheduler postId:', postId);

  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
