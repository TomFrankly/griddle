import { DEFAULT_ADJUST, placeImage, type Adjust, type Layout } from './grid';
import { maxPaintSide, paintCanvas } from './paint/paint-gl';
import type { BackdropPaint } from './paint/presets';

export type FitMode = 'fill' | 'fit';

export type Background =
	| { kind: 'none' }
	| { kind: 'color'; color: string }
	| { kind: 'paint'; id: string; paint: BackdropPaint }
	| { kind: 'image'; image: ImageBitmap };

export type Drawable = { source: CanvasImageSource; width: number; height: number; adjust: Adjust };

export type GridImage = {
	id: string;
	name: string;
	file: File;
	width: number;
	height: number;
	/** Downscaled copy used for the on-screen preview. */
	thumb: ImageBitmap;
	thumbUrl: string;
	adjust: Adjust;
};

type Ctx = CanvasRenderingContext2D;

const paintCache = new Map<string, HTMLCanvasElement>();

function paintFor(id: string, paint: BackdropPaint, w: number, h: number): HTMLCanvasElement {
	// Shaders are drawn at most at the GPU's comfortable size and stretched beyond it.
	const max = maxPaintSide();
	const k = Math.min(1, max / Math.max(w, h));
	const pw = Math.max(1, Math.round(w * k));
	const ph = Math.max(1, Math.round(h * k));
	const key = `${id}:${pw}x${ph}`;
	let c = paintCache.get(key);
	if (!c) {
		c = paintCanvas(paint, pw, ph);
		if (paintCache.size > 12) paintCache.clear();
		paintCache.set(key, c);
	}
	return c;
}

/** Fills the whole canvas (device pixels, no transform) with the background. */
export function drawBackground(ctx: Ctx, w: number, h: number, bg: Background) {
	ctx.clearRect(0, 0, w, h);
	if (bg.kind === 'color') {
		ctx.fillStyle = bg.color;
		ctx.fillRect(0, 0, w, h);
	} else if (bg.kind === 'paint') {
		ctx.drawImage(paintFor(bg.id, bg.paint, w, h), 0, 0, w, h);
	} else if (bg.kind === 'image') {
		const img = bg.image;
		const k = Math.max(w / img.width, h / img.height);
		const dw = img.width * k;
		const dh = img.height * k;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
	}
}

function drawCell(ctx: Ctx, cell: Layout['cells'][number], img: Drawable, fit: FitMode) {
	const r = placeImage(img.width, img.height, cell, fit, img.adjust);
	ctx.save();
	ctx.beginPath();
	ctx.rect(cell.x, cell.y, cell.w, cell.h);
	ctx.clip();
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(img.source, r.x, r.y, r.w, r.h);
	ctx.restore();
}

/** Draws the grid onto a canvas whose size is `layout` × `scale`. */
export function drawGrid(
	ctx: Ctx,
	layout: Layout,
	getImage: (index: number) => Drawable | null,
	opts: { background: Background; fit: FitMode; scale: number }
) {
	const { canvas } = ctx;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	drawBackground(ctx, canvas.width, canvas.height, opts.background);
	ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
	layout.cells.forEach((cell, i) => {
		const img = getImage(i);
		if (img) drawCell(ctx, cell, img, opts.fit);
	});
	ctx.setTransform(1, 0, 0, 1, 0, 0);
}

const THUMB_MAX = 1200;
let counter = 0;

export async function decode(file: File): Promise<ImageBitmap> {
	return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export async function downscale(bmp: ImageBitmap, max: number): Promise<ImageBitmap> {
	const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
	if (k >= 1) return bmp;
	const out = await createImageBitmap(bmp, {
		resizeWidth: Math.max(1, Math.round(bmp.width * k)),
		resizeHeight: Math.max(1, Math.round(bmp.height * k)),
		resizeQuality: 'high'
	});
	bmp.close();
	return out;
}

export async function loadImage(file: File): Promise<GridImage> {
	const full = await decode(file);
	const { width, height } = full;
	const thumb = await downscale(full, THUMB_MAX);
	return {
		id: `img-${Date.now()}-${counter++}`,
		name: file.name,
		file,
		width,
		height,
		thumb,
		thumbUrl: URL.createObjectURL(file),
		adjust: { ...DEFAULT_ADJUST }
	};
}

export type ExportFormat = 'png' | 'jpeg';

/** Renders the grid at full resolution, decoding each original image one at a time. */
export async function renderFull(
	layout: Layout,
	images: GridImage[],
	opts: { background: Background; fit: FitMode; opaque?: boolean }
): Promise<HTMLCanvasElement> {
	const canvas = document.createElement('canvas');
	canvas.width = layout.width;
	canvas.height = layout.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas is not available in this browser.');
	const bg: Background =
		opts.opaque && opts.background.kind === 'none' ? { kind: 'color', color: '#ffffff' } : opts.background;
	drawBackground(ctx, layout.width, layout.height, bg);
	for (let i = 0; i < layout.cells.length; i++) {
		const img = images[i];
		if (!img) continue;
		const bmp = await decode(img.file);
		drawCell(ctx, layout.cells[i], { source: bmp, width: bmp.width, height: bmp.height, adjust: img.adjust }, opts.fit);
		bmp.close();
	}
	return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('The image was too large to export.'))),
			`image/${format}`,
			format === 'jpeg' ? 0.92 : undefined
		)
	);
}
