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

  const urlFlairs = (await settings.get<string>('urlFlairs'))?.split(',').map(f => f.trim());
  const timeLimit = await settings.get<number>('timeLimit');
  const actionOnExpiry = await settings.get<string>('actionOnExpiry');

  const postFlair = input.post?.linkFlair?.text;
  console.log('post flair:', postFlair);

  // only continue if the post has a flair we need to check
  if (
    !postFlair ||
    !urlFlairs?.includes(postFlair) ||
    timeLimit == null ||
    !input.post
  ) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  const postId = input.post.id;
  let commentText = `No verifiable source URL was found in this post. Please provide a link to a credible source within ${timeLimit} minute(s) or this post may be deleted or locked.\n\nIf your source is from a credible domain not yet on our verified list, please contact the moderators so it can be considered for inclusion\n\n`;

  const foundUrls = findUrls(titleAndBody);

  /**
   * If there are urls,
   * Create message based on if they are verified or not
   * if not verified, send mod mail of all unverified links
   */
  console.log('found urls', foundUrls);
  if (foundUrls.length > 0) {
    const { verified, unverified } = categorizeDomains(foundUrls);
    console.log('verified urls:', verified);
    console.log('unverified urls:', unverified);

    commentText = buildURLVerifiedComment(verified, unverified);

    if (unverified.length > 0) {
      await reddit.sendPrivateMessage({
        to: `/r/${context.subredditName}`,
        subject: 'Unverified source domain - manual review needed',
        text: `A post has been submitted with URLs from unverified domains.\n\nPost: https://www.reddit.com/r/${context.subredditName}/comments/${postId}\n\nUnverified domain(s):\n${unverified.join('\n')}\n\nAll URL(s) found:\n${foundUrls.join('\n')}`,
      });
    }
  }

  const botComment = await reddit.submitComment({
    id: postId as `t3_${string}`,
    text: commentText.trimEnd(),
  });

  if (foundUrls.length === 0 && input.post.authorId) {
    const action = actionOnExpiry ? actionOnExpiry : 'none';
    console.log("Action when scheduler happens:", action);

    const runAt = new Date(Date.now() + timeLimit * 60 * 1000);
    const schedulerId = await scheduler.runJob({
      name: 'timeLimitScheduler',
      data: { postId, action },
      runAt,
    });

    // add postId: {authorId, botcommentId, schedulerId}
    await redis.hSet(postId, {
      authorId: input.post.authorId,
      botCommentId: botComment.id,
      schedulerId: schedulerId,
    });
    await redis.expire(postId, timeLimit * 60 + 300);
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/on-poster-comment-submit', async (c) => {
  const input = await c.req.json<OnCommentCreateRequest>();

  if (!input || !input.comment || !input.author || !input.post) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  const postId = input.comment.postId;
  const postInfo = await redis.hGetAll(postId);

  if (!postInfo || Object.keys(postInfo).length === 0) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  // found author comment
  if (postInfo.authorId == input.author.id) {
    const foundUrls = findUrls(input.comment.body);

    // found url, delete the scheduler and redis key-values
    if (foundUrls.length > 0) {
      const { verified, unverified } = categorizeDomains(foundUrls);

      if (postInfo.botCommentId) {
        const botComment = await reddit.getCommentById(postInfo.botCommentId as `t1_${string}`);
        await botComment.edit({
          text: buildURLVerifiedComment(verified, unverified),
        });
      }

      if (unverified.length > 0) {
        await reddit.sendPrivateMessage({
          to: `/r/${context.subredditName}`,
          subject: 'Unverified source domain - manual review needed',
          text: `OP has provided URLs from unverified domains in a comment.\n\nPost: https://www.reddit.com/r/${context.subredditName}/comments/${postId}\n\nUnverified domain(s):\n${unverified.join('\n')}\n\nAll URL(s) found:\n${foundUrls.join('\n')}`,
        });
      }

      if (postInfo.schedulerId) {
        await scheduler.cancelJob(postInfo.schedulerId);
      }

      await redis.del(postId);
    }
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
