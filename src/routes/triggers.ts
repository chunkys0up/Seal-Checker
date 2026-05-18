import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostSubmitRequest,
  OnCommentCreateRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import {
  reddit,
  redis,
  settings,
  scheduler,
  context,
} from '@devvit/web/server';
import { findUrls, categorizeDomains } from '../core/domainVerifier';
import { buildURLVerifiedComment } from '../core/commentBuilder';
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
  console.log('\nRunning on post submit');

  const input = await c.req.json<OnPostSubmitRequest>();
  const titleAndBody =
    'title: ' + input.post?.title + '\n\n' + 'body: ' + input.post?.selftext;

  const urlFlairs = (await settings.get<string>('urlFlairs'))?.split(',');
  const timeLimit = await settings.get<number>('timeLimit');
  const actionOnExpiry = await settings.get<string>('actionOnExpiry');

  const postFlair = input.post?.linkFlair?.text;
  console.log('post flair:', postFlair);

  // only continue if the post has a flair we need to check
  if (
    !postFlair ||
    !urlFlairs?.includes(postFlair) ||
    !timeLimit ||
    !input.post
  ) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  const postId = input.post.id;
  let commentText = '';

  const foundUrls = findUrls(titleAndBody);

  /**
   * If there are urls,
   * Create message based on if they are verified or not
   * if not verified, send mod mail of all unverified links
   * Then if ai is enabled
   * - gives chance to change some unverified links to verified
   * - Gives 1-2 sentence quick summary of what the article was about
   * - if there's a bit of clickbait then mention it.
   */
  console.log('found urls', foundUrls);
  if (foundUrls.length > 0) {
    const { verified, unverified } = categorizeDomains(foundUrls);
    console.log('verified urls:', verified);
    console.log('unverified urls:', unverified);

    commentText += buildURLVerifiedComment(verified, unverified);

    if (unverified.length > 0) {
      await reddit.sendPrivateMessage({
        to: `/r/${context.subredditName}`,
        subject: 'Unverified source domain - manual review needed',
        text: `A post has been submitted with URLs from unverified domains.\n\nPost: https://www.reddit.com/r/${context.subredditName}/comments/${postId}\n\nUnverified domain(s):\n${unverified.join('\n')}\n\nAll URL(s) found:\n${foundUrls.join('\n')}`,
      });
    }
  } else {
    commentText += `No verifiable source URL was found in this post. Please provide a link to a credible source within ${timeLimit} minutes or this post may be actioned.\n\nIf your source is from a credible domain not yet on our verified list, please contact the moderators so it can be considered for inclusion\n\n`;
  }

  const botComment = await reddit.submitComment({
    id: postId as `t3_${string}`,
    text: commentText.trimEnd(),
  });

  if (foundUrls.length == 0) {
    const action = actionOnExpiry ? actionOnExpiry : 'none';

    const runAt = new Date(Date.now() + timeLimit * 60 * 1000);
    console.log(`title: ${input.post.title} postId: ${postId}`);
    const jobId = await scheduler.runJob({
      name: 'timeLimitScheduler',
      data: { postId, action },
      runAt,
    });

    // add postId: {authorId, botcommentId, schedulerId}
    await redis.hSet(postId, {
      authorId: input.post.authorId,
      botCommentId: botComment.id,
      schedulerId: jobId,
    });
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-poster-comment-submit', async (c) => {
  const input = await c.req.json<OnCommentCreateRequest>();

  if (!input || !input.comment || !input.author || !input.post) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  const postInfo = await redis.hGetAll(input.comment.postId);

  if (!postInfo) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  // found author comment
  if (postInfo.authorId == input.author.id) {
    const foundUrls = findUrls(input.comment.body);

    // found url, delete the scheduler and redis key-values
    if (foundUrls.length > 0) {
      await redis.del(input.post.id);

      if (postInfo.jobId) {
        await scheduler.cancelJob(postInfo.jobId);
      }
    }
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
