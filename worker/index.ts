/**
 * The Worker in front of the static site. Only /api/* reaches it (wrangler.jsonc
 * run_worker_first); every other path is served from the built assets directly.
 */
import { handleFeedback, type FeedbackEnv } from './feedback';

type Env = FeedbackEnv & { ASSETS: { fetch(req: Request): Promise<Response> } };

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		if (url.pathname === '/api/feedback') {
			return handleFeedback(req, env, req.headers.get('CF-Connecting-IP') ?? 'unknown');
		}
		if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
		return env.ASSETS.fetch(req);
	}
};
