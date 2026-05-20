import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { triggers } from './routes/triggers';
import {settings } from './routes/settings';
import { scheduler } from './routes/scheduler';
const app = new Hono();
const internal = new Hono();

internal.route('/triggers', triggers);
internal.route('/settings', settings);
internal.route('/scheduler', scheduler);

app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
