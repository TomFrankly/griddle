import { DEFAULT_ADJUST, placeImage, type Adjust, type Layout, type Rect } from './grid';
import { maxPaintSide, paintCanvas } from './paint/paint-gl';
import type { BackdropPaint } from './paint/presets';
import {
	DEFAULT_CAPTIONS,
	drawCaptions,
	ensureCaptionFonts,
	isEmpty,
	type CaptionStyle,
	type Captioned,
	type RichText
} from './captions';
import type { Span } from './grid';
import { DEFAULT_LINES, drawLines, type LineStyle } from './lines';

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
	lines: LineStyle;
	/** A box behind each image, filling its cell. Shows through transparent images. */
	fill: { on: boolean; bgId: string; color: string; opacity: number; padding: number };
	captions: CaptionStyle;
};

export const DEFAULT_STYLE: CellStyle = {
	corners: { on: false, radius: 12 },
	border: { on: false, width: 4, color: '#ffffff', opacity: 100 },
	shadow: { on: false, strength: 35, distance: 8, softness: 24 },
	lines: DEFAULT_LINES,
	fill: { on: false, bgId: 'custom', color: '#f0f0f0', opacity: 100, padding: 0 },
	captions: DEFAULT_CAPTIONS
};

/** `visible` is the box that gets corners, shadow and border; `clip` is where the image may draw. */
type PlanItem = { cell: Rect; place: Rect; visible: Rect; clip: Rect; radius: number };
type Sized = { width: number; height: number; adjust: Adjust };

/**
 * Where each image lands: the part of the cell it covers (all of it for fill) and its corner
 * radius. With a cell background the whole cell is the visible box, and the image sits inside it.
 */
function plan(layout: Layout, sizes: (Sized | null)[], fit: FitMode, style: CellStyle): (PlanItem | null)[] {
	const boxed = style.fill.on;
	return layout.cells.map((cell, i) => {
		const img = sizes[i];
		if (!img) return null;
		const pad = boxed ? Math.max(0, Math.min(style.fill.padding, cell.w / 2 - 1, cell.h / 2 - 1)) : 0;
		const inner = { x: cell.x + pad, y: cell.y + pad, w: cell.w - 2 * pad, h: cell.h - 2 * pad };
		const place = placeImage(img.width, img.height, inner, fit, img.adjust);
		if (boxed) {
			const pct = style.corners.on ? Math.min(100, Math.max(0, style.corners.radius)) : 0;
			return { cell, place, visible: cell, clip: inner, radius: (pct / 100) * (Math.min(cell.w, cell.h) / 2) };
		}
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
		return { cell, place, visible, clip: visible, radius };
	});
}

/** Draws a background into a rectangle, in the context's current coordinates. */
function fillRectWith(ctx: Ctx, r: Rect, bg: Background) {
	if (bg.kind === 'color') {
		ctx.fillStyle = bg.color;
		ctx.fillRect(r.x, r.y, r.w, r.h);
	} else if (bg.kind === 'paint') {
		const t = ctx.getTransform();
		const k = Math.hypot(t.a, t.b) || 1;
		ctx.drawImage(paintFor(bg.id, bg.paint, Math.max(1, r.w * k), Math.max(1, r.h * k)), r.x, r.y, r.w, r.h);
	} else if (bg.kind === 'image') {
		const img = bg.image;
		const s = Math.max(r.w / img.width, r.h / img.height);
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(img, r.x + (r.w - img.width * s) / 2, r.y + (r.h - img.height * s) / 2, img.width * s, img.height * s);
	}
}

/** The box behind each image, cut to its corners. */
function drawFills(ctx: Ctx, items: (PlanItem | null)[], style: CellStyle, bg: Background | undefined) {
	const f = style.fill;
	if (!f.on || f.opacity <= 0) return;
	const fill = bg ?? { kind: 'color', color: f.color };
	for (const it of items) {
		if (!it) continue;
		ctx.save();
		ctx.globalAlpha = Math.min(1, f.opacity / 100);
		shape(ctx, it.visible, it.radius);
		ctx.clip();
		fillRectWith(ctx, it.visible, fill);
		ctx.restore();
	}
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
	const v = it.clip;
	const d = Math.min(inset, v.w / 2, v.h / 2);
	const r = Math.max(0, it.radius - d - (v.x - it.visible.x));
	shape(ctx, { x: v.x + d, y: v.y + d, w: v.w - 2 * d, h: v.h - 2 * d }, r);
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

/** `cellBackground` fills the box behind each image when cell backgrounds are on. */
export type RenderOptions = { background: Background; cellBackground?: Background; fit: FitMode; style: CellStyle };

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
	drawFills(ctx, items, opts.style, opts.cellBackground);
	const inset = borderInset(opts.style, opts.scale);
	items.forEach((it, i) => it && drawImage(ctx, it, imgs[i]!.source, inset));
	drawBorders(ctx, items, opts.style);
	drawLines(ctx, layout, opts.style.lines);
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
	drawFills(ctx, items, opts.style, opts.cellBackground);
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (!it) continue;
		const bmp = await decode(images[i].file);
		drawImage(ctx, it, bmp, borderInset(opts.style, 1));
		bmp.close();
	}
	drawBorders(ctx, items, opts.style);
	drawLines(ctx, layout, opts.style.lines);
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

/**
 * Renders the grid as a layered Photoshop file: background, shadows, one layer per image (cut to
 * its cell, corners included), borders, divider lines and one layer per caption. Everything is
 * drawn locally; ag-psd only packs the layers.
 */
export async function renderPsd(layout: Layout, images: GridImage[], opts: RenderOptions): Promise<Blob> {
	const { writePsd } = await import('ag-psd');
	await ensureCaptionFonts(opts.style.captions);
	const W = layout.width;
	const H = layout.height;
	type PsdLayer = { name: string; canvas?: HTMLCanvasElement; left?: number; top?: number; children?: PsdLayer[]; opened?: boolean };
	const layer = (name: string, box: Rect, draw: (ctx: Ctx) => void): PsdLayer | null => {
		const left = Math.max(0, Math.floor(box.x));
		const top = Math.max(0, Math.floor(box.y));
		const w = Math.min(W, Math.ceil(box.x + box.w)) - left;
		const h = Math.min(H, Math.ceil(box.y + box.h)) - top;
		if (w <= 0 || h <= 0) return null;
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d');
		if (!ctx) throw new Error('Canvas is not available in this browser.');
		ctx.translate(-left, -top);
		draw(ctx);
		return { name, canvas: c, left, top };
	};
	const full = { x: 0, y: 0, w: W, h: H };
	const items = plan(layout, layout.cells.map((_, i) => images[i] ?? null), opts.fit, opts.style);
	const children: PsdLayer[] = [];
	const push = (l: PsdLayer | null) => l && children.push(l);

	if (opts.background.kind !== 'none') push(layer('Background', full, (ctx) => drawBackground(ctx, W, H, opts.background)));
	if (opts.style.shadow.on && opts.style.shadow.strength > 0) push(layer('Shadows', full, (ctx) => drawShadows(ctx, items, opts.style, 1)));

	if (opts.style.fill.on && opts.style.fill.opacity > 0) push(layer('Cell backgrounds', full, (ctx) => drawFills(ctx, items, opts.style, opts.cellBackground)));

	const imageLayers: PsdLayer[] = [];
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (!it) continue;
		const bmp = await decode(images[i].file);
		const l = layer(`${i + 1} ${images[i].name}`, it.clip, (ctx) => drawImage(ctx, it, bmp, borderInset(opts.style, 1)));
		bmp.close();
		if (l) imageLayers.push(l);
	}
	children.push({ name: 'Images', children: imageLayers, opened: true });

	if (opts.style.border.on && opts.style.border.width > 0) push(layer('Borders', full, (ctx) => drawBorders(ctx, items, opts.style)));
	if (opts.style.lines.on && opts.style.lines.width > 0) push(layer('Divider lines', full, (ctx) => drawLines(ctx, layout, opts.style.lines)));

	const c = opts.style.captions;
	if (c.on) {
		const captionLayers: PsdLayer[] = [];
		layout.cells.forEach((cell, i) => {
			const img = images[i];
			if (!img || (isEmpty(img.title) && isEmpty(img.desc))) return;
			const pad = 64;
			const box = { x: cell.x - pad, y: cell.y - layout.bandAbove - pad, w: cell.w + 2 * pad, h: cell.h + layout.bandAbove + layout.bandBelow + 2 * pad };
			const l = layer(`Caption ${i + 1}`, box, (ctx) => drawCaptions(ctx, [cell], [img], c, 1));
			if (l) captionLayers.push(l);
		});
		if (captionLayers.length) children.push({ name: 'Captions', children: captionLayers, opened: true });
	}

	// The flattened image, shown by apps that don't read layers.
	const composite = await renderFull(layout, images, opts);
	const buffer = writePsd({ width: W, height: H, canvas: composite, children } as Parameters<typeof writePsd>[0]);
	return new Blob([buffer], { type: 'image/vnd.adobe.photoshop' });
}

export type CellExportOptions = { corners: boolean; shadow: boolean; captions: boolean };

/**
 * Renders each image's cell on its own, with its styling, as PNG files: the cell box, image,
 * border and (optionally) rounded corners, shadow and captions. Divider lines and the canvas
 * background are left out, so anything outside the box is transparent.
 */
export async function renderCells(
	layout: Layout,
	images: GridImage[],
	opts: RenderOptions,
	pick: CellExportOptions
): Promise<{ index: number; blob: Blob }[]> {
	const style: CellStyle = {
		...opts.style,
		corners: { ...opts.style.corners, on: opts.style.corners.on && pick.corners },
		shadow: { ...opts.style.shadow, on: opts.style.shadow.on && pick.shadow },
		lines: { ...opts.style.lines, on: false }
	};
	const caps = style.captions.on && pick.captions;
	await ensureCaptionFonts(style.captions);
	const items = plan(layout, layout.cells.map((_, i) => images[i] ?? null), opts.fit, style);
	const sh = style.shadow;
	const margin = sh.on && sh.strength > 0 ? Math.ceil(sh.softness * 1.5 + sh.distance) : 0;
	const out: { index: number; blob: Blob }[] = [];
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (!it) continue;
		const box = caps
			? { x: it.cell.x, y: it.cell.y - layout.bandAbove, w: it.cell.w, h: it.cell.h + layout.bandAbove + layout.bandBelow }
			: it.visible;
		const left = Math.floor(box.x) - margin;
		const top = Math.floor(box.y) - margin;
		const canvas = document.createElement('canvas');
		canvas.width = Math.ceil(box.x + box.w) + margin - left;
		canvas.height = Math.ceil(box.y + box.h) + margin - top;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas is not available in this browser.');
		ctx.translate(-left, -top);
		drawShadows(ctx, [it], style, 1);
		drawFills(ctx, [it], style, opts.cellBackground);
		const bmp = await decode(images[i].file);
		drawImage(ctx, it, bmp, borderInset(style, 1));
		bmp.close();
		drawBorders(ctx, [it], style);
		if (caps) drawCaptions(ctx, [it.cell], [images[i]], style.captions, 1);
		out.push({ index: i, blob: await canvasToBlob(canvas, 'png') });
	}
	return out;
}
