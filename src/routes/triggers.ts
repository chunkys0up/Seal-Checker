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
import {
  findUrls,
  categorizeDomains,
  getEffectiveAllowlist,
} from '../core/domainVerifier';
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
  // console.log('\nRunning on post submit');

  const input = await c.req.json<OnPostSubmitRequest>();
  const titleAndBody =
    'title: ' + input.post?.title + '\n\n' + 'body: ' + input.post?.selftext;

  // Fetch the settings
  const urlPostFlairs = (await settings.get<string>('urlPostFlairs'))
    ?.split(',')
    .map((f) => f.trim());
  const timeLimit = await settings.get<number>('timeLimit');
  const actionOnExpiry = await settings.get<string>('actionOnExpiry');

  const postFlairId = input.post?.linkFlair?.templateId;
  // console.log('post flair:', postFlairId);

  // only continue if the post has a flair we need to check
  if (
    !postFlairId ||
    !urlPostFlairs?.includes(postFlairId) ||
    timeLimit == null ||
    !input.post
  ) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  const postId = input.post.id;
  console.log("Post Submit PostId", postId);
  let commentText = `No verifiable source URL was found in this post. Please provide a link to a credible source within ${timeLimit} minute(s) or this post may be deleted or locked.`;

  const textToSearch = input.post.url
    ? titleAndBody + '\n\n' + input.post.url
    : titleAndBody;
  const foundUrls = findUrls(textToSearch);

  /**
   * If there are urls,
   * Create message based on if they are verified or not
   * if not verified, send mod mail of all unverified links
   */
  // console.log('found urls', foundUrls);
  if (foundUrls.length > 0) {
    const effectiveAllowlist = await getEffectiveAllowlist();
    const { verified, unverified } = categorizeDomains(
      foundUrls,
      effectiveAllowlist
    );
    // console.log('verified urls:', verified);
    // console.log('unverified urls:', unverified);

    commentText = buildURLVerifiedComment(verified, unverified);

    if (unverified.length > 0) {
      try {
        await reddit.modMail.createModInboxConversation({
          subject: 'Unverified source domain - manual review needed',
          bodyMarkdown: `A post has been submitted with URLs from unverified domains.\n\nPost: https://www.reddit.com/r/${context.subredditName}/comments/${postId}\n\nUnverified domain(s):\n${unverified.map((d) => `- ${d}`).join('\n')}`,
          subredditId: context.subredditId,
        });
      } catch (err) {
        console.error('Failed to send modmail for unverified domains:', err);
      }
    }
  }

  const botComment = await reddit.submitComment({
    id: postId as `t3_${string}`,
    text: commentText.trimEnd(),
  });

  if (foundUrls.length === 0 && input.post.authorId) {
    const action = actionOnExpiry ? actionOnExpiry : 'none';
    // console.log('Action when scheduler happens:', action);

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
  console.log("Comment PostId:", postId);
  const postInfo = await redis.hGetAll(postId);

  if (!postInfo || Object.keys(postInfo).length === 0) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  // found author comment
  console.log('stored authorId:', postInfo.authorId, '| commenter id:', input.author.id, '| match:', postInfo.authorId == input.author.id);
  if (postInfo.authorId == input.author.id) {
    let commentBody = input.comment.body;

    // Reddit spam filter may remove URL-only comments before the trigger reads them.
    // Re-fetch and approve so we can read the actual content.
    if (commentBody === '[Removed by Reddit]' || commentBody === '[removed]') {
      try {
        const liveComment = await reddit.getCommentById(input.comment.id as `t1_${string}`);
        await liveComment.approve();
        commentBody = liveComment.body ?? commentBody;
      } catch (err) {
        console.error('Failed to approve/re-fetch removed comment:', err);
      }
    }

    console.log('comment body:', JSON.stringify(commentBody));
    const foundUrls = findUrls(commentBody);
    console.log('found urls in comment:', foundUrls);

    // found url, delete the scheduler and redis key-values
    if (foundUrls.length > 0) {
      const effectiveAllowlist = await getEffectiveAllowlist();
      const { verified, unverified } = categorizeDomains(
        foundUrls,
        effectiveAllowlist
      );

      if (postInfo.botCommentId) {
        const botComment = await reddit.getCommentById(
          postInfo.botCommentId as `t1_${string}`
        );
        await botComment.edit({
          text: buildURLVerifiedComment(verified, unverified),
        });
      }

      if (unverified.length > 0) {
        try {
          await reddit.modMail.createModInboxConversation({
            subject: 'Unverified source domain - manual review needed',
            bodyMarkdown: `OP has provided URLs from unverified domains in a comment.\n\nPost: https://www.reddit.com/r/${context.subredditName}/comments/${postId}\n\nUnverified domain(s):\n${unverified.map((d) => `- ${d}`).join('\n')}`,
            subredditId: context.subredditId,
          });
        } catch (err) {
          console.error('Failed to send modmail for unverified domains:', err);
        }
      }

      if (postInfo.schedulerId) {
        console.log('cancelling schedulerId:', postInfo.schedulerId);
        await scheduler.cancelJob(postInfo.schedulerId);
        console.log('scheduler cancelled');
      } else {
        console.log('no schedulerId found in postInfo');
      }

      await redis.del(postId);
    }
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
