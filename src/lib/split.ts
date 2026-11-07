import type { Layout, Rect } from './grid';
import { assignColumns, partitionRows, type FrameFill } from './masonry';

/**
 * A split layout: the canvas is divided into a row (side by side) or a column (stacked), and each
 * part can be divided again. Leaves are images, by id. A container's children carry weights (their
 * share of its space); without weights, each child gets the share that crops its photos least.
 */
export type SplitNode = { t: 'leaf'; id: string; w?: number } | { t: 'row' | 'col'; kids: SplitNode[]; w?: number };
export type SplitBox = Extract<SplitNode, { t: 'row' | 'col' }>;

/** Which edge of an image another one is dropped on. */
export type Side = 'left' | 'right' | 'top' | 'bottom';

/** A handle between two neighbors: dragging it trades space between them. */
export type SplitGap = {
	/** Child indexes from the root down to the container. */
	path: number[];
	/** The gap sits after child `j`. */
	j: number;
	axis: 'v' | 'h';
	rect: Rect;
	/** Pixel length of each child along the container's axis. */
	lens: number[];
};

export const leaf = (id: string): SplitNode => ({ t: 'leaf', id });
export const box = (t: 'row' | 'col', kids: SplitNode[]): SplitBox => ({ t, kids });

/** Image ids in reading order. */
export function leafIds(n: SplitNode): string[] {
	return n.t === 'leaf' ? [n.id] : n.kids.flatMap(leafIds);
}

/** Drops containers with one child and merges a child that splits the same way as its parent. */
export function tidy(n: SplitNode): SplitNode {
	if (n.t === 'leaf') return n;
	const kids: SplitNode[] = [];
	const weighted = n.kids.every((k) => k.w !== undefined);
	for (const raw of n.kids) {
		const k = tidy(raw);
		if (k.t === n.t) {
			const inner = k.kids.every((c) => c.w !== undefined) && weighted;
			const total = inner ? k.kids.reduce((s, c) => s + (c.w ?? 0), 0) : 0;
			for (const c of k.kids) kids.push(inner && total > 0 ? { ...c, w: ((c.w ?? 0) / total) * (k.w ?? 0) } : { ...c, w: undefined });
		} else kids.push(k);
	}
	if (!kids.length) return n;
	if (kids.length === 1) return { ...kids[0], w: n.w };
	const allWeighted = kids.every((k) => k.w !== undefined);
	return { ...n, kids: allWeighted ? kids : kids.map((k) => ({ ...k, w: undefined })) };
}

/** Forgets every hand-set size, so the layout re-balances to fit the photos. */
export function rebalance(n: SplitNode): SplitNode {
	return n.t === 'leaf' ? { ...n, w: undefined } : { ...n, w: undefined, kids: n.kids.map(rebalance) };
}

export function nodeAt(n: SplitNode, path: number[]): SplitNode {
	return path.reduce<SplitNode>((m, i) => (m.t === 'leaf' ? m : m.kids[i]), n);
}

/** A copy of the tree with the container at `path` replaced. */
export function updateAt(n: SplitNode, path: number[], fn: (m: SplitNode) => SplitNode): SplitNode {
	if (!path.length) return fn(n);
	if (n.t === 'leaf') return n;
	const [i, ...rest] = path;
	return { ...n, kids: n.kids.map((k, j) => (j === i ? updateAt(k, rest, fn) : k)) };
}

/** Sets the sizes of a container's children, keeping its own weight. */
export function setWeights(n: SplitNode, path: number[], weights: number[]): SplitNode {
	return updateAt(n, path, (m) => (m.t === 'leaf' ? m : { ...m, kids: m.kids.map((k, j) => ({ ...k, w: Math.max(1e-3, weights[j]) })) }));
}

function removeLeaf(n: SplitNode, id: string): SplitNode | null {
	if (n.t === 'leaf') return n.id === id ? null : n;
	const kids = n.kids.map((k) => removeLeaf(k, id)).filter((k): k is SplitNode => !!k);
	return kids.length ? { ...n, kids } : null;
}

function insertBeside(n: SplitNode, target: string, side: Side, add: SplitNode): SplitNode {
	if (n.t === 'leaf') return n;
	const dir = side === 'left' || side === 'right' ? 'row' : 'col';
	const after = side === 'right' || side === 'bottom';
	const kids: SplitNode[] = [];
	for (const k of n.kids) {
		if (k.t === 'leaf' && k.id === target) {
			if (n.t === dir) kids.push(...(after ? [k, add] : [add, k]));
			else kids.push({ t: dir, kids: after ? [{ ...k, w: undefined }, add] : [add, { ...k, w: undefined }] });
		} else kids.push(insertBeside(k, target, side, add));
	}
	return { ...n, kids };
}

/** Moves image `id` beside `target`. Sizes re-balance afterwards. */
export function moveBeside(tree: SplitNode, id: string, target: string, side: Side): SplitNode {
	if (id === target) return tree;
	const rest = removeLeaf(tree, id);
	if (!rest) return tree;
	// Wrap the root so a single image (or a root that splits the other way) has a parent to join.
	const dir = side === 'left' || side === 'right' ? 'row' : 'col';
	const root: SplitBox = rest.t === dir ? rest : box(dir === 'row' ? 'col' : 'row', [rest]);
	return rebalance(tidy(insertBeside(root, target, side, leaf(id))));
}

/** Moves image `id` into a new line of the root (a new row, or a new column) at `index`. */
export function moveToNewLine(tree: SplitNode, id: string, index: number): SplitNode {
	const rest = removeLeaf(tree, id);
	if (!rest) return tree;
	const root: SplitBox = rest.t === 'leaf' ? box(tree.t === 'row' ? 'row' : 'col', [rest]) : rest;
	const kids = [...root.kids];
	kids.splice(Math.max(0, Math.min(index, kids.length)), 0, leaf(id));
	return rebalance(tidy({ ...root, kids }));
}

/**
 * Brings a tree in line with the current images. With the same images in a new order, the shape
 * stays and the images flow into it in that order. Missing images are taken out, and new ones go
 * into a new row (or column) at the end, after which sizes re-balance.
 */
export function reconcile(tree: SplitNode, ids: string[]): SplitNode | null {
	if (!ids.length) return null;
	const have = leafIds(tree);
	const want = new Set(ids);
	let t: SplitNode | null = tree;
	let changed = false;
	for (const id of have)
		if (!want.has(id)) {
			t = t && removeLeaf(t, id);
			changed = true;
		}
	const known = new Set(have);
	const added = ids.filter((id) => !known.has(id));
	if (added.length) {
		changed = true;
		const line: SplitNode = added.length === 1 ? leaf(added[0]) : box(t?.t === 'row' ? 'col' : 'row', added.map(leaf));
		if (!t) t = line;
		else if (t.t === 'leaf') t = box('col', [t, line]);
		else t = { ...t, kids: [...t.kids, line] };
	}
	if (!t) return null;
	if (changed) t = rebalance(tidy(t));
	// Fill the leaves with the images in list order.
	let i = 0;
	const fill = (n: SplitNode): SplitNode => (n.t === 'leaf' ? { ...n, id: ids[i++] } : { ...n, kids: n.kids.map(fill) });
	return fill(t);
}

type Lin = { wa: number; wb: number; ha: number; hb: number };

/**
 * Each node's natural size as straight lines: width = wa·height + wb, and height = ha·width + hb,
 * counting the gaps and caption bands inside it.
 */
function linear(n: SplitNode, aspect: (id: string) => number, g: number, bands: number, memo: Map<SplitNode, Lin>): Lin {
	const hit = memo.get(n);
	if (hit) return hit;
	let out: Lin;
	if (n.t === 'leaf') {
		const a = aspect(n.id);
		out = { wa: a, wb: -a * bands, ha: 1 / a, hb: bands };
	} else {
		const ls = n.kids.map((k) => linear(k, aspect, g, bands, memo));
		const gaps = g * (n.kids.length - 1);
		if (n.t === 'row') {
			const A = ls.reduce((s, l) => s + l.wa, 0);
			const B = ls.reduce((s, l) => s + l.wb, 0) + gaps;
			out = { wa: A, wb: B, ha: 1 / A, hb: -B / A };
		} else {
			const A = ls.reduce((s, l) => s + l.ha, 0);
			const B = ls.reduce((s, l) => s + l.hb, 0) + gaps;
			out = { ha: A, hb: B, wa: 1 / A, wb: -B / A };
		}
	}
	memo.set(n, out);
	return out;
}

export type SplitInput = {
	tree: SplitNode;
	/** Width / height of each image, by id. */
	aspect: (id: string) => number;
	/** Image ids in list order; cells come back in this order. */
	ids: string[];
	longEdge: number;
	frame?: { w: number; h: number } | null;
	frameFill?: FrameFill;
	gutter: number;
	padding: number;
	bandAbove?: number;
	bandBelow?: number;
};

const nonNeg = (n: number | undefined) => Math.max(0, Number.isFinite(n) ? (n as number) : 0);
const clampInt = (n: number, min: number, max: number) =>
	Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));

/** Lays out a split tree. Returns the usual layout plus the gap handles and divider lines. */
export function computeSplit(input: SplitInput): Layout & { gaps: SplitGap[] } {
	const g = nonNeg(input.gutter);
	const p = nonNeg(input.padding);
	const ba = nonNeg(input.bandAbove);
	const bb = nonNeg(input.bandBelow);
	const bands = ba + bb;
	const safe = (id: string) => {
		const a = input.aspect(id);
		return a > 0 && Number.isFinite(a) ? Math.min(20, Math.max(0.05, a)) : 1;
	};
	const memo = new Map<SplitNode, Lin>();
	const lin = (n: SplitNode) => linear(n, safe, g, bands, memo);
	const root = lin(input.tree);

	// The block's natural size, then the canvas around it.
	let width: number;
	let height: number;
	let bw: number;
	let bh: number;
	const frame = input.frame && input.frame.w > 0 && input.frame.h > 0 ? input.frame : null;
	if (frame) {
		width = clampInt(frame.w, 16, 20000);
		height = clampInt(frame.h, 16, 20000);
		bw = Math.max(1, width - 2 * p);
		bh = Math.max(1, height - 2 * p);
		if (input.frameFill === 'fit') {
			const h = root.ha * bw + root.hb;
			if (h > bh) bw = Math.max(1, Math.min(bw, root.wa * bh + root.wb));
			else bh = Math.max(1, h);
		}
	} else {
		const L = clampInt(input.longEdge, 16, 20000);
		bw = Math.max(1, L - 2 * p);
		bh = Math.max(1, root.ha * bw + root.hb);
		if (bh + 2 * p > L) {
			bh = Math.max(1, L - 2 * p);
			bw = Math.max(1, root.wa * bh + root.wb);
		}
		width = Math.round(bw + 2 * p);
		height = Math.round(bh + 2 * p);
	}

	const boxes = new Map<string, Rect>();
	const gaps: SplitGap[] = [];
	const dividers: { axis: 'h' | 'v'; at: number; a: number; b: number }[] = [];
	const walk = (n: SplitNode, x: number, y: number, w: number, h: number, path: number[]) => {
		if (n.t === 'leaf') {
			boxes.set(n.id, { x, y, w, h });
			return;
		}
		const row = n.t === 'row';
		const span = Math.max(1, (row ? w : h) - g * (n.kids.length - 1));
		// Hand-set sizes win; otherwise each child gets its natural share at this size.
		const raw = n.kids.every((k) => k.w !== undefined)
			? n.kids.map((k) => k.w as number)
			: n.kids.map((k) => {
					const l = lin(k);
					return Math.max(1e-3, row ? l.wa * h + l.wb : l.ha * w + l.hb);
				});
		const total = raw.reduce((s, v) => s + v, 0) || 1;
		const lens = raw.map((v) => (v / total) * span);
		let at = row ? x : y;
		n.kids.forEach((k, j) => {
			const len = lens[j];
			if (row) walk(k, at, y, len, h, [...path, j]);
			else walk(k, x, at, w, len, [...path, j]);
			at += len;
			if (j < n.kids.length - 1) {
				const rect = row ? { x: at, y, w: g, h } : { x, y: at, w, h: g };
				gaps.push({ path, j, axis: row ? 'v' : 'h', rect, lens });
				dividers.push(row ? { axis: 'v', at: at + g / 2, a: y, b: y + h } : { axis: 'h', at: at + g / 2, a: x, b: x + w });
				at += g;
			}
		});
	};
	const bx = (width - bw) / 2;
	const by = (height - bh) / 2;
	walk(input.tree, bx, by, bw, bh, []);
	// Lines that reach the block's edge run on to the canvas edge, as they do in the grid.
	for (const d of dividers) {
		const [lo, hi, end] = d.axis === 'v' ? [by, by + bh, height] : [bx, bx + bw, width];
		if (d.a <= lo + 0.5) d.a = 0;
		if (d.b >= hi - 0.5) d.b = end;
	}

	const cells: Rect[] = input.ids.map((id) => {
		const b = boxes.get(id) ?? { x: 0, y: 0, w: 1, h: 1 + bands };
		const x = Math.round(b.x);
		const y = Math.round(b.y + ba);
		return { x, y, w: Math.max(1, Math.round(b.x + b.w) - x), h: Math.max(1, Math.round(b.y + b.h - bb) - y) };
	});
	const lines = input.tree.t === 'leaf' ? 1 : input.tree.kids.length;
	return {
		width,
		height,
		cols: input.tree.t === 'row' ? lines : 1,
		rows: input.tree.t === 'col' ? lines : 1,
		used: cells.length,
		cells,
		slots: cells.map(() => ({ c: 0, r: 0, w: 1, h: 1 })),
		bandAbove: ba,
		bandBelow: bb,
		gutter: g,
		dividers,
		gaps
	};
}

/**
 * The starting arrangement: rows of about equal height (photos in order), or columns where each
 * photo goes in the shortest one.
 */
export function autoTree(arrange: 'rows' | 'columns', ids: string[], aspects: number[], lines: number, width: number, gutter: number, bands: number): SplitNode | null {
	if (!ids.length) return null;
	if (arrange === 'rows') {
		const rows = partitionRows(aspects, lines, width, gutter).map(([a, b]) => box('row', ids.slice(a, b).map(leaf)));
		return tidy(box('col', rows));
	}
	const n = Math.max(1, Math.min(lines, ids.length));
	const colW = (width - (n - 1) * gutter) / n;
	const cols = assignColumns(aspects, n, colW, gutter, bands).filter((c) => c.length);
	return tidy(box('row', cols.map((c) => box('col', c.map((i) => leaf(ids[i]))))));
}
