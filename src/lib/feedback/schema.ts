/**
 * The Send feedback message box's document: paragraphs with bold, italic, strikethrough,
 * code and links, and pictures (screenshots and picked parts). A picked part's picture
 * carries what it is (`about`, from picked-element.ts), which goes out after it as code.
 */
import { Schema, type Mark, type Node as PMNode } from 'prosemirror-model';

export const schema = new Schema({
	nodes: {
		doc: { content: 'block+' },
		paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0], parseDOM: [{ tag: 'p' }, { tag: 'div' }] },
		image: {
			group: 'block',
			atom: true,
			draggable: true,
			selectable: true,
			attrs: { src: {}, about: { default: '' } },
			toDOM: (n) => ['img', { src: n.attrs.src, alt: n.attrs.about ? 'Picked part' : 'Screenshot' }],
			parseDOM: [{ tag: 'img[src^="data:image/"]', getAttrs: (d) => ({ src: (d as HTMLImageElement).getAttribute('src') }) }]
		},
		text: { group: 'inline' },
		hard_break: { group: 'inline', inline: true, selectable: false, toDOM: () => ['br'], parseDOM: [{ tag: 'br' }] }
	},
	marks: {
		bold: { toDOM: () => ['strong', 0], parseDOM: [{ tag: 'strong' }, { tag: 'b' }] },
		italic: { toDOM: () => ['em', 0], parseDOM: [{ tag: 'em' }, { tag: 'i' }] },
		strike: { toDOM: () => ['s', 0], parseDOM: [{ tag: 's' }, { tag: 'del' }] },
		code: { toDOM: () => ['code', 0], parseDOM: [{ tag: 'code' }] },
		link: {
			attrs: { href: {} },
			inclusive: false,
			toDOM: (m) => ['a', { href: m.attrs.href, rel: 'noreferrer', target: '_blank' }, 0],
			parseDOM: [{ tag: 'a[href]', getAttrs: (d) => ({ href: (d as HTMLAnchorElement).getAttribute('href') }) }]
		}
	}
});

/** The most screenshots one message sends. */
export const MAX_FEEDBACK_IMAGES = 5;

export type FeedbackMessage = {
	text: string;
	/** Data URLs of the pictures, in the order the text numbers them. */
	images: string[];
};

const WRAP: Record<string, [string, string]> = { bold: ['**', '**'], italic: ['_', '_'], strike: ['~~', '~~'], code: ['`', '`'] };

function wrapMarks(text: string, marks: readonly Mark[]): string {
	let out = text;
	for (const mark of marks) {
		const w = WRAP[mark.type.name];
		if (w) out = w[0] + out + w[1];
	}
	const href = marks.find((m) => m.type.name === 'link')?.attrs.href;
	return href && href !== text ? `[${out}](${href})` : out;
}

/**
 * The message as plain text (markdown-ish: **bold**, _italic_, `code`, [text](link)), with
 * each picture as "[Screenshot N]" where it was and a picked part's details after it.
 * The text is what the row's title and the plain-text fallback use.
 */
export function feedbackMessage(doc: PMNode): FeedbackMessage {
	const images: string[] = [];
	const lines: string[] = [];
	doc.forEach((node) => {
		if (node.type.name === 'image') {
			images.push(node.attrs.src);
			lines.push(`[Screenshot ${images.length}]`);
			if (node.attrs.about) lines.push(node.attrs.about);
			return;
		}
		let line = '';
		node.forEach((child) => {
			if (child.isText) line += wrapMarks(child.text ?? '', child.marks);
			else if (child.type.name === 'hard_break') line += '\n';
		});
		lines.push(line);
	});
	return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), images };
}

/** True when the message has words or a picture. */
export function feedbackHasContent(doc: PMNode): boolean {
	if (doc.textContent.trim()) return true;
	let found = false;
	doc.descendants((n) => {
		if (n.type.name === 'image') found = true;
		return !found;
	});
	return found;
}

type RichText = { type: 'text'; text: { content: string; link?: { url: string } }; annotations?: Record<string, boolean> };
type Block = { type: string; [key: string]: unknown };

const ANNOTATION: Record<string, string> = { bold: 'bold', italic: 'italic', strike: 'strikethrough', code: 'code' };

function richText(node: PMNode): RichText[] {
	const out: RichText[] = [];
	node.forEach((child) => {
		const content = child.isText ? (child.text ?? '') : child.type.name === 'hard_break' ? '\n' : '';
		if (!content) return;
		const annotations: Record<string, boolean> = {};
		for (const m of child.marks) if (ANNOTATION[m.type.name]) annotations[ANNOTATION[m.type.name]] = true;
		const href = child.marks.find((m) => m.type.name === 'link')?.attrs.href;
		out.push({
			type: 'text',
			text: { content, ...(href ? { link: { url: href } } : {}) },
			...(Object.keys(annotations).length ? { annotations } : {})
		});
	});
	return out;
}

/**
 * The message as Notion blocks. Each picture becomes an image block pointing at its
 * attachment ("attachment:N"); the server uploads it and puts it there. attachmentOf[i] is
 * picture i's place in the attachments, or null when it isn't sent (it's left out). A picked
 * part's details follow its picture as a plain-text code block.
 */
export function feedbackBlocks(doc: PMNode, attachmentOf: (number | null)[]): Block[] {
	const blocks: Block[] = [];
	let i = 0;
	doc.forEach((node) => {
		if (node.type.name === 'image') {
			const at = attachmentOf[i++];
			if (at != null) blocks.push({ type: 'image', image: { type: 'file_upload', file_upload: { id: `attachment:${at}` } } });
			if (node.attrs.about) blocks.push({ type: 'code', code: { language: 'plain text', rich_text: [{ type: 'text', text: { content: node.attrs.about } }] } });
			return;
		}
		const rich = richText(node);
		// Empty lines between paragraphs are spacing in the box, not blocks.
		if (rich.length) blocks.push({ type: 'paragraph', paragraph: { rich_text: rich } });
	});
	return blocks;
}
