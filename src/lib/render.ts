import { DEFAULT_ADJUST, placeImage, type Adjust, type Layout, type Rect } from './grid';
import { maxPaintSide, paintCanvas } from './paint/paint-gl';
import type { BackdropPaint } from './paint/presets';
import {
	captionInsets,
	DEFAULT_ORDER,
	type Layer,
	hasInside,
	DEFAULT_CAPTIONS,
	drawCaptions,
	ensureCaptionFonts,
	isEmpty,
	plainText,
	type CaptionStyle,
	type Captioned,
	type RichText
} from './captions';
import type { Span } from './grid';
import { DEFAULT_LINES, drawLines, type LineStyle } from './lines';
import { applyEdits, editedPreview, editedSize, type ImageEdits } from './edits';

export type FitMode = 'fill' | 'fit';

export type Background =
	| { kind: 'none' }
	| { kind: 'color'; color: string }
	| { kind: 'paint'; id: string; paint: BackdropPaint }
	| { kind: 'image'; image: ImageBitmap };

/** `source` is null for an empty slot, which keeps its place, cell background and captions. */
export type Drawable = Captioned & {
	source: CanvasImageSource | null;
	/** The original image's size, before edits. */
	width: number;
	height: number;
	adjust: Adjust;
	edits?: ImageEdits;
};

/** One cell of the grid. An empty slot has no file, no thumbnail and a size of 0 × 0. */
export type GridImage = {
	id: string;
	name: string;
	file: File | null;
	width: number;
	height: number;
	/** Downscaled copy used for the on-screen preview. */
	thumb: ImageBitmap | null;
	thumbUrl: string;
	/** How the image sits in its cell. */
	adjust: Adjust;
	/** Changes to the image itself (rotation, color…), which it keeps in any cell. */
	edits: ImageEdits;
	/** Grid cells this image covers across and down. */
	span: Span;
	title: RichText;
	desc: RichText;
};

type Ctx = CanvasRenderingContext2D;

/** True when the cell holds an image rather than being an empty slot. */
export const hasImage = (img: Pick<GridImage, 'file'> | null | undefined): img is GridImage & { file: File } => !!img?.file;

let slotCounter = 0;
/** A cell with no image yet: it takes part in the layout and can carry a span and captions. */
export function emptySlot(id = `slot-${Date.now()}-${slotCounter++}`): GridImage {
	return {
		id,
		name: 'Empty slot',
		file: null,
		width: 0,
		height: 0,
		thumb: null,
		thumbUrl: '',
		adjust: { ...DEFAULT_ADJUST },
		edits: {},
		span: { w: 1, h: 1 },
		title: [],
		desc: []
	};
}

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
type Sized = { width: number; height: number; adjust: Adjust; edits?: ImageEdits };

/**
 * Where each image lands: the part of the cell it covers (all of it for fill) and its corner
 * radius. With a cell background the whole cell is the visible box, and the image sits inside it.
 */
/**
 * The part of a cell an image may use: inside any cell-background padding. Captions placed inside
 * the cell sit over the image, so they take no room from it.
 */
export function imageArea(cell: Rect, style: CellStyle): Rect {
	const pad = style.fill.on ? Math.max(0, Math.min(style.fill.padding, cell.w / 2 - 1, cell.h / 2 - 1)) : 0;
	return { x: cell.x + pad, y: cell.y + pad, w: Math.max(1, cell.w - 2 * pad), h: Math.max(1, cell.h - 2 * pad) };
}

/** The order of image, caption fade and text in each cell, bottom to top, always holding all three. */
export function layerOrder(style: CellStyle): Layer[] {
	const o = (style.captions.order ?? []).filter((l, i, a) => DEFAULT_ORDER.includes(l) && a.indexOf(l) === i);
	return o.length === 3 ? o : [...DEFAULT_ORDER];
}

function plan(layout: Layout, sizes: (Sized | null)[], fit: FitMode, style: CellStyle): (PlanItem | null)[] {
	const boxed = style.fill.on;
	const pct = style.corners.on ? Math.min(100, Math.max(0, style.corners.radius)) : 0;
	return layout.cells.map((cell, i) => {
		const img = sizes[i];
		if (!img) return null;
		const inner = imageArea(cell, style);
		// An empty slot shows only its cell background, so without one there is nothing to draw.
		if (img.width <= 0 || img.height <= 0)
			return boxed ? { cell, place: inner, visible: cell, clip: inner, radius: (pct / 100) * (Math.min(cell.w, cell.h) / 2) } : null;
		const size = editedSize(img.width, img.height, img.edits);
		const place = placeImage(size.width, size.height, inner, fit, img.adjust, style.fill.on);
		if (boxed) return { cell, place, visible: cell, clip: inner, radius: (pct / 100) * (Math.min(cell.w, cell.h) / 2) };
		const x = Math.max(inner.x, place.x);
		const y = Math.max(inner.y, place.y);
		const visible = {
			x,
			y,
			w: Math.max(0, Math.min(inner.x + inner.w, place.x + place.w) - x),
			h: Math.max(0, Math.min(inner.y + inner.h, place.y + place.h) - y)
		};
		const radius = (pct / 100) * (Math.min(visible.w, visible.h) / 2);
		return { cell, place, visible, clip: visible, radius };
	});
}

/** Gradients from the cell's top or bottom edge behind captions placed inside it. */
function drawFades(ctx: Ctx, items: (PlanItem | null)[], texts: (Captioned | null)[], style: CellStyle) {
	const c = style.captions;
	const f = c.fade;
	if (!c.on || !f.on || f.opacity <= 0) return;
	const ins = captionInsets(c);
	const n = parseInt(f.color.slice(1), 16);
	const rgba = (a: number) => `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
	const alpha = Math.min(1, f.opacity / 100);
	items.forEach((it, i) => {
		if (!it) return;
		const box = style.fill.on ? it.visible : it.visible.w && it.visible.h ? it.visible : it.cell;
		for (const where of ['top', 'bottom'] as const) {
			const h = where === 'top' ? ins.top : ins.bottom;
			if (!h || !hasInside(c, texts[i], where)) continue;
			const reach = Math.min(box.h, h + Math.max(0, f.length));
			const y0 = where === 'top' ? box.y : box.y + box.h;
			const y1 = where === 'top' ? box.y + reach : box.y + box.h - reach;
			const g = ctx.createLinearGradient(0, y0, 0, y1);
			g.addColorStop(0, rgba(alpha));
			g.addColorStop(Math.min(0.95, (h * 0.6) / reach), rgba(alpha));
			g.addColorStop(1, rgba(0));
			ctx.save();
			shape(ctx, box, it.radius);
			ctx.clip();
			ctx.fillStyle = g;
			ctx.fillRect(box.x, Math.min(y0, y1), box.w, reach);
			ctx.restore();
		}
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
	opts: RenderOptions & {
		scale: number;
		/** Draws only part of the grid: the canvas shows the window at (x, y), in pixels at this scale. */
		view?: { x: number; y: number };
	}
) {
	const { canvas } = ctx;
	const vx = opts.view?.x ?? 0;
	const vy = opts.view?.y ?? 0;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.setTransform(1, 0, 0, 1, -vx, -vy);
	drawBackground(ctx, Math.round(layout.width * opts.scale), Math.round(layout.height * opts.scale), opts.background);
	ctx.setTransform(opts.scale, 0, 0, opts.scale, -vx, -vy);
	const imgs = layout.cells.map((_, i) => getImage(i));
	const items = plan(layout, imgs, opts.fit, opts.style);
	drawShadows(ctx, items, opts.style, opts.scale);
	drawFills(ctx, items, opts.style, opts.cellBackground);
	const inset = borderInset(opts.style, opts.scale);
	for (const layer of layerOrder(opts.style)) {
		if (layer === 'image')
			items.forEach((it, i) => {
				const d = imgs[i];
				if (it && d?.source) drawImage(ctx, it, editedPreview(d.source as Editable, d.edits), inset);
			});
		else if (layer === 'fade') drawFades(ctx, items, imgs, opts.style);
		else drawCaptions(ctx, layout.cells, imgs, opts.style.captions, opts.scale);
	}
	drawBorders(ctx, items, opts.style);
	drawLines(ctx, layout, opts.style.lines);
	ctx.setTransform(1, 0, 0, 1, 0, 0);
}

const hasCaptionText = (c: CaptionStyle, img: Captioned) =>
	c.on && ((c.title.on && !isEmpty(img.title)) || (c.desc.on && !isEmpty(img.desc)));

const THUMB_MAX = 1200;
let counter = 0;

export async function decode(file: File): Promise<ImageBitmap> {
	return createImageBitmap(file, { imageOrientation: 'from-image' });
}

type Editable = Parameters<typeof applyEdits>[0];

/** The full-size image with its edits, for exports. Call `done` once it has been drawn. */
async function decodeEdited(img: GridImage & { file: File }): Promise<{ source: CanvasImageSource; done: () => void }> {
	const bmp = await decode(img.file);
	const source = applyEdits(bmp, img.edits);
	return { source, done: () => bmp.close() };
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
		edits: {},
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
	for (const layer of layerOrder(opts.style)) {
		if (layer === 'fade') drawFades(ctx, items, images, opts.style);
		else if (layer === 'text') drawCaptions(ctx, layout.cells, images, opts.style.captions, 1);
		else
			for (let i = 0; i < items.length; i++) {
				const it = items[i];
				const img = images[i];
				if (!it || !hasImage(img)) continue;
				const { source, done } = await decodeEdited(img);
				drawImage(ctx, it, source, borderInset(opts.style, 1));
				done();
			}
	}
	drawBorders(ctx, items, opts.style);
	drawLines(ctx, layout, opts.style.lines);
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
	// One group per cell, in grid order, holding its layers in the chosen stacking order.
	const st = opts.style;
	const c = st.captions;
	const order = layerOrder(st);
	const digits = String(items.length).length;
	const groups: PsdLayer[] = [];
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		const img = images[i];
		if (!img || (!it && !hasCaptionText(c, img))) continue;
		const cell = it?.cell ?? layout.cells[i];
		const m = st.shadow.on ? st.shadow.distance + st.shadow.softness * 2 : 0;
		const around = { x: cell.x - m, y: cell.y - m, w: cell.w + 2 * m, h: cell.h + 2 * m };
		const textBox = { x: cell.x - 64, y: cell.y - layout.bandAbove - 64, w: cell.w + 128, h: cell.h + layout.bandAbove + layout.bandBelow + 128 };
		const group: PsdLayer[] = [];
		const add = (l: PsdLayer | null) => l && group.push(l);
		if (it && st.shadow.on && st.shadow.strength > 0) add(layer('Shadow', around, (ctx) => drawShadows(ctx, [it], st, 1)));
		if (it && st.fill.on && st.fill.opacity > 0) add(layer('Cell background', cell, (ctx) => drawFills(ctx, [it], st, opts.cellBackground)));
		const full = it && hasImage(img) ? await decodeEdited(img) : null;
		const bmp = full?.source;
		for (const l of order) {
			if (l === 'image') {
				if (it && bmp) add(layer('Image', it.clip, (ctx) => drawImage(ctx, it, bmp, borderInset(st, 1))));
			} else if (!c.on) continue;
			else if (l === 'fade') {
				if (it && c.fade.on) add(layer('Caption fade', cell, (ctx) => drawFades(ctx, [it], [img], st)));
			} else {
				if (c.title.on && !isEmpty(img.title)) add(layer('Title', textBox, (ctx) => drawCaptions(ctx, [cell], [{ title: img.title }], c, 1)));
				if (c.desc.on && !isEmpty(img.desc)) add(layer('Description', textBox, (ctx) => drawCaptions(ctx, [cell], [{ desc: img.desc }], c, 1)));
			}
		}
		full?.done();
		if (it && st.border.on && st.border.width > 0) add(layer('Border', around, (ctx) => drawBorders(ctx, [it], st)));
		const title = plainText(img.title).trim() || img.name.replace(/\.[^.]+$/, '');
		groups.push({ name: `${String(i + 1).padStart(Math.max(2, digits), '0')} ${title}`.slice(0, 250), children: group, opened: false });
	}
	// Layers are listed bottom first; reversing puts cell 01 at the top of Photoshop's panel.
	children.push(...groups.reverse());
	if (st.lines.on && st.lines.width > 0) push(layer('Divider lines', full, (ctx) => drawLines(ctx, layout, st.lines)));

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
		const img = images[i];
		if (!it || !hasImage(img)) continue;
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
		const { source, done } = await decodeEdited(img);
		for (const layer of layerOrder(style)) {
			if (layer === 'image') drawImage(ctx, it, source, borderInset(style, 1));
			else if (!caps) continue;
			else if (layer === 'fade') drawFades(ctx, [it], [images[i]], style);
			else drawCaptions(ctx, [it.cell], [images[i]], style.captions, 1);
		}
		done();
		drawBorders(ctx, [it], style);
		out.push({ index: i, blob: await canvasToBlob(canvas, 'png') });
	}
	return out;
}
