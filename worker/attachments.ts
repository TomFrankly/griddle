/**
 * Screenshots sent with feedback. The app already scales and compresses them
 * (src/lib/feedback/attachments.ts); these limits stop anything larger.
 */
export const MAX_ATTACHMENTS = 5;
/** Base64 characters: about 1.5 MB of picture each, 6 MB in all. */
export const MAX_ATTACHMENT_CHARS = 2_000_000;
export const MAX_TOTAL_CHARS = 8_000_000;
const TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

export type Attachment = { filename: string; contentType: string; data: string };

/** The attachments, renamed screenshot-N.<ext>, or null when any is not allowed. */
export function checkAttachments(value: unknown): Attachment[] | null {
	if (value == null) return [];
	if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) return null;
	const out: Attachment[] = [];
	let total = 0;
	for (const [i, item] of value.entries()) {
		const { contentType, data } = (item ?? {}) as { contentType?: unknown; data?: unknown };
		if (typeof contentType !== 'string' || !TYPES[contentType]) return null;
		if (typeof data !== 'string' || !data || data.length > MAX_ATTACHMENT_CHARS) return null;
		if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
		total += data.length;
		if (total > MAX_TOTAL_CHARS) return null;
		// Our own names: nothing the client sends ends up as a filename.
		out.push({ filename: `screenshot-${i + 1}.${TYPES[contentType]}`, contentType, data });
	}
	return out;
}
