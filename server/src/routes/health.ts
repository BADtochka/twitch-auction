import { Elysia } from 'elysia';
import { getLogs } from '../logger';

export const healthRoutes = new Elysia()
  .get('/health', () => ({ ok: true, uptime: process.uptime() }))
  .get('/debug/logs', () => getLogs());
