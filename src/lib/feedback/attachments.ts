/**
 * Pictures in a feedback message, made small enough to send: each is scaled to at most
 * MAX_SIDE on its long side and saved as JPEG, or PNG when that is smaller (as it is for flat
 * UI shots). The server checks the same limits again.
 */
import { MAX_FEEDBACK_IMAGES } from './schema';

export const MAX_SIDE = 1600;
/** Base64 characters per attachment: about 1.5 MB of picture. */
export const MAX_ATTACHMENT_CHARS = 2_000_000;

export type FeedbackAttachment = { contentType: string; data: string };

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('image-load'));
		img.src = src;
	});
}

function base64Of(dataUrl: string): FeedbackAttachment | null {
	const match = /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(dataUrl);
	return match ? { contentType: match[1], data: match[2] } : null;
}

async function encode(src: string): Promise<FeedbackAttachment | null> {
	const img = await loadImage(src);
	const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight, 1));
	const width = Math.max(1, Math.round(img.naturalWidth * scale));
	const height = Math.max(1, Math.round(img.naturalHeight * scale));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return base64Of(src);
	// JPEG has no transparency: paint white under it.
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, width, height);
	ctx.drawImage(img, 0, 0, width, height);
	const smallest = [canvas.toDataURL('image/jpeg', 0.82), canvas.toDataURL('image/png')]
		.map(base64Of)
		.filter((c): c is FeedbackAttachment => !!c)
		.sort((a, b) => a.data.length - b.data.length)[0];
	const original = base64Of(src);
	if (original && scale === 1 && original.data.length <= (smallest?.data.length ?? Infinity)) return original;
	return smallest ?? original;
}

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** The pictures as attachments, in the message's order. `skipped` counts the ones that couldn't be read or stayed too large. */
export async function feedbackAttachments(images: string[]): Promise<{ attachments: FeedbackAttachment[]; skipped: number; attachmentOf: (number | null)[] }> {
	const attachments: FeedbackAttachment[] = [];
	const attachmentOf: (number | null)[] = images.map(() => null);
	let skipped = Math.max(0, images.length - MAX_FEEDBACK_IMAGES);
	for (const [i, src] of images.slice(0, MAX_FEEDBACK_IMAGES).entries()) {
		try {
			const encoded = await encode(src);
			if (!encoded || encoded.data.length > MAX_ATTACHMENT_CHARS || !TYPES.has(encoded.contentType)) {
				skipped += 1;
				continue;
			}
			attachmentOf[i] = attachments.length;
			attachments.push(encoded);
		} catch {
			skipped += 1;
		}
	}
	return { attachments, skipped, attachmentOf };
}
