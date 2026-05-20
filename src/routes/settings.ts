import { Hono } from 'hono';
import type {
  SettingsValidationRequest,
  SettingsValidationResponse,
} from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';

export const settings = new Hono();

settings.post('/validate-flair-id', async (c) => {
  const { value } = await c.req.json<SettingsValidationRequest<string>>();

  if (!value || value.trim() === '') {
    return c.json<SettingsValidationResponse>({ success: true });
  }

  const { subredditName } = context;

  const inputIds = value.split(',').map((f) => f.trim());

  if (inputIds.some((f) => f === '')) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: 'Invalid format — check for trailing or double commas',
    });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidFormat = inputIds.filter((f) => !uuidRegex.test(f));
  if (invalidFormat.length > 0) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: `Invalid flair ID format: ${invalidFormat.join(', ')}`,
    });
  }

  const validFlairs = await reddit.getPostFlairTemplates(subredditName);
  const validIds = validFlairs.map((f) => f.id);

  const notFound = inputIds.filter((f) => !validIds.includes(f));
  if (notFound.length > 0) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: `These flair IDs don't exist in this subreddit: ${notFound.join(', ')}`,
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

settings.post('/validate-custom-domains', async (c) => {
  const { value } = await c.req.json<SettingsValidationRequest<string>>();

  if (!value || value.trim() === '') {
    return c.json<SettingsValidationResponse>({ success: true });
  }

  const domains = value.split(',').map((d) => d.trim().toLowerCase());

  if (domains.some((d) => d === '')) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: 'Invalid format — check for trailing or double commas',
    });
  }

  const invalidDomains = domains.filter((d) => !/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/.test(d));
  if (invalidDomains.length > 0) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: `Invalid domain format (no http://, no www., just the domain): ${invalidDomains.join(', ')}`,
    });
  }

  const seen = new Set<string>();
  const duplicates = domains.filter((d) => {
    if (seen.has(d)) return true;
    seen.add(d);
    return false;
  });

  if (duplicates.length > 0) {
    return c.json<SettingsValidationResponse>({
      success: false,
      error: `Duplicate domain(s) found: ${[...new Set(duplicates)].join(', ')}`,
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
