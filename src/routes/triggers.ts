import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { reddit, settings, scheduler, context } from '@devvit/web/server';
import { findUrls, checkVerifiedDomain } from '../core/urlChecker';
import data from './../../devvit.json';

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

  const urlFlairs = (await settings.get<string>('urlFlairs'))?.split(',');
  const aiEnabled = await settings.get<boolean>('aiEnabled');
  const apiKey = await settings.get<string>('geminiApiKey');
  const timeLimit = await settings.get<number>('timeLimit');
  const actionOnExpiry = await settings.get<string>('actionOnExpiry');

  const postFlair = input.post?.linkFlair?.text;
  console.log("post flair:", postFlair);

  // only continue if the post has a flair we need to check
  if (!postFlair || !urlFlairs?.includes(postFlair)) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  if (!timeLimit || !input.post) {
    console.log('timeLimit not set or received');
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  const postId = input.post.id;
  let commentText = '';

  const foundUrls = findUrls(titleAndBody);

  if (foundUrls.length > 0) {
    const verifiedDomain = checkVerifiedDomain(foundUrls, data.permissions.http.domains);
    if (verifiedDomain) {
      commentText += `This post contains a source from a verified domain: **${verifiedDomain}**\n\n`;
    } else {
      commentText += `⚠️ Could not verify this source automatically. Mods have been notified to review.\n\n`;

      await reddit.sendPrivateMessage({
        to: `/r/${context.subredditName}`,
        subject: 'Unverified source domain - manual review needed',
        text: `A post has been submitted with a URL from an unverified domain.\n\nPost: https://www.reddit.com/r/${context.subredditName}/comments/${postId}\n\nURL(s) found:\n${foundUrls.join('\n')}`,
      });
    }

    if (aiEnabled) {
      // do something
    }
  } else {
    commentText += `No verifiable source URL was found in this post. Please provide a link to a credible source within ${timeLimit} minutes or this post may be actioned.\n\nIf your source is from a credible domain not yet on our verified list, please contact the moderators so it can be considered for inclusion in a future update.\n\n`;

    const runAt = new Date(Date.now() + timeLimit * 60 * 1000);
    console.log(`title: ${input.post.title} postId: ${postId}`);
    await scheduler.runJob({
      name: 'timeLimitScheduler',
      data: { postId },
      runAt,
    });
  }

  if (commentText) {
    await reddit.submitComment({
      id: postId as `t3_${string}`,
      text: commentText.trimEnd(),
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
