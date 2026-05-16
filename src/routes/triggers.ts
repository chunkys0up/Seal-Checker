import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { settings } from '@devvit/web/server';

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
  const input = await c.req.json<OnPostSubmitRequest>();

  const exemptFlairs = (await settings.get<string>('exemptFlairs'))?.split(',');
  const timeLimit = await settings.get<number>('timeLimit');
  const actionOnExpiry = await settings.get<string>('actionOnExpiry');

  const postFlair = input.post?.linkFlair?.text;

  // if the post has an exempt flair then skip it
  if (exemptFlairs && postFlair && exemptFlairs.includes(postFlair)) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  
});
