import { Hono } from 'hono';
import { reddit, redis, TaskRequest, TaskResponse } from '@devvit/web/server';

export const scheduler = new Hono();

scheduler.post('/one-off-source-time-limit', async (c) => {
  const req = await c.req.json<TaskRequest<{ postId: string, action: string }>>();
  const postId = req.data.postId;

  const postInfo = await redis.hGetAll(postId);
  if (!postInfo || Object.keys(postInfo).length === 0) {
    console.log("postId from Scheduler not found:", postId);
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  }

  const action = req.data.action;

  if (!action || action === 'none') {
    await redis.del(postId);
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  }

  // lock, delete, report
  const post = await reddit.getPostById(postId as `t3_${string}`);

  switch(action) {
    case 'lock':
      console.log("Scheduler locking post");
      await post.lock();
      break;
    case 'delete':
      console.log("Scheduler deleting post");
      await post.delete();
      break;
    case 'report':
      console.log("Scheduler reports post");
      await reddit.report(post, {
        reason: 'Poster did not link a url to the tagged post.',
      });
      break;
  }

  // delete redis key-value
  await redis.del(postId);

  // console.log('from scheduler postId:', postId);

  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
