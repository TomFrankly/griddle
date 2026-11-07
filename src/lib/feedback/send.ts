/** Sends Send feedback's message to the Worker (worker/feedback.ts), which saves it in Notion. */
import type { FeedbackAttachment } from './attachments';

export type FeedbackKind = 'bug' | 'idea' | 'question' | 'other';

export type FeedbackRequest = {
	message: string;
	kind: FeedbackKind;
	diagnostics?: string;
	attachments?: FeedbackAttachment[];
	blocks?: unknown[];
	browser?: string;
	version?: string;
};

/** `error` is the server's code: not-configured, rate-limited, invalid, too-large, send-failed, offline, network. */
export type FeedbackResponse = { ok: boolean; error?: string; attachments?: 'sent' | 'dropped' };

export async function sendFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'offline' };
	try {
		const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
		const body = (await res.json().catch(() => ({}))) as FeedbackResponse;
		return res.ok ? { ok: true, attachments: body.attachments } : { ok: false, error: body.error ?? `http-${res.status}` };
	} catch {
		return { ok: false, error: 'network' };
	}
}

/** The browser and its major version, and the OS, in a few words (no full User-Agent). */
export function browserName(): string {
	const ua = navigator.userAgent;
	const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string; version: string }[]; platform?: string } }).userAgentData;
	const known = brands?.brands.find((b) => !/Not|Chromium/i.test(b.brand));
	const browser = known
		? `${known.brand} ${known.version}`
		: (/(Firefox|Edg|OPR|Chrome|Version)\/(\d+)/.exec(ua)?.slice(1).join(' ').replace(/^Version/, 'Safari').replace(/^Edg/, 'Edge') ?? 'Unknown browser');
	const os = brands?.platform || (/Mac OS X|Windows|Android|iPhone|iPad|Linux|CrOS/.exec(ua)?.[0].replace('Mac OS X', 'macOS').replace('CrOS', 'ChromeOS') ?? '');
	return [browser, os].filter(Boolean).join(' on ');
}
