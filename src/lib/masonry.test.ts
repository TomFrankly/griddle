import { describe, expect, it } from 'vitest';
import { assignColumns, autoLines, computeMasonry, cropOf, partitionRows } from './masonry';
import { segments } from './lines';

const base = { longEdge: 2000, gutter: 20, padding: 20 };
const mixed = [1.5, 0.75, 1, 1.78, 0.67, 1.33, 1];

describe('partitionRows', () => {
	it('keeps images in order and uses exactly the rows asked for', () => {
		const rows = partitionRows(mixed, 3, 1000, 10);
		expect(rows).toHaveLength(3);
		expect(rows[0][0]).toBe(0);
		expect(rows[2][1]).toBe(mixed.length);
		rows.slice(1).forEach((r, i) => expect(r[0]).toBe(rows[i][1]));
	});
	it('balances rows by shape, not by count', () => {
		// One panorama is as wide as three squares.
		const rows = partitionRows([3, 1, 1, 1], 2, 1000, 0);
		expect(rows).toEqual([
			[0, 1],
			[1, 4]
		]);
	});
});

describe('assignColumns', () => {
	it('puts each image into the shortest column', () => {
		// A tall image fills column 0, so the next two both go to column 1.
		expect(assignColumns([0.25, 1, 1], 2, 100, 0, 0)).toEqual([[0], [1, 2]]);
	});
});

describe('computeMasonry rows', () => {
	it('keeps each image uncropped on a free canvas and fills every row to the same width', () => {
		const L = computeMasonry({ ...base, arrange: 'rows', aspects: mixed, lines: 3 });
		expect(L.used).toBe(mixed.length);
		const crops = cropOf(L, mixed);
		expect(Math.max(...crops)).toBeLessThan(0.02);
		const rights = new Map<number, number>();
		L.cells.forEach((c, i) => rights.set(L.slots[i].r, Math.max(rights.get(L.slots[i].r) ?? 0, c.x + c.w)));
		const ends = [...rights.values()];
		expect(Math.max(...ends) - Math.min(...ends)).toBeLessThanOrEqual(1);
	});
	it('makes the longer side the long edge', () => {
		const wide = computeMasonry({ ...base, arrange: 'rows', aspects: mixed, lines: 1 });
		expect(wide.width).toBe(2000);
		const tall = computeMasonry({ ...base, arrange: 'rows', aspects: mixed, lines: 7 });
		expect(tall.height).toBe(2000);
		expect(tall.width).toBeLessThan(2000);
	});
	it('fills a fixed canvas exactly when trimming', () => {
		const L = computeMasonry({ ...base, arrange: 'rows', aspects: mixed, frame: { w: 1080, h: 1350 } });
		expect(L.width).toBe(1080);
		expect(L.height).toBe(1350);
		const bottom = Math.max(...L.cells.map((c) => c.y + c.h));
		expect(Math.abs(bottom - (1350 - 20))).toBeLessThanOrEqual(1);
		expect(Math.min(...L.cells.map((c) => c.y))).toBe(20);
	});
	it('leaves a margin instead of cropping when fitting inside', () => {
		const aspects = [1, 1, 1, 1];
		const L = computeMasonry({ ...base, arrange: 'rows', aspects, lines: 1, frame: { w: 1080, h: 1080 }, frameFill: 'fit' });
		expect(Math.max(...cropOf(L, aspects))).toBeLessThan(0.02);
		expect(L.cells[0].y).toBeGreaterThan(100);
	});
	it('reserves caption bands above and below each row', () => {
		const L = computeMasonry({ ...base, arrange: 'rows', aspects: [1, 1, 1, 1], lines: 2, bandAbove: 30, bandBelow: 40 });
		const r0 = L.cells[0];
		const r1 = L.cells.find((_, i) => L.slots[i].r === 1)!;
		expect(r1.y - (r0.y + r0.h)).toBeCloseTo(40 + 20 + 30, -0.5);
	});
});

describe('computeMasonry columns', () => {
	it('lines up the bottoms when even, by cropping a little', () => {
		const L = computeMasonry({ ...base, arrange: 'columns', aspects: mixed, lines: 3 });
		const bottoms = new Map<number, number>();
		L.cells.forEach((c, i) => bottoms.set(L.slots[i].c, Math.max(bottoms.get(L.slots[i].c) ?? 0, c.y + c.h)));
		const b = [...bottoms.values()];
		expect(Math.max(...b) - Math.min(...b)).toBeLessThanOrEqual(1);
	});
	it('keeps every image uncropped when ragged', () => {
		const L = computeMasonry({ ...base, arrange: 'columns', aspects: mixed, lines: 3, even: false });
		expect(Math.max(...cropOf(L, mixed))).toBeLessThan(0.02);
		expect(new Set(L.cells.map((c) => c.w)).size).toBe(1);
	});
	it('never makes more columns than images', () => {
		const L = computeMasonry({ ...base, arrange: 'columns', aspects: [1, 1], lines: 5 });
		expect(L.cols).toBe(2);
	});
});

describe('autoLines', () => {
	it('picks more rows for a tall canvas than a wide one', () => {
		const aspects = Array(12).fill(1.5);
		const tall = autoLines({ ...base, arrange: 'rows', aspects, frame: { w: 1080, h: 1920 } });
		const wide = autoLines({ ...base, arrange: 'rows', aspects, frame: { w: 1920, h: 1080 } });
		expect(tall).toBeGreaterThan(wide);
	});
	it('picks more columns for a wide canvas than a tall one', () => {
		const aspects = Array(12).fill(0.8);
		const tall = autoLines({ ...base, arrange: 'columns', aspects, frame: { w: 1080, h: 1920 } });
		const wide = autoLines({ ...base, arrange: 'columns', aspects, frame: { w: 1920, h: 1080 } });
		expect(wide).toBeGreaterThan(tall);
	});
});

describe('divider lines', () => {
	it('finds the gaps between neighbors in rows', () => {
		const L = computeMasonry({ ...base, arrange: 'rows', aspects: [1, 1, 1, 2, 1], lines: 2 });
		const segs = segments(L);
		expect(segs.filter((s) => s.axis === 'h')).toHaveLength(1);
		// Two gaps in the top row and one in the bottom row, at different places.
		expect(segs.filter((s) => s.axis === 'v')).toHaveLength(3);
	});
	it('finds the gaps between columns and between stacked images', () => {
		const L = computeMasonry({ ...base, arrange: 'columns', aspects: [1, 1, 1, 1], lines: 2 });
		const segs = segments(L);
		expect(segs.filter((s) => s.axis === 'v')).toHaveLength(1);
		expect(segs.filter((s) => s.axis === 'h').length).toBeGreaterThanOrEqual(1);
	});
});
