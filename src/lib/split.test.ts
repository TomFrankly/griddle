import { describe, expect, it } from 'vitest';
import { autoTree, box, computeSplit, leaf, leafIds, moveBeside, moveToNewLine, rebalance, reconcile, setWeights, tidy, type SplitNode } from './split';
import { segments } from './lines';

const shapes: Record<string, number> = { a: 1.5, b: 0.75, c: 1, d: 1.78, e: 0.67, f: 1.33 };
const aspect = (id: string) => shapes[id] ?? 1;
const ids = Object.keys(shapes);
const base = { aspect, longEdge: 2000, gutter: 20, padding: 20 };
const crop = (r: { w: number; h: number }, a: number) => 1 - Math.min(r.w / r.h / a, a / (r.w / r.h));
const rowsOf = (t: SplitNode) => (t.t === 'col' ? t.kids.map((k) => leafIds(k)) : [leafIds(t)]);

describe('tidy', () => {
	it('merges a row inside a row and unwraps single children', () => {
		const t = tidy(box('col', [box('row', [leaf('a'), box('row', [leaf('b'), leaf('c')])])]));
		expect(t).toEqual({ t: 'row', kids: [leaf('a'), leaf('b'), leaf('c')] });
	});
});

describe('moving images', () => {
	const rows = box('col', [box('row', [leaf('a'), leaf('b')]), box('row', [leaf('c'), leaf('d'), leaf('e')])]);
	it('puts an image beside another, which changes how many each row holds', () => {
		const t = moveBeside(rows, 'c', 'b', 'right');
		expect(rowsOf(t)).toEqual([
			['a', 'b', 'c'],
			['d', 'e']
		]);
	});
	it('stacks an image above or below another inside a row', () => {
		const t = moveBeside(rows, 'e', 'a', 'bottom');
		expect(t).toEqual(
			box('col', [box('row', [box('col', [leaf('a'), leaf('e')]), leaf('b')]), box('row', [leaf('c'), leaf('d')])])
		);
	});
	it('starts a new row', () => {
		const t = moveToNewLine(rows, 'a', 0);
		expect(rowsOf(t)).toEqual([['a'], ['b'], ['c', 'd', 'e']]);
	});
	it('re-balances hand-set sizes after a move', () => {
		const sized = setWeights(rows, [1], [5, 1, 1]);
		const t = moveBeside(sized, 'a', 'c', 'left');
		expect(JSON.stringify(t)).not.toContain('"w"');
	});
});

describe('reconcile', () => {
	const t = box('col', [box('row', [leaf('a'), leaf('b')]), box('row', [leaf('c')])]);
	it('keeps the shape and flows images in list order', () => {
		const r = reconcile(setWeights(t, [0], [2, 1]), ['b', 'a', 'c'])!;
		expect(leafIds(r)).toEqual(['b', 'a', 'c']);
		expect(r.t === 'col' && r.kids[0].t === 'row' && r.kids[0].kids[0].w).toBe(2);
	});
	it('takes out removed images and adds new ones in a new row', () => {
		const r = reconcile(t, ['a', 'c', 'x', 'y'])!;
		expect(rowsOf(r)).toEqual([['a'], ['c'], ['x', 'y']]);
	});
	it('returns nothing when there are no images', () => {
		expect(reconcile(t, [])).toBeNull();
	});
});

describe('computeSplit', () => {
	it('crops nothing on a free canvas when sizes are balanced', () => {
		const tree = autoTree('rows', ids, ids.map(aspect), 2, 1960, 20, 0)!;
		const L = computeSplit({ ...base, tree, ids });
		L.cells.forEach((c, i) => expect(crop(c, aspect(ids[i]))).toBeLessThan(0.02));
		expect(Math.max(L.width, L.height)).toBe(2000);
	});
	it('handles nested stacks without cropping', () => {
		const tree = box('row', [leaf('a'), box('col', [leaf('b'), leaf('c')]), leaf('d')]);
		const L = computeSplit({ ...base, tree, ids: ['a', 'b', 'c', 'd'], bandAbove: 30, bandBelow: 10 });
		L.cells.forEach((c, i) => expect(crop(c, aspect('abcd'[i]))).toBeLessThan(0.02));
	});
	it('fills a fixed canvas exactly', () => {
		const tree = autoTree('columns', ids, ids.map(aspect), 3, 1040, 20, 0)!;
		const L = computeSplit({ ...base, tree, ids, frame: { w: 1080, h: 1350 } });
		expect([L.width, L.height]).toEqual([1080, 1350]);
		expect(Math.max(...L.cells.map((c) => c.y + c.h))).toBeGreaterThanOrEqual(1329);
		expect(Math.min(...L.cells.map((c) => c.x))).toBe(20);
	});
	it('gives hand-set sizes their share, with a handle for each gap', () => {
		const tree = setWeights(box('row', [leaf('c'), leaf('c2')]), [], [3, 1]);
		const L = computeSplit({ ...base, tree, ids: ['c', 'c2'] });
		expect(L.cells[0].w / L.cells[1].w).toBeCloseTo(3, 1);
		expect(L.gaps).toHaveLength(1);
		expect(L.gaps[0].axis).toBe('v');
	});
	it('keeps the canvas size when only hand-set sizes change', () => {
		const tree = box('row', [leaf('a'), leaf('b')]);
		const a = computeSplit({ ...base, tree, ids: ['a', 'b'] });
		const b = computeSplit({ ...base, tree: setWeights(tree, [], [1, 4]), ids: ['a', 'b'] });
		expect([b.width, b.height]).toEqual([a.width, a.height]);
		const c = computeSplit({ ...base, tree: rebalance(setWeights(tree, [], [1, 4])), ids: ['a', 'b'] });
		expect(c.cells).toEqual(a.cells);
	});
	it('draws divider lines in every gap, edge to edge where they span the block', () => {
		const tree = box('col', [box('row', [leaf('a'), leaf('b')]), leaf('c')]);
		const L = computeSplit({ ...base, tree, ids: ['a', 'b', 'c'] });
		const segs = segments(L);
		const h = segs.find((s) => s.axis === 'h')!;
		expect([h.a, h.b]).toEqual([0, L.width]);
		const v = segs.find((s) => s.axis === 'v')!;
		expect(v.a).toBe(0);
		expect(v.b).toBeLessThan(L.height);
	});
});
