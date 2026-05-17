import { Hono } from 'hono';


export const scheduler = new Hono();

scheduler.post('/one-off-source-time-limit', async (c) => {
    // do something
});