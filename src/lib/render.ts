import { DEFAULT_ADJUST, placeImage, type Adjust, type Layout, type Rect } from './grid';
import { maxPaintSide, paintCanvas } from './paint/paint-gl';
import type { BackdropPaint } from './paint/presets';
import {
	DEFAULT_CAPTIONS,
	drawCaptions,
	ensureCaptionFonts,
	type CaptionStyle,
	type Captioned,
	type RichText
} from './captions';
import type { Span } from './grid';

export type FitMode = 'fill' | 'fit';

export type Background =
	| { kind: 'none' }
	| { kind: 'color'; color: string }
	| { kind: 'paint'; id: string; paint: BackdropPaint }
	| { kind: 'image'; image: ImageBitmap };

export type Drawable = Captioned & { source: CanvasImageSource; width: number; height: number; adjust: Adjust };

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
	/** Grid cells this image covers across and down. */
	span: Span;
	title: RichText;
	desc: RichText;
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

export type CellStyle = {
	/** Corner radius as a percentage of half the image's shorter side (0 to 100). */
	corners: { on: boolean; radius: number };
	border: { on: boolean; width: number; color: string; opacity: number };
	shadow: { on: boolean; strength: number; distance: number; softness: number };
	lines: { on: boolean; width: number; color: string; opacity: number };
	captions: CaptionStyle;
};

export const DEFAULT_STYLE: CellStyle = {
	corners: { on: false, radius: 12 },
	border: { on: false, width: 4, color: '#ffffff', opacity: 100 },
	shadow: { on: false, strength: 35, distance: 8, softness: 24 },
	lines: { on: false, width: 2, color: '#000000', opacity: 25 },
	captions: DEFAULT_CAPTIONS
};

type PlanItem = { cell: Rect; place: Rect; visible: Rect; radius: number };
type Sized = { width: number; height: number; adjust: Adjust };

/** Where each image lands: the part of the cell it covers (all of it for fill) and its corner radius. */
function plan(layout: Layout, sizes: (Sized | null)[], fit: FitMode, style: CellStyle): (PlanItem | null)[] {
	return layout.cells.map((cell, i) => {
		const img = sizes[i];
		if (!img) return null;
		const place = placeImage(img.width, img.height, cell, fit, img.adjust);
		const x = Math.max(cell.x, place.x);
		const y = Math.max(cell.y, place.y);
		const visible = {
			x,
			y,
			w: Math.min(cell.x + cell.w, place.x + place.w) - x,
			h: Math.min(cell.y + cell.h, place.y + place.h) - y
		};
		const pct = style.corners.on ? Math.min(100, Math.max(0, style.corners.radius)) : 0;
		const radius = (pct / 100) * (Math.min(visible.w, visible.h) / 2);
		return { cell, place, visible, radius };
	});
}

function shape(ctx: Ctx, r: Rect, radius: number) {
	ctx.beginPath();
	if (radius > 0) ctx.roundRect(r.x, r.y, r.w, r.h, radius);
	else ctx.rect(r.x, r.y, r.w, r.h);
}

const withAlpha = (hex: string, pct: number) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.min(1, Math.max(0, pct / 100))})`;
};

/** Shadows ignore the canvas transform, so their sizes are multiplied by `scale` here. */
function drawShadows(ctx: Ctx, items: (PlanItem | null)[], style: CellStyle, scale: number) {
	const sh = style.shadow;
	if (!sh.on || sh.strength <= 0) return;
	// Draw each shape far off the canvas and offset only its shadow back into place.
	const far = 100000;
	ctx.save();
	ctx.shadowColor = `rgba(0,0,0,${Math.min(1, sh.strength / 100)})`;
	ctx.shadowBlur = sh.softness * scale;
	ctx.shadowOffsetX = far * scale;
	ctx.shadowOffsetY = sh.distance * scale;
	ctx.fillStyle = '#000';
	for (const it of items) {
		if (!it) continue;
		shape(ctx, { ...it.visible, x: it.visible.x - far }, it.radius);
		ctx.fill();
	}
	ctx.restore();
}

/**
 * `inset` pulls the clip in under an opaque border, so the image's anti-aliased edge can't show
 * outside it.
 */
function drawImage(ctx: Ctx, it: PlanItem, source: CanvasImageSource, inset = 0) {
	ctx.save();
	const v = it.visible;
	const d = Math.min(inset, v.w / 2, v.h / 2);
	shape(ctx, { x: v.x + d, y: v.y + d, w: v.w - 2 * d, h: v.h - 2 * d }, Math.max(0, it.radius - d));
	ctx.clip();
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, it.place.x, it.place.y, it.place.w, it.place.h);
	ctx.restore();
}

/** How far under an opaque border the image can be cut back. */
const borderInset = (style: CellStyle, scale: number) =>
	style.border.on && style.border.opacity >= 100 ? Math.min(style.border.width / 2, 1.5 / scale) : 0;

/** Borders sit inside the image's edge, following its corners. */
function drawBorders(ctx: Ctx, items: (PlanItem | null)[], style: CellStyle) {
	const b = style.border;
	if (!b.on || b.width <= 0) return;
	ctx.save();
	ctx.strokeStyle = withAlpha(b.color, b.opacity);
	ctx.lineWidth = b.width;
	for (const it of items) {
		if (!it) continue;
		const v = it.visible;
		const half = b.width / 2;
		const r = { x: v.x + half, y: v.y + half, w: Math.max(0, v.w - b.width), h: Math.max(0, v.h - b.width) };
		shape(ctx, r, Math.max(0, it.radius - half));
		ctx.stroke();
	}
	ctx.restore();
}

/**
 * Lines through the middle of the gaps between neighbouring cells, reaching the canvas edges at
 * the outside of the grid. All lines are filled as one path so crossings aren't drawn twice.
 */
function drawLines(ctx: Ctx, layout: Layout, style: CellStyle) {
	const l = style.lines;
	if (!l.on || l.width <= 0 || !layout.cells.length) return;
	const { slots, cells, gutter: g, bandAbove: ba, bandBelow: bb, cols, rows } = layout;
	const eps = 1e-6;
	const w = l.width;
	const top = (i: number) => (slots[i].r === 0 ? 0 : cells[i].y - ba - g / 2);
	const bottom = (i: number) => (slots[i].r + slots[i].h >= rows ? layout.height : cells[i].y + cells[i].h + bb + g / 2);
	const left = (i: number) => (slots[i].c < eps ? 0 : cells[i].x - g / 2);
	const right = (i: number) => (slots[i].c + slots[i].w > cols - eps ? layout.width : cells[i].x + cells[i].w + g / 2);
	const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - eps && b0 < a1 - eps;
	ctx.save();
	ctx.fillStyle = withAlpha(l.color, l.opacity);
	ctx.beginPath();
	slots.forEach((p, i) => {
		const hasRight = slots.some((q) => Math.abs(q.c - (p.c + p.w)) < eps && overlaps(p.r, p.r + p.h, q.r, q.r + q.h));
		if (hasRight) {
			const x = cells[i].x + cells[i].w + g / 2;
			ctx.rect(x - w / 2, top(i), w, bottom(i) - top(i));
		}
		const hasBelow = slots.some((q) => Math.abs(q.r - (p.r + p.h)) < eps && overlaps(p.c - 0.5, p.c + p.w + 0.5, q.c, q.c + q.w));
		if (hasBelow) {
			const y = cells[i].y + cells[i].h + bb + g / 2;
			ctx.rect(left(i), y - w / 2, right(i) - left(i), w);
		}
	});
	ctx.fill();
	ctx.restore();
}

export type RenderOptions = { background: Background; fit: FitMode; style: CellStyle };

/** Draws the grid onto a canvas whose size is `layout` × `scale`. */
export function drawGrid(
	ctx: Ctx,
	layout: Layout,
	getImage: (index: number) => Drawable | null,
	opts: RenderOptions & { scale: number }
) {
	const { canvas } = ctx;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	drawBackground(ctx, canvas.width, canvas.height, opts.background);
	ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
	const imgs = layout.cells.map((_, i) => getImage(i));
	const items = plan(layout, imgs, opts.fit, opts.style);
	drawShadows(ctx, items, opts.style, opts.scale);
	const inset = borderInset(opts.style, opts.scale);
	items.forEach((it, i) => it && drawImage(ctx, it, imgs[i]!.source, inset));
	drawBorders(ctx, items, opts.style);
	drawLines(ctx, layout, opts.style);
	drawCaptions(ctx, layout.cells, imgs, opts.style.captions, opts.scale);
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
		adjust: { ...DEFAULT_ADJUST },
		span: { w: 1, h: 1 },
		title: [],
		desc: []
	};
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';

/** Renders the grid at full resolution, decoding each original image one at a time. */
export async function renderFull(
	layout: Layout,
	images: GridImage[],
	opts: RenderOptions & { opaque?: boolean }
): Promise<HTMLCanvasElement> {
	const canvas = document.createElement('canvas');
	canvas.width = layout.width;
	canvas.height = layout.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas is not available in this browser.');
	await ensureCaptionFonts(opts.style.captions);
	const bg: Background =
		opts.opaque && opts.background.kind === 'none' ? { kind: 'color', color: '#ffffff' } : opts.background;
	drawBackground(ctx, layout.width, layout.height, bg);
	const items = plan(layout, layout.cells.map((_, i) => images[i] ?? null), opts.fit, opts.style);
	drawShadows(ctx, items, opts.style, 1);
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (!it) continue;
		const bmp = await decode(images[i].file);
		drawImage(ctx, it, bmp, borderInset(opts.style, 1));
		bmp.close();
	}
	drawBorders(ctx, items, opts.style);
	drawLines(ctx, layout, opts.style);
	drawCaptions(ctx, layout.cells, images, opts.style.captions, 1);
	return canvas;
}

/** `quality` (0 to 1) applies to JPG and WebP. */
export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat, quality = 0.92): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('The image was too large to export.'))),
			`image/${format}`,
			format === 'png' ? undefined : quality
		)
	);
}
