/**
 * Each feedback becomes a row in the Griddle Feedback database, with the screenshots
 * uploaded into the page through Notion's File Upload API.
 *
 * Text goes in as plain rich text, never markup, so nothing the sender writes can format
 * or link anything in the page. The page starts with untrusted.ts's notice, red when the
 * feedback was flagged.
 */
import type { Attachment } from './attachments';
import { type Block, placeUploads } from './blocks';
import { noticeBlock } from './untrusted';

const API = 'https://api.notion.com/v1';
/** The version that addresses a database by its data source. */
export const VERSION = '2025-09-03';
/** Notion's limit for one rich text object. */
const TEXT_CHUNK = 2000;

export type FeedbackRow = {
	title: string;
	kind: string;
	browser: string;
	version: string;
	message: string;
	diagnostics: string;
	/** Why it looks written to steer an AI (untrusted.ts); empty when it doesn't. */
	flags: string[];
};

type RichText = { type: 'text'; text: { content: string } };

/** The text as rich text objects of at most 2,000 characters each. */
export function richText(text: string): RichText[] {
	const out: RichText[] = [];
	for (let i = 0; i < text.length; i += TEXT_CHUNK) out.push({ type: 'text', text: { content: text.slice(i, i + TEXT_CHUNK) } });
	return out;
}

/**
 * The body of the create-page request. uploads are the screenshots' upload ids by attachment
 * (null: that upload failed). With blocks the page is those blocks, each picture where it was
 * in the message; without, the message as text and the pictures after it.
 */
export function pageRequest(dataSourceId: string, row: FeedbackRow, uploads: (string | null)[], blocks: Block[] | null = null) {
	const children: unknown[] = blocks
		? [noticeBlock(row.flags), ...placeUploads(blocks, uploads)]
		: [
				noticeBlock(row.flags),
				...row.message.split(/\n{2,}/).map((p) => ({ type: 'paragraph', paragraph: { rich_text: richText(p) } })),
				...uploads
					.filter((id): id is string => !!id)
					.map((id) => ({ type: 'image', image: { type: 'file_upload', file_upload: { id } } }))
			];
	if (row.diagnostics) {
		children.push(
			{ type: 'heading_3', heading_3: { rich_text: richText('Diagnostics') } },
			{ type: 'code', code: { language: 'plain text', rich_text: richText(row.diagnostics) } }
		);
	}
	return {
		parent: { type: 'data_source_id', data_source_id: dataSourceId },
		properties: {
			Name: { title: richText(row.flags.length ? `Flagged · ${row.title}` : row.title) },
			Kind: { select: { name: row.kind } },
			Browser: { rich_text: richText(row.browser) },
			Version: { rich_text: richText(row.version) }
		},
		children
	};
}

function base64Bytes(data: string): Uint8Array<ArrayBuffer> {
	const raw = atob(data);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes;
}

/**
 * Makes the row. Returns whether it was made and whether every screenshot made it into the
 * page. A screenshot that won't upload is left out rather than losing the row.
 */
export async function saveToNotion(
	token: string,
	dataSourceId: string,
	row: FeedbackRow,
	attachments: Attachment[],
	blocks: Block[] | null = null,
	fetcher: typeof fetch = fetch
): Promise<{ saved: boolean; picturesSaved: boolean }> {
	const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': VERSION };
	const upload = async (a: Attachment): Promise<string | null> => {
		try {
			const made = await fetcher(`${API}/file_uploads`, {
				method: 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'single_part', filename: a.filename, content_type: a.contentType })
			});
			if (!made.ok) throw new Error(`create ${made.status} ${await made.text()}`);
			const { id } = (await made.json()) as { id: string };
			const form = new FormData();
			form.append('file', new Blob([base64Bytes(a.data)], { type: a.contentType }), a.filename);
			const sent = await fetcher(`${API}/file_uploads/${id}/send`, { method: 'POST', headers, body: form });
			if (!sent.ok) throw new Error(`send ${sent.status} ${await sent.text()}`);
			return id;
		} catch (error) {
			console.error('[feedback] notion upload', (error as Error).message);
			return null;
		}
	};
	const ids = await Promise.all(attachments.map(upload));
	const picturesSaved = ids.every((id) => id !== null);
	const create = (withBlocks: Block[] | null) =>
		fetcher(`${API}/pages`, {
			method: 'POST',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify(pageRequest(dataSourceId, row, ids, withBlocks))
		});
	try {
		let res = await create(blocks);
		if (!res.ok && blocks && res.status === 400) {
			// Notion refused a block: the message as plain text still makes the row.
			console.error('[feedback] notion refused the blocks', await res.text());
			res = await create(null);
		}
		if (!res.ok) throw new Error(`page ${res.status} ${await res.text()}`);
		return { saved: true, picturesSaved };
	} catch (error) {
		console.error('[feedback] notion', (error as Error).message);
		return { saved: false, picturesSaved: false };
	}
}
