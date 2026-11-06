export type Rect = { x: number; y: number; w: number; h: number };

export type Span = { w: number; h: number };

/** Where a cell sits in grid units. `c` can be fractional when a short last row is centered. */
export type Slot = { c: number; r: number; w: number; h: number };

export type LayoutInput = {
	count: number;
	/** How many columns and rows each image covers; missing entries are 1 × 1. */
	spans?: Span[];
	cols: number;
	rows: number;
	/** Cell width divided by cell height. 0 stretches cells to fill `frame`. */
	aspect: number;
	/** Length in pixels of the output's longer side (ignored when `frame` is set). */
	longEdge: number;
	/** A fixed output size; the grid is fitted and centered inside it. */
	frame?: { w: number; h: number } | null;
	/** Space between cells, in output pixels. */
	gutter: number;
	/** Space around the outside of the grid, in output pixels. */
	padding: number;
	/** Space reserved above and below every row of images, for captions. */
	bandAbove?: number;
	bandBelow?: number;
};

export type Layout = {
	width: number;
	height: number;
	cols: number;
	rows: number;
	/** How many images are placed (images that don't fit in cols × rows are left out). */
	used: number;
	/** The image area of each placed cell, in output pixels. */
	cells: Rect[];
	slots: Slot[];
	bandAbove: number;
	bandBelow: number;
	gutter: number;
};

const clampInt = (n: number, min: number, max: number) =>
	Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));
const nonNeg = (n: number | undefined) => Math.max(0, Number.isFinite(n) ? (n as number) : 0);

const spanOf = (spans: Span[] | undefined, i: number, cols: number, rows: number): Span => ({
	w: clampInt(spans?.[i]?.w ?? 1, 1, cols),
	h: clampInt(spans?.[i]?.h ?? 1, 1, rows)
});

/**
 * Places `count` cells on a grid of `cols` × `maxRows` units. With only 1 × 1 cells, a partly
 * filled last row is centered. With larger cells, each goes in the first free spot that fits
 * (row by row), so smaller cells fill the holes; placing stops at the first cell that doesn't fit.
 */
export function placeSlots(count: number, spans: Span[] | undefined, cols: number, maxRows: number): Slot[] {
	const n = Math.max(0, Math.floor(count));
	const sized = Array.from({ length: n }, (_, i) => spanOf(spans, i, cols, maxRows));
	if (sized.every((s) => s.w === 1 && s.h === 1)) {
		const used = Math.min(n, cols * maxRows);
		const rows = Math.ceil(used / cols);
		return Array.from({ length: used }, (_, i) => {
			const r = Math.floor(i / cols);
			const inRow = r === rows - 1 ? used - r * cols : cols;
			return { c: (cols - inRow) / 2 + (i % cols), r, w: 1, h: 1 };
		});
	}
	const taken: boolean[][] = Array.from({ length: maxRows }, () => Array(cols).fill(false));
	const fits = (c: number, r: number, s: Span) => {
		if (c + s.w > cols || r + s.h > maxRows) return false;
		for (let y = r; y < r + s.h; y++) for (let x = c; x < c + s.w; x++) if (taken[y][x]) return false;
		return true;
	};
	const out: Slot[] = [];
	for (const s of sized) {
		let spot: Slot | null = null;
		for (let r = 0; r < maxRows && !spot; r++)
			for (let c = 0; c < cols && !spot; c++) if (fits(c, r, s)) spot = { c, r, w: s.w, h: s.h };
		if (!spot) break;
		for (let y = spot.r; y < spot.r + s.h; y++) for (let x = spot.c; x < spot.c + s.w; x++) taken[y][x] = true;
		out.push(spot);
	}
	return out;
}

/**
 * Lays out equal grid cells (some may span several) at most `cols` × `rows`.
 * Rows with no images are dropped, and a partly filled last row of single cells is centered.
 */
export function computeLayout(input: LayoutInput): Layout {
	const cols = clampInt(input.cols, 1, 100);
	const maxRows = clampInt(input.rows, 1, 100);
	const slots = placeSlots(input.count, input.spans, cols, maxRows);
	const used = slots.length;
	const rows = Math.max(1, ...slots.map((s) => s.r + s.h));
	const frame = input.frame && input.frame.w > 0 && input.frame.h > 0 ? input.frame : null;
	const stretch = !(input.aspect > 0 && Number.isFinite(input.aspect));
	const aspect = stretch ? 1 : input.aspect;
	const gutter = nonNeg(input.gutter);
	const edge = nonNeg(input.padding);
	const bandAbove = nonNeg(input.bandAbove);
	const bandBelow = nonNeg(input.bandBelow);
	const bands = bandAbove + bandBelow;

	let cellW: number;
	let cellH: number;
	let width: number;
	let height: number;
	if (frame) {
		width = clampInt(frame.w, 16, 20000);
		height = clampInt(frame.h, 16, 20000);
		const availW = Math.max(cols, width - 2 * edge - (cols - 1) * gutter) / cols;
		const availH = Math.max(rows, height - 2 * edge - (rows - 1) * gutter - rows * bands) / rows;
		if (stretch) {
			cellW = availW;
			cellH = availH;
		} else {
			cellW = Math.min(availW, availH * aspect);
			cellH = cellW / aspect;
		}
	} else {
		const longEdge = clampInt(input.longEdge, 16, 20000);
		// Decide which side is longer from the cells alone, then solve for the cell size.
		if (cols * aspect >= rows * (1 + bands / Math.max(1, longEdge / rows))) {
			cellW = Math.max(1, (longEdge - 2 * edge - (cols - 1) * gutter) / cols);
			cellH = cellW / aspect;
		} else {
			cellH = Math.max(1, (longEdge - 2 * edge - (rows - 1) * gutter - rows * bands) / rows);
			cellW = cellH * aspect;
		}
		width = Math.round(2 * edge + cols * cellW + (cols - 1) * gutter);
		height = Math.round(2 * edge + rows * (cellH + bands) + (rows - 1) * gutter);
	}

	const gridW = cols * cellW + (cols - 1) * gutter;
	const gridH = rows * (cellH + bands) + (rows - 1) * gutter;
	const offX = (width - gridW) / 2;
	const offY = (height - gridH) / 2;
	const cells = slots.map((s) => {
		const x0 = offX + s.c * (cellW + gutter);
		const y0 = offY + s.r * (cellH + bands + gutter) + bandAbove;
		const x1 = x0 + s.w * cellW + (s.w - 1) * gutter;
		const y1 = y0 + s.h * cellH + (s.h - 1) * (gutter + bands);
		const x = Math.round(x0);
		const y = Math.round(y0);
		return { x, y, w: Math.round(x1) - x, h: Math.round(y1) - y };
	});

	return { width, height, cols, rows, used, cells, slots, bandAbove, bandBelow, gutter };
}

/**
 * Picks columns and rows for the given cells: enough room for all of them, with the grid's shape
 * close to `target` (width / height) and few empty spots.
 */
export function autoGrid(spans: Span[], aspect: number, target = 1): { cols: number; rows: number } {
	const n = spans.length;
	if (!n) return { cols: 1, rows: 1 };
	const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
	const area = spans.reduce((t, s) => t + Math.max(1, s.w) * Math.max(1, s.h), 0);
	const minCols = Math.max(1, ...spans.map((s) => s.w));
	let best = { cols: 1, rows: n, score: Infinity };
	for (let cols = minCols; cols <= Math.max(minCols, Math.min(12, area)); cols++) {
		let rows = Math.max(1, Math.ceil(area / cols), ...spans.map((s) => s.h));
		while (rows < 100 && placeSlots(n, spans, cols, rows).length < n) rows++;
		const filled = Math.max(...placeSlots(n, spans, cols, rows).map((s) => s.r + s.h));
		const empty = cols * filled - area;
		// Ties go to the wider grid.
		const score = Math.abs(Math.log((cols * a) / filled / target)) + (0.6 * empty) / cols + (cols * a < filled ? 0.01 : 0);
		if (score < best.score - 1e-9) best = { cols, rows: filled, score };
	}
	return { cols: best.cols, rows: best.rows };
}

/**
 * A random bento: a few cells made larger, picked from several tries so the grid has as few
 * empty spots as possible. `random` is injectable for tests.
 */
export function randomSpans(count: number, aspect: number, target = 1, random = Math.random): Span[] {
	const n = Math.max(0, Math.floor(count));
	if (n < 2) return Array.from({ length: n }, () => ({ w: 1, h: 1 }));
	// Any shape up to 3×3 that isn't too big for the number of images; ones the grid can't hold
	// are filtered out below.
	const shapes: Span[] = [];
	for (let w = 1; w <= 3; w++) for (let h = 1; h <= 3; h++) if (w * h > 1 && w * h <= Math.max(2, n / 2)) shapes.push({ w, h });
	let best: { spans: Span[]; score: number } | null = null;
	for (let t = 0; t < 60; t++) {
		const spans: Span[] = Array.from({ length: n }, () => ({ w: 1, h: 1 }));
		const big = 1 + Math.floor(random() * Math.max(1, Math.round(n / 4)));
		for (let k = 0; k < big; k++) spans[Math.floor(random() * n)] = { ...shapes[Math.floor(random() * shapes.length)] };
		const g = autoGrid(spans, aspect, target);
		// A span wider or taller than the grid gets cut, so skip those mixes.
		if (spans.some((s) => s.w > g.cols || s.h > g.rows)) continue;
		const area = spans.reduce((a, s) => a + s.w * s.h, 0);
		const kinds = new Set(spans.filter((s) => s.w * s.h > 1).map((s) => `${s.w}x${s.h}`)).size;
		// Fewer holes is better, a mix of shapes reads better, and a little noise keeps repeated
		// presses varied.
		const score = g.cols * g.rows - area - 0.75 * kinds + random() * 1.5;
		if (!best || score < best.score) best = { spans, score };
	}
	if (!best) return Array.from({ length: n }, () => ({ w: 1, h: 1 }));
	return best!.spans;
}

export type Adjust = {
	/** 1 is the default size (cover for fill, contain for fit). */
	zoom: number;
	/** -1 to 1: which part of the overflow shows (0 is centered, 1 shows the right / bottom edge). */
	ox: number;
	oy: number;
};

export const DEFAULT_ADJUST: Adjust = { zoom: 1, ox: 0, oy: 0 };

export const ZOOM_MAX = 5;

/**
 * The smallest zoom for an image in a cell. Filled images can zoom out until the whole image
 * shows; fitted images already show it all.
 */
export function minZoom(imgW: number, imgH: number, cell: { w: number; h: number }, mode: 'fill' | 'fit'): number {
	if (mode !== 'fill') return 1;
	const cover = Math.max(cell.w / imgW, cell.h / imgH);
	const contain = Math.min(cell.w / imgW, cell.h / imgH);
	return cover > 0 ? Math.min(1, contain / cover) : 1;
}

/** Where an image is drawn so it covers (fill) or fits inside (fit) a cell, after zoom and pan. */
export function placeImage(
	imgW: number,
	imgH: number,
	cell: Rect,
	mode: 'fill' | 'fit',
	adjust: Adjust = DEFAULT_ADJUST
): Rect & { slackX: number; slackY: number } {
	const base = mode === 'fill' ? Math.max(cell.w / imgW, cell.h / imgH) : Math.min(cell.w / imgW, cell.h / imgH);
	const zoom = Math.min(ZOOM_MAX, Math.max(minZoom(imgW, imgH, cell, mode), adjust.zoom || 1));
	const k = base * zoom;
	const w = imgW * k;
	const h = imgH * k;
	const slackX = Math.max(0, w - cell.w);
	const slackY = Math.max(0, h - cell.h);
	const ox = Math.min(1, Math.max(-1, adjust.ox || 0));
	const oy = Math.min(1, Math.max(-1, adjust.oy || 0));
	return {
		x: cell.x + (cell.w - w) / 2 - (ox * slackX) / 2,
		y: cell.y + (cell.h - h) / 2 - (oy * slackY) / 2,
		w,
		h,
		slackX,
		slackY
	};
}
