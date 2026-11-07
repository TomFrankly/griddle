/**
 * The Notion blocks a feedback brings (the app makes them from its editor, see
 * src/lib/feedback/to-notion.ts). They go into the maker's own workspace, so only plain
 * writing gets through: text blocks, lists, quotes, code, dividers, and images that point
 * at one of the feedback's own attachments ("attachment:N"). Rich text keeps its text
 * (cleaned, see untrusted.ts) and formatting; anything else is left out. Links aren't
 * clickable: a link's address follows its text in brackets when the text doesn't show it,
 * so the text can't hide where it goes.
 */
import { cleanUserText } from './untrusted';

const TEXT_TYPES = [
	'paragraph',
	'heading_1',
	'heading_2',
	'heading_3',
	'bulleted_list_item',
	'numbered_list_item',
	'to_do',
	'quote',
	'toggle',
	'code'
] as const;
const COLORS = new Set([
	'default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red',
	'gray_background', 'brown_background', 'orange_background', 'yellow_background', 'green_background',
	'blue_background', 'purple_background', 'pink_background', 'red_background'
]);
const ANNOTATIONS = ['bold', 'italic', 'strikethrough', 'underline', 'code'] as const;

/** Leaves room in the page's 100 for diagnostics and pictures no block points at. */
export const MAX_BLOCKS = 90;
/** All the text in the blocks together: the message and picked elements' details. */
export const MAX_BLOCK_TEXT = 20_000;
/** Notion takes children two levels deep in one request. */
const MAX_DEPTH = 2;
const TEXT_CHUNK = 2000;

type Json = Record<string, unknown>;
export type Block = { type: string; [key: string]: unknown };

/** An image block waiting for attachment N. */
export function attachmentIndex(block: Block): number | null {
	if (block.type !== 'image') return null;
	const id = ((block.image as Json | undefined)?.file_upload as Json | undefined)?.id;
	const m = typeof id === 'string' ? /^attachment:(\d{1,2})$/.exec(id) : null;
	return m ? Number(m[1]) : null;
}

function cleanRichText(value: unknown, budget: { left: number }): Json[] {
	if (!Array.isArray(value)) return [];
	const out: Json[] = [];
	for (const run of value.slice(0, 100)) {
		const r = (run ?? {}) as Json;
		const text = (r.text ?? {}) as Json;
		const raw = typeof text.content === 'string' ? text.content : typeof r.plain_text === 'string' ? r.plain_text : '';
		const link = ((text.link ?? null) as Json | null)?.url ?? r.href;
		const url = typeof link === 'string' && /^https?:\/\//.test(link) ? cleanUserText(link).slice(0, 2000) : '';
		const content = cleanUserText(raw) + (url && !raw.includes(url) ? ` (${url})` : '');
		if (!content) continue;
		const kept = content.slice(0, Math.min(TEXT_CHUNK, budget.left));
		budget.left -= kept.length;
		if (!kept) break;
		const a = (r.annotations ?? {}) as Json;
		const annotations: Json = {};
		for (const key of ANNOTATIONS) if (a[key] === true) annotations[key] = true;
		if (typeof a.color === 'string' && COLORS.has(a.color) && a.color !== 'default') annotations.color = a.color;
		out.push({ type: 'text', text: { content: kept }, ...(Object.keys(annotations).length ? { annotations } : {}) });
	}
	return out;
}

function cleanBlock(value: unknown, depth: number, budget: { left: number }): Block | null {
	const block = (value ?? {}) as Block;
	const type = block.type;
	if (type === 'divider') return { type: 'divider', divider: {} };
	if (type === 'image') {
		const at = attachmentIndex(block);
		return at === null ? null : { type: 'image', image: { type: 'file_upload', file_upload: { id: `attachment:${at}` } } };
	}
	if (!(TEXT_TYPES as readonly string[]).includes(type)) return null;
	const body = (block[type] ?? {}) as Json;
	const clean: Json = { rich_text: cleanRichText(body.rich_text, budget) };
	if (typeof body.color === 'string' && COLORS.has(body.color)) clean.color = body.color;
	if (type === 'to_do') clean.checked = body.checked === true;
	if (type === 'code') clean.language = 'plain text';
	if (depth < MAX_DEPTH && Array.isArray(body.children) && type !== 'code') {
		const children = cleanBlocks(body.children, depth + 1, budget);
		if (children.length) clean.children = children;
	}
	return { type, [type]: clean };
}

function cleanBlocks(value: unknown[], depth: number, budget: { left: number }): Block[] {
	const out: Block[] = [];
	for (const item of value) {
		if (out.length >= MAX_BLOCKS) break;
		const block = cleanBlock(item, depth, budget);
		if (block) out.push(block);
	}
	return out;
}

/** The blocks with everything else left out, or null when there are none to use. */
export function checkBlocks(value: unknown): Block[] | null {
	if (!Array.isArray(value) || value.length === 0) return null;
	const blocks = cleanBlocks(value, 1, { left: MAX_BLOCK_TEXT });
	return blocks.length ? blocks : null;
}

/**
 * Puts the uploaded pictures in: an image block for attachment N gets upload N's id, or is
 * left out when that upload failed. Pictures no block points at go at the end.
 */
export function placeUploads(blocks: Block[], uploads: (string | null)[]): Block[] {
	const used = new Set<number>();
	const fill = (list: Block[]): Block[] =>
		list.flatMap((block) => {
			const at = attachmentIndex(block);
			if (at !== null) {
				const id = uploads[at];
				if (!id) return [];
				used.add(at);
				return [{ type: 'image', image: { type: 'file_upload', file_upload: { id } } }];
			}
			const body = block[block.type] as Json | undefined;
			if (Array.isArray(body?.children)) return [{ ...block, [block.type]: { ...body, children: fill(body.children as Block[]) } }];
			return [block];
		});
	const out = fill(blocks);
	uploads.forEach((id, i) => {
		if (id && !used.has(i)) out.push({ type: 'image', image: { type: 'file_upload', file_upload: { id } } });
	});
	return out;
}
