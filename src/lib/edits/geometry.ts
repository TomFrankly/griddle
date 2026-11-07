/**
 * Geometry edits: flips, quarter turns and free rotation. Flips and turns keep every pixel;
 * free rotation crops to the largest rectangle of the same shape that fits inside the turned
 * image, so no empty corners show.
 */
import { bool, num, valueOf, type ImageEdits } from './edits';

export type Geometry = { flipH: boolean; flipV: boolean; quarter: 0 | 1 | 2 | 3; angle: number };

export function geometryOf(edits: ImageEdits | undefined): Geometry {
	const turn = Number(valueOf(edits, 'turn')) || 0;
	return {
		flipH: bool(edits, 'flipH'),
		flipV: bool(edits, 'flipV'),
		quarter: (((Math.round(turn / 90) % 4) + 4) % 4) as Geometry['quarter'],
		angle: num(edits, 'angle')
	};
}

/** How much free rotation by `deg` shrinks a w × h image so its turned frame has no corners. */
export function rotationCrop(w: number, h: number, deg: number): number {
	const t = (Math.abs(deg) * Math.PI) / 180;
	const c = Math.cos(t);
	const s = Math.sin(t);
	if (!w || !h) return 1;
	return Math.min(w / (w * c + h * s), h / (w * s + h * c));
}

/** The size of an image after its geometry edits. Layout and framing use this, not the original. */
export function editedSize(width: number, height: number, edits: ImageEdits | undefined): { width: number; height: number } {
	if (!edits || !width || !height) return { width, height };
	const g = geometryOf(edits);
	const [w, h] = g.quarter % 2 ? [height, width] : [width, height];
	const k = g.angle ? rotationCrop(w, h, g.angle) : 1;
	return { width: w * k, height: h * k };
}

const isIdentity = (g: Geometry) => !g.flipH && !g.flipV && !g.quarter && !g.angle;

/**
 * Draws `source` with its geometry edits onto a new canvas. The canvas keeps the source's pixel
 * density: a half-size thumbnail comes out half the size of the edited original.
 */
export function applyGeometry(
	source: CanvasImageSource & { width: number; height: number },
	edits: ImageEdits | undefined
): HTMLCanvasElement | null {
	const g = geometryOf(edits);
	if (isIdentity(g)) return null;
	const sw = source.width;
	const sh = source.height;
	const out = editedSize(sw, sh, edits);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(out.width));
	canvas.height = Math.max(1, Math.round(out.height));
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.translate(canvas.width / 2, canvas.height / 2);
	// Flips mirror the image as it looks after turning, so Flip horizontal is always left-right.
	ctx.scale(g.flipH ? -1 : 1, g.flipV ? -1 : 1);
	ctx.rotate(((g.quarter * 90 + g.angle) * Math.PI) / 180);
	ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh);
	return canvas;
}
