/**
 * Cloudflare Worker entry point
 *
 * Routes:
 *   /mcp          → MCP server (stateless Streamable HTTP, DO'suz)
 *   /api/session  → salt-okunur session/draft okuma (frontend import akışı)
 *   *             → static assets (dist/, SPA fallback)
 */

import { handleMcp } from './mcp';
import { handleApiSession } from './api';

export interface Env {
  SCHEDULE_KV: KVNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/mcp') {
      return handleMcp(request, env);
    }

    if (url.pathname === '/api/session') {
      return handleApiSession(request, env);
    }

    // Diğer tüm istekler statik asset'lere (assets bindingwrangler.jsonc'de tanımlı)
    return env.ASSETS.fetch(request);
  }
};
