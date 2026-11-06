import { DEFAULT_ADJUST, placeImage, type Adjust, type Layout, type Rect } from './grid';
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

export type CellStyle = {
	/** Corner radius as a percentage of half the image's shorter side (0 to 100). */
	corners: { on: boolean; radius: number };
	border: { on: boolean; width: number; color: string; opacity: number };
	shadow: { on: boolean; strength: number; distance: number; softness: number };
	lines: { on: boolean; width: number; color: string; opacity: number };
};

export const DEFAULT_STYLE: CellStyle = {
	corners: { on: false, radius: 12 },
	border: { on: false, width: 4, color: '#ffffff', opacity: 100 },
	shadow: { on: false, strength: 35, distance: 8, softness: 24 },
	lines: { on: false, width: 2, color: '#000000', opacity: 25 }
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

function drawImage(ctx: Ctx, it: PlanItem, source: CanvasImageSource) {
	ctx.save();
	shape(ctx, it.visible, it.radius);
	ctx.clip();
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, it.place.x, it.place.y, it.place.w, it.place.h);
	ctx.restore();
}

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
 * Lines through the middle of the gaps, reaching the canvas edges: full-width lines between rows,
 * and lines between neighbours in each row that run up and down to meet them. All lines are
 * filled as one path so crossings aren't drawn twice.
 */
function drawLines(ctx: Ctx, layout: Layout, style: CellStyle) {
	const l = style.lines;
	if (!l.on || l.width <= 0 || !layout.cells.length) return;
	const rows: Rect[][] = [];
	layout.cells.forEach((c, i) => (rows[Math.floor(i / layout.cols)] ??= []).push(c));
	const w = l.width;
	const between = (r: number) => (rows[r][0].y + rows[r][0].h + rows[r + 1][0].y) / 2;
	ctx.save();
	ctx.fillStyle = withAlpha(l.color, l.opacity);
	ctx.beginPath();
	for (let r = 0; r < rows.length; r++) {
		const row = rows[r];
		const top = r === 0 ? 0 : between(r - 1);
		const bottom = r + 1 < rows.length ? between(r) : layout.height;
		for (let c = 0; c + 1 < row.length; c++) {
			const mid = (row[c].x + row[c].w + row[c + 1].x) / 2;
			ctx.rect(mid - w / 2, top, w, bottom - top);
		}
		if (r + 1 < rows.length) ctx.rect(0, between(r) - w / 2, layout.width, w);
	}
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
	items.forEach((it, i) => it && drawImage(ctx, it, imgs[i]!.source));
	drawBorders(ctx, items, opts.style);
	drawLines(ctx, layout, opts.style);
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
	opts: RenderOptions & { opaque?: boolean }
): Promise<HTMLCanvasElement> {
	const canvas = document.createElement('canvas');
	canvas.width = layout.width;
	canvas.height = layout.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas is not available in this browser.');
	const bg: Background =
		opts.opaque && opts.background.kind === 'none' ? { kind: 'color', color: '#ffffff' } : opts.background;
	drawBackground(ctx, layout.width, layout.height, bg);
	const items = plan(layout, layout.cells.map((_, i) => images[i] ?? null), opts.fit, opts.style);
	drawShadows(ctx, items, opts.style, 1);
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (!it) continue;
		const bmp = await decode(images[i].file);
		drawImage(ctx, it, bmp);
		bmp.close();
	}
	drawBorders(ctx, items, opts.style);
	drawLines(ctx, layout, opts.style);
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
