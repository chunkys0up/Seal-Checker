import { Hono } from 'hono';
import type {
  SettingsValidationRequest,
  SettingsValidationResponse,
} from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';

export const settings = new Hono();

settings.post('/validate-flair', async (c) => {
  const { value } = await c.req.json<SettingsValidationRequest<string>>();

  if (!value || value.trim() === '') {
    return c.json<SettingsValidationResponse>({ success: true });
  }

  const { subredditName } = context;

  const validFlairs = await reddit.getPostFlairTemplates(subredditName);
  const validFlairTexts = validFlairs.map((f) => f.text.toLowerCase());

  const inputFlairs = value.split(',').map((f) => f.trim().toLowerCase());

  // check for empty entries from trailing/double commas
  if (inputFlairs.some((f) => f === '')) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: 'Invalid format — check for trailing or double commas',
    });
  }

  // check each flair actually exists in the subreddit
  const invalidFlairs = inputFlairs.filter((f) => !validFlairTexts.includes(f));

  if (invalidFlairs.length > 0) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: `These flairs don't exist in this subreddit: ${invalidFlairs.join(', ')}`,
    });
  }

  return c.json<SettingsValidationResponse>({ success: true });
});

settings.post('/validate-time', async (c) => {
  const { value } = await c.req.json<SettingsValidationRequest<number>>();

  if (!value || value < 0) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: `Enter a positive number`,
    });
  }

  return c.json<SettingsValidationResponse>({ success: true });
});

settings.post('/validate-action', async (c) => {
  const { value } = await c.req.json<SettingsValidationRequest<string>>();
  const actions = ['lock', 'delete', 'report'];

  if (!value || value.trim() === '') {
    return c.json<SettingsValidationResponse>({ success: true });
  }

  if (!actions.includes(value)) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: `Enter a valid action: lock, delete, or report`,
    });
  }

  return c.json<SettingsValidationResponse>({ success: true });
});
