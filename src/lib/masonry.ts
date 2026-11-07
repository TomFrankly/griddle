import type { Layout, Rect, Slot } from './grid';

/** How cells are arranged: equal cells in a grid, justified rows, or masonry columns. */
export type Arrange = 'grid' | 'rows' | 'columns';

/** On a fixed canvas: crop the photos a little more to fill it, or leave a margin. */
export type FrameFill = 'trim' | 'fit';

export type MasonryInput = {
	arrange: 'rows' | 'columns';
	/** Width divided by height of each image, in order. */
	aspects: number[];
	/** How many rows (Rows) or columns (Columns). Leave out to pick automatically. */
	lines?: number | null;
	/** Length in pixels of the output's longer side (ignored when `frame` is set). */
	longEdge: number;
	frame?: { w: number; h: number } | null;
	frameFill?: FrameFill;
	/** Columns only: line up the bottoms of the columns by cropping a little. */
	even?: boolean;
	gutter: number;
	padding: number;
	bandAbove?: number;
	bandBelow?: number;
	/** Preferred width / height of the whole grid when picking automatically on a free canvas. */
	target?: number;
};

const nonNeg = (n: number | undefined) => Math.max(0, Number.isFinite(n) ? (n as number) : 0);
const clampInt = (n: number, min: number, max: number) =>
	Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));
const safeAspect = (a: number) => (a > 0 && Number.isFinite(a) ? Math.min(20, Math.max(0.05, a)) : 1);

/**
 * Splits images (in order) into exactly `count` rows whose heights, once each row fills `width`,
 * stay as close to each other as possible. Returns [start, end) index pairs.
 */
export function partitionRows(aspects: number[], count: number, width: number, gutter: number): [number, number][] {
	const n = aspects.length;
	if (!n) return [];
	const R = clampInt(count, 1, n);
	const total = aspects.reduce((s, a) => s + a, 0);
	// The height every row would have if they were all equal.
	const T = Math.max(1, (R * width - (n - R) * gutter) / total);
	const prefix = [0];
	for (const a of aspects) prefix.push(prefix[prefix.length - 1] + a);
	const cost = (j: number, i: number) => {
		const h = Math.max(1e-3, (width - (i - j - 1) * gutter) / (prefix[i] - prefix[j]));
		return Math.log(h / T) ** 2;
	};
	// best[r][i]: cheapest way to put the first i images into r rows.
	const best = Array.from({ length: R + 1 }, () => new Array(n + 1).fill(Infinity));
	const from = Array.from({ length: R + 1 }, () => new Array(n + 1).fill(0));
	best[0][0] = 0;
	for (let r = 1; r <= R; r++)
		for (let i = r; i <= n - (R - r); i++)
			for (let j = r - 1; j < i; j++) {
				const c = best[r - 1][j] + cost(j, i);
				if (c < best[r][i]) {
					best[r][i] = c;
					from[r][i] = j;
				}
			}
	const rows: [number, number][] = [];
	for (let r = R, i = n; r > 0; r--) {
		rows.unshift([from[r][i], i]);
		i = from[r][i];
	}
	return rows;
}

/** Places each image in the shortest column so far. Returns the image indexes per column. */
export function assignColumns(aspects: number[], count: number, colW: number, gutter: number, bands: number): number[][] {
	const K = clampInt(count, 1, Math.max(1, aspects.length));
	const cols = Array.from({ length: K }, () => ({ h: -gutter, items: [] as number[] }));
	aspects.forEach((a, i) => {
		let c = cols[0];
		for (const x of cols) if (x.h < c.h - 1e-6) c = x;
		c.items.push(i);
		c.h += gutter + bands + colW / a;
	});
	return cols.map((c) => c.items);
}

type Placed = { x: number; y: number; w: number; h: number; slot: Slot };
type Draft = { width: number; height: number; cols: number; rows: number; placed: Placed[]; crop: number; shape: number };

function rowsDraft(input: MasonryInput, aspects: number[], R: number): Draft {
	const g = nonNeg(input.gutter);
	const p = nonNeg(input.padding);
	const bands = nonNeg(input.bandAbove) + nonNeg(input.bandBelow);
	const frame = input.frame;
	const W0 = frame ? frame.w : clampInt(input.longEdge, 16, 20000);
	const Wi0 = Math.max(R, W0 - 2 * p);
	const groups = partitionRows(aspects, R, Wi0, g);
	const sums = groups.map(([a, b]) => aspects.slice(a, b).reduce((s, x) => s + x, 0));
	const ks = groups.map(([a, b]) => b - a);
	const n = groups.length;
	const fixed = n * bands + (n - 1) * g;
	// Block height for an inner width w: linear in w for a fixed set of rows.
	const invS = sums.reduce((s, x) => s + 1 / x, 0);
	const gapTerm = ks.reduce((s, k, r) => s + (k - 1) / sums[r], 0);
	const blockH = (w: number) => w * invS - g * gapTerm + fixed;
	const widthFor = (h: number) => Math.max(n, (h - fixed + g * gapTerm) / invS);

	let Wi = Wi0;
	let width: number;
	let height: number;
	let stretch = 1;
	if (!frame) {
		const longEdge = clampInt(input.longEdge, 16, 20000);
		const H = blockH(Wi) + 2 * p;
		if (H > W0) Wi = Math.min(Wi0, widthFor(longEdge - 2 * p));
		width = Math.round(Wi + 2 * p);
		height = Math.round(blockH(Wi) + 2 * p);
	} else {
		width = clampInt(frame.w, 16, 20000);
		height = clampInt(frame.h, 16, 20000);
		const Hi = Math.max(n, height - 2 * p);
		const natural = blockH(Wi);
		if (input.frameFill === 'fit') {
			if (natural > Hi) Wi = widthFor(Hi);
		} else {
			stretch = Math.max(0.05, (Hi - fixed) / Math.max(1e-3, natural - fixed));
		}
	}
	const rowsH = sums.map((s, r) => (Wi - (ks[r] - 1) * g) / s);
	const blockW = Wi;
	const totalH = rowsH.reduce((s, h) => s + h * stretch, 0) + fixed;
	const ox = (width - blockW) / 2;
	const oy = (height - totalH) / 2;
	const maxK = Math.max(...ks);
	const placed: Placed[] = [];
	let y = oy;
	groups.forEach(([a, b], r) => {
		const h = rowsH[r];
		let x = ox;
		for (let i = a; i < b; i++) {
			const w = aspects[i] * h;
			const c = ((x - ox) / (blockW + g)) * maxK;
			const cw = i === b - 1 ? maxK - c : ((w + g) / (blockW + g)) * maxK;
			placed.push({ x, y: y + nonNeg(input.bandAbove), w, h: h * stretch, slot: { c, r, w: cw, h: 1 } });
			x += w + g;
		}
		y += h * stretch + bands + g;
	});
	const crop = 1 - Math.min(stretch, 1 / stretch);
	return { width, height, cols: maxK, rows: n, placed, crop, shape: blockW / Math.max(1, blockH(Wi)) };
}

function columnsDraft(input: MasonryInput, aspects: number[], K: number): Draft {
	const g = nonNeg(input.gutter);
	const p = nonNeg(input.padding);
	const ba = nonNeg(input.bandAbove);
	const bands = ba + nonNeg(input.bandBelow);
	const frame = input.frame;
	const W0 = frame ? frame.w : clampInt(input.longEdge, 16, 20000);
	const Wi0 = Math.max(K, W0 - 2 * p);
	const cw0 = (Wi0 - (K - 1) * g) / K;
	const cols = assignColumns(aspects, K, cw0, g, bands).filter((c) => c.length);
	const k = cols.length;
	// A column's height is A * cellWidth + G.
	const A = cols.map((c) => c.reduce((s, i) => s + 1 / aspects[i], 0));
	const G = cols.map((c) => c.length * bands + (c.length - 1) * g);
	const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
	const even = frame ? input.frameFill !== 'fit' || input.even !== false : input.even !== false;
	const blockH = (cw: number) => (even ? mean(A) * cw + mean(G) : Math.max(...A.map((a, c) => a * cw + G[c])));
	const cwFor = (h: number) =>
		Math.max(1, even ? (h - mean(G)) / mean(A) : Math.min(...A.map((a, c) => (h - G[c]) / a)));

	let cw = cw0;
	let width: number;
	let height: number;
	let target: number;
	if (!frame) {
		const longEdge = clampInt(input.longEdge, 16, 20000);
		if (blockH(cw) + 2 * p > W0) cw = Math.min(cw0, cwFor(longEdge - 2 * p));
		target = blockH(cw);
		width = Math.round(k * cw + (k - 1) * g + 2 * p);
		height = Math.round(target + 2 * p);
	} else {
		width = clampInt(frame.w, 16, 20000);
		height = clampInt(frame.h, 16, 20000);
		const Hi = Math.max(1, height - 2 * p);
		if (input.frameFill === 'fit') {
			if (blockH(cw) > Hi) cw = cwFor(Hi);
			target = blockH(cw);
		} else target = Hi;
	}
	const blockW = k * cw + (k - 1) * g;
	const ox = (width - blockW) / 2;
	const oy = (height - target) / 2;
	const maxM = Math.max(...cols.map((c) => c.length));
	const placed: Placed[] = new Array(aspects.length);
	let cropSum = 0;
	cols.forEach((items, c) => {
		const natural = A[c] * cw;
		const s = even ? Math.max(0.05, (target - G[c]) / Math.max(1e-3, natural)) : 1;
		const colH = natural * s + G[c];
		let y = oy;
		items.forEach((i, j) => {
			const h = (cw / aspects[i]) * s;
			const r = ((y - oy) / (colH + g)) * maxM;
			const rh = j === items.length - 1 ? maxM - r : ((h + bands + g) / (colH + g)) * maxM;
			placed[i] = { x: ox + c * (cw + g), y: y + ba, w: cw, h, slot: { c, r, w: 1, h: rh } };
			cropSum += 1 - Math.min(s, 1 / s);
			y += h + bands + g;
		});
	});
	return { width, height, cols: k, rows: maxM, placed, crop: cropSum / aspects.length, shape: blockW / Math.max(1, blockH(cw)) };
}

function draftFor(input: MasonryInput, aspects: number[], lines: number): Draft {
	return input.arrange === 'rows' ? rowsDraft(input, aspects, lines) : columnsDraft(input, aspects, lines);
}

/** Picks the number of rows or columns whose shape suits the canvas with the least cropping. */
export function autoLines(input: MasonryInput): number {
	const aspects = input.aspects.map(safeAspect);
	const n = aspects.length;
	if (n < 2) return 1;
	const frame = input.frame;
	const p = nonNeg(input.padding);
	const target = frame ? Math.max(1, frame.w - 2 * p) / Math.max(1, frame.h - 2 * p) : (input.target ?? 1);
	const max = input.arrange === 'rows' ? n : Math.min(n, 8);
	let best = { lines: 1, score: Infinity };
	for (let L = 1; L <= max; L++) {
		const free = draftFor({ ...input, frame: null, longEdge: frame ? frame.w : input.longEdge }, aspects, L);
		let score = Math.abs(Math.log(free.shape / target));
		if (input.arrange === 'rows') {
			// Rows with a single image look like a mistake once there are a few images.
			const counts = new Map<number, number>();
			for (const c of free.placed) counts.set(c.slot.r, (counts.get(c.slot.r) ?? 0) + 1);
			if (n >= 3) score += 0.25 * [...counts.values()].filter((v) => v === 1).length;
		} else score += 2 * free.crop;
		if (score < best.score - 1e-9) best = { lines: L, score };
	}
	return best.lines;
}

/**
 * Lays out images that keep their own shapes: justified rows (every row fills the width) or
 * masonry columns (each image goes in the shortest column). Returns the same layout the grid does,
 * with `slots` in fractional units so divider lines find their neighbors.
 */
export function computeMasonry(input: MasonryInput): Layout {
	const aspects = input.aspects.length ? input.aspects.map(safeAspect) : [1];
	const lines = clampInt(input.lines ?? autoLines(input), 1, input.arrange === 'rows' ? aspects.length : Math.min(aspects.length, 100));
	const d = draftFor(input, aspects, lines);
	const cells: Rect[] = d.placed.map((c) => {
		const x = Math.round(c.x);
		const y = Math.round(c.y);
		return { x, y, w: Math.max(1, Math.round(c.x + c.w) - x), h: Math.max(1, Math.round(c.y + c.h) - y) };
	});
	return {
		width: d.width,
		height: d.height,
		cols: d.cols,
		rows: d.rows,
		used: cells.length,
		cells,
		slots: d.placed.map((c) => c.slot),
		bandAbove: nonNeg(input.bandAbove),
		bandBelow: nonNeg(input.bandBelow),
		gutter: nonNeg(input.gutter)
	};
}

/** How much of each image a layout crops away, from 0 (none) to 1. */
export function cropOf(layout: Layout, aspects: number[]): number[] {
	return layout.cells.map((c, i) => {
		const a = safeAspect(aspects[i]);
		const ca = c.w / c.h;
		return 1 - Math.min(ca / a, a / ca);
	});
}
