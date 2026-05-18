import { Hono } from 'hono';
import { reddit, redis, TaskRequest, TaskResponse } from '@devvit/web/server';

export const scheduler = new Hono();

scheduler.post('/one-off-source-time-limit', async (c) => {
  const req = await c.req.json<TaskRequest<{ postId: string, action: string }>>();
  const postId = req.data.postId;

  const postInfo = await redis.hGetAll(postId);
  if (!postInfo) {
    console.log("postId from Scheduler not found:", postId);
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  }

  // lock, delete, report
  const post = await reddit.getPostById(postId as `t3_${string}`);
  const action = req.data.postId;

  switch(action) {
    case 'lock':
      await post.lock();
      break;
    case 'delete':
      await post.delete();
      break;
    case 'report':
      await reddit.report(post, {
        reason: 'Poster did not link a url to the tagged post.',
      });
      break;
  }

  // delete redis key-value
  await redis.del(postId);

  console.log('from scheduler postId:', postId);

  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
