import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { reddit, settings, scheduler } from '@devvit/web/server';
import { urlChecker } from '../core/urlChecker';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  console.log('App installed to subreddit: r/' + input.subreddit?.name);

  return c.json<TriggerResponse>(
    {
      status: 'success',
    },
    200
  );
});

triggers.post('/on-post-submit', async (c) => {
  console.log("Running on post submit");

  const input = await c.req.json<OnPostSubmitRequest>();
  const titleAndBody =
    'title: ' + input.post?.title + '\n\n' + 'body: ' + input.post?.selftext;

  const exemptFlairs = (await settings.get<string>('exemptFlairs'))?.split(',');
  const aiEnabled = await settings.get<boolean>('aiEnabled');
  const apiKey = await settings.get<string>('geminiApiKey');
  const timeLimit = await settings.get<number>('timeLimit');
  const actionOnExpiry = await settings.get<string>('actionOnExpiry');

  const postFlair = input.post?.linkFlair?.text;
  console.log("post flair:", postFlair);

  // if the post has an exempt flair then skip it, or has none
  if (
    !postFlair ||
    (exemptFlairs && postFlair && exemptFlairs.includes(postFlair))
  ) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  // check if there's a url.
  const urlExists = urlChecker(titleAndBody);

  if (urlExists) {
    if (aiEnabled) {
    }

    return c.json<TriggerResponse>({ status: 'ok' });
  }

  // schedule a job to check in timeLimit
  if (!timeLimit || !input.post) {
    console.log('timeLimit not set or received');
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  const runAt = new Date(Date.now() + timeLimit * 60 * 60 * 1000);
  const postId = input.post.id;
  console.log(`title: ${input.post.title} postId: ${postId}`);

  await scheduler.runJob({
    name: 'timeLimitScheduler', // must match devvit.json
    data: { postId: postId },
    runAt,
  });

  await reddit.submitComment({
    id: postId as `t3_${string}`,
    text: "test: need url",
  })

  return c.json<TriggerResponse>({ status: 'ok' });
});
