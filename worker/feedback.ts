/**
 * POST /api/feedback: saves feedback from the app's Send feedback form as a row in the
 * Griddle Feedback database in Notion, screenshots included.
 *
 * Secrets (Cloudflare): NOTION_FEEDBACK_TOKEN, an internal integration token that can insert
 * into the database, and NOTION_FEEDBACK_DATA_SOURCE_ID, the database's data source. Without
 * them the endpoint answers 503 not-configured.
 *
 * Griddle has no accounts, so the gates are: same-site requests only, a size cap, and a
 * per-address limit of RATE_MAX sends an hour (best effort: per Worker instance).
 */
import { checkAttachments } from './attachments';
import { checkBlocks } from './blocks';
import { saveToNotion } from './notion';
import { blocksText, cleanUserText, injectionFlags } from './untrusted';

export type FeedbackEnv = {
	NOTION_FEEDBACK_TOKEN?: string;
	NOTION_FEEDBACK_DATA_SOURCE_ID?: string;
};

const KINDS = ['bug', 'idea', 'question', 'other'] as const;
type Kind = (typeof KINDS)[number];

const MAX_MESSAGE = 5000;
const MAX_DIAGNOSTICS = 4000;
const MAX_SHORT = 200;
/** Bytes: 8 MB of base64 pictures plus the text around them. */
const MAX_BODY = 9_000_000;

const RATE_WINDOW_MS = 60 * 60 * 1000;
export const RATE_MAX = 5;
const recent = new Map<string, number[]>();

function rateLimited(key: string, now = Date.now()): boolean {
	const times = (recent.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
	if (times.length >= RATE_MAX) {
		recent.set(key, times);
		return true;
	}
	times.push(now);
	recent.set(key, times);
	return false;
}

/** Forget the rate limit's memory (tests). */
export function resetRateLimit() {
	recent.clear();
}

function reply(status: number, body: Record<string, unknown>) {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

const short = (value: unknown) => (typeof value === 'string' ? cleanUserText(value).trim().slice(0, MAX_SHORT) : '');

export async function handleFeedback(req: Request, env: FeedbackEnv, client: string, fetcher: typeof fetch = fetch): Promise<Response> {
	if (req.method !== 'POST') return reply(405, { error: 'method' });
	// Only the app itself: a browser always sends Origin on a cross-site POST.
	const origin = req.headers.get('Origin');
	if (origin && origin !== new URL(req.url).origin) return reply(403, { error: 'origin' });
	if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY) return reply(413, { error: 'too-large' });

	const token = env.NOTION_FEEDBACK_TOKEN;
	const dataSource = env.NOTION_FEEDBACK_DATA_SOURCE_ID;
	if (!token || !dataSource) return reply(503, { error: 'not-configured' });

	let raw: string;
	try {
		raw = await req.text();
	} catch {
		return reply(400, { error: 'invalid' });
	}
	if (raw.length > MAX_BODY) return reply(413, { error: 'too-large' });
	let body: { message?: unknown; kind?: unknown; diagnostics?: unknown; attachments?: unknown; blocks?: unknown; browser?: unknown; version?: unknown };
	try {
		body = JSON.parse(raw);
	} catch {
		return reply(400, { error: 'invalid' });
	}

	const rawMessage = typeof body.message === 'string' ? body.message : '';
	const rawDiagnostics = typeof body.diagnostics === 'string' ? body.diagnostics : '';
	if (rawMessage.length > MAX_MESSAGE * 2 || rawDiagnostics.length > MAX_DIAGNOSTICS * 2) return reply(400, { error: 'invalid' });
	const message = cleanUserText(rawMessage).trim();
	const diagnostics = cleanUserText(rawDiagnostics).trim();
	if (!message || message.length > MAX_MESSAGE || diagnostics.length > MAX_DIAGNOSTICS) return reply(400, { error: 'invalid' });
	const attachments = checkAttachments(body.attachments);
	if (!attachments) return reply(400, { error: 'invalid' });
	if (rateLimited(client)) return reply(429, { error: 'rate-limited' });

	const kind: Kind = KINDS.includes(body.kind as Kind) ? (body.kind as Kind) : 'other';
	const flags = injectionFlags(rawMessage, rawDiagnostics, ...blocksText(body.blocks));
	if (flags.length) console.warn('[feedback] flagged', flags.join(', '));
	const result = await saveToNotion(
		token,
		dataSource,
		{
			title: message.split('\n')[0].slice(0, 80),
			kind: kind[0].toUpperCase() + kind.slice(1),
			browser: short(body.browser),
			version: short(body.version),
			message,
			diagnostics,
			flags
		},
		attachments,
		checkBlocks(body.blocks),
		fetcher
	);
	if (!result.saved) return reply(502, { error: 'send-failed' });
	return reply(200, { ok: true, ...(attachments.length ? { attachments: result.picturesSaved ? 'sent' : 'dropped' } : {}) });
}
