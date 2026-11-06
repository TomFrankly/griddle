import { describe, expect, it } from 'vitest';
import { autoGrid, computeLayout, minZoom, placeImage, placeSlots, randomSpans } from './grid';

const base = { cols: 3, rows: 3, aspect: 1, longEdge: 1000, gutter: 10, padding: 10 };

describe('computeLayout', () => {
	it('fills a full 3×3 grid edge to edge', () => {
		const l = computeLayout({ ...base, count: 9 });
		expect(l.width).toBe(1000);
		expect(l.height).toBe(1000);
		expect(l.cells).toHaveLength(9);
		expect(l.cells[0]).toEqual({ x: 10, y: 10, w: 320, h: 320 });
		const last = l.cells[8];
		expect(last.x + last.w).toBe(990);
		expect(last.y + last.h).toBe(990);
	});

	it('centers two images in the last row of a 3×3 grid with 8 images', () => {
		const l = computeLayout({ ...base, count: 8 });
		const [a, b] = l.cells.slice(6);
		const left = a.x;
		const right = l.width - (b.x + b.w);
		expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
		expect(b.x - (a.x + a.w)).toBeCloseTo(10, 0);
		expect(a.y).toBe(l.cells[3].y + (l.cells[3].y - l.cells[0].y));
	});

	it('centers a single leftover image', () => {
		const l = computeLayout({ ...base, count: 7 });
		const c = l.cells[6];
		expect(Math.abs(c.x + c.w / 2 - l.width / 2)).toBeLessThanOrEqual(1);
	});

	it('drops empty rows and leaves out images beyond cols × rows', () => {
		expect(computeLayout({ ...base, count: 4 }).rows).toBe(2);
		const over = computeLayout({ ...base, count: 12 });
		expect(over.used).toBe(9);
		expect(over.cells).toHaveLength(9);
	});

	it('keeps every cell the same size and aspect ratio', () => {
		const l = computeLayout({ ...base, cols: 4, rows: 3, aspect: 16 / 9, longEdge: 1920, count: 10 });
		for (const c of l.cells) {
			expect(Math.abs(c.w - l.cells[0].w)).toBeLessThanOrEqual(1);
			expect(Math.abs(c.w / c.h - 16 / 9)).toBeLessThan(0.02);
		}
		expect(l.width).toBe(1920);
	});

	it('applies the long edge to the height when the grid is tall', () => {
		const l = computeLayout({ ...base, cols: 2, rows: 4, count: 8, longEdge: 2000 });
		expect(l.height).toBe(2000);
		expect(l.width).toBeLessThan(2000);
	});

	it('uses edge padding separately from the gap', () => {
		const none = computeLayout({ ...base, count: 9, padding: 0 });
		expect(none.cells[0]).toMatchObject({ x: 0, y: 0 });
		expect(none.cells[8].x + none.cells[8].w).toBe(1000);
		const wide = computeLayout({ ...base, count: 9, padding: 50 });
		expect(wide.cells[0]).toMatchObject({ x: 50, y: 50 });
		expect(wide.cells[1].x - (wide.cells[0].x + wide.cells[0].w)).toBe(10);
	});

	it('handles zero images and bad input without throwing', () => {
		const l = computeLayout({ ...base, count: 0, cols: NaN, gutter: -5 });
		expect(l.cells).toHaveLength(0);
		expect(l.width).toBeGreaterThan(0);
	});
});

describe('placeImage', () => {
	const cell = { x: 0, y: 0, w: 100, h: 100 };
	it('covers the cell, centered, for fill', () => {
		const r = placeImage(400, 200, cell, 'fill');
		expect(r).toMatchObject({ x: -50, y: 0, w: 200, h: 100, slackX: 100, slackY: 0 });
	});
	it('letterboxes inside the cell for fit', () => {
		const r = placeImage(400, 200, cell, 'fit');
		expect(r).toMatchObject({ x: 0, y: 25, w: 100, h: 50 });
	});
	it('pans to either edge of the overflow and no further', () => {
		expect(placeImage(400, 200, cell, 'fill', { zoom: 1, ox: 1, oy: 0 }).x).toBe(-100);
		expect(placeImage(400, 200, cell, 'fill', { zoom: 1, ox: -1, oy: 0 }).x).toBe(0);
		expect(placeImage(400, 200, cell, 'fill', { zoom: 1, ox: 9, oy: 0 }).x).toBe(-100);
		// No vertical overflow at zoom 1, so vertical pan does nothing.
		expect(placeImage(400, 200, cell, 'fill', { zoom: 1, ox: 0, oy: 1 }).y).toBe(0);
	});
	it('zooms around the center and keeps the cell covered', () => {
		const r = placeImage(400, 200, cell, 'fill', { zoom: 2, ox: 0, oy: 0 });
		expect(r).toMatchObject({ w: 400, h: 200, x: -150, y: -50 });
		const corner = placeImage(400, 200, cell, 'fill', { zoom: 2, ox: 1, oy: 1 });
		expect(corner.x + corner.w).toBe(100);
		expect(corner.y + corner.h).toBe(100);
	});
	it('clamps zoom to the allowed range', () => {
		expect(placeImage(100, 100, cell, 'fill', { zoom: 0.1, ox: 0, oy: 0 }).w).toBe(25);
		expect(placeImage(100, 100, cell, 'fill', { zoom: 99, ox: 0, oy: 0 }).w).toBe(500);
	});
});

describe('spans', () => {
	it('places a 2×2 cell and fills the holes around it', () => {
		const slots = placeSlots(6, [{ w: 2, h: 2 }], 3, 3);
		expect(slots[0]).toEqual({ c: 0, r: 0, w: 2, h: 2 });
		expect(slots[1]).toEqual({ c: 2, r: 0, w: 1, h: 1 });
		expect(slots[2]).toEqual({ c: 2, r: 1, w: 1, h: 1 });
		expect(slots[3]).toEqual({ c: 0, r: 2, w: 1, h: 1 });
		expect(slots).toHaveLength(6);
	});

	it('sizes a spanning cell to cover its cells and the gaps between them', () => {
		const l = computeLayout({ ...base, count: 6, spans: [{ w: 2, h: 2 }] });
		const big = l.cells[0];
		const small = l.cells[1];
		expect(big.w).toBe(small.w * 2 + 10);
		expect(big.h).toBe(small.h * 2 + 10);
	});

	it('stops at the first cell that does not fit', () => {
		const slots = placeSlots(3, [{ w: 1, h: 1 }, { w: 3, h: 3 }], 3, 2);
		expect(slots).toHaveLength(1);
	});
});

describe('frames and caption space', () => {
	it('fits the grid inside a fixed frame and centers it', () => {
		const l = computeLayout({ ...base, count: 9, frame: { w: 1600, h: 900 } });
		expect(l.width).toBe(1600);
		expect(l.height).toBe(900);
		const first = l.cells[0];
		const last = l.cells[8];
		expect(Math.abs(first.x - (1600 - (last.x + last.w)))).toBeLessThanOrEqual(1);
		expect(first.y).toBe(10);
	});

	it('stretches cells to fill a frame when aspect is 0', () => {
		const l = computeLayout({ ...base, aspect: 0, count: 6, cols: 3, rows: 2, frame: { w: 1210, h: 610 } });
		expect(l.cells[0]).toEqual({ x: 10, y: 10, w: 390, h: 290 });
	});

	it('reserves caption space above and below each row', () => {
		const l = computeLayout({ ...base, count: 3, cols: 3, rows: 1, bandAbove: 20, bandBelow: 30 });
		expect(l.cells[0].y).toBe(30);
		expect(l.height).toBe(10 + 20 + l.cells[0].h + 30 + 10);
	});
});

describe('autoGrid', () => {
	it('makes a square-ish grid', () => {
		expect(autoGrid(Array(9).fill({ w: 1, h: 1 }), 1)).toEqual({ cols: 3, rows: 3 });
		expect(autoGrid(Array(12).fill({ w: 1, h: 1 }), 1)).toEqual({ cols: 4, rows: 3 });
		expect(autoGrid(Array(4).fill({ w: 1, h: 1 }), 1)).toEqual({ cols: 2, rows: 2 });
	});

	it('follows a wide target shape', () => {
		const g = autoGrid(Array(8).fill({ w: 1, h: 1 }), 1, 16 / 9);
		expect(g.cols).toBeGreaterThan(g.rows);
	});

	it('leaves room for spanning cells', () => {
		const g = autoGrid([{ w: 2, h: 2 }, ...Array(5).fill({ w: 1, h: 1 })], 1);
		expect(placeSlots(6, [{ w: 2, h: 2 }], g.cols, g.rows)).toHaveLength(6);
	});
});

describe('randomSpans', () => {
	it('makes at least one larger cell and keeps every image placeable', () => {
		let seed = 7;
		const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
		for (let n = 2; n <= 12; n++) {
			const spans = randomSpans(n, 1, 1, rnd);
			expect(spans).toHaveLength(n);
			expect(spans.some((s) => s.w > 1 || s.h > 1)).toBe(true);
			const g = autoGrid(spans, 1);
			expect(placeSlots(n, spans, g.cols, g.rows)).toHaveLength(n);
		}
	});
});

describe('zooming out a filled image', () => {
	const cell = { x: 0, y: 0, w: 200, h: 100 };
	it('lets a filled image shrink until all of it shows, and further', () => {
		expect(minZoom(100, 100, cell, 'fill')).toBeCloseTo(0.125);
		const p = placeImage(100, 100, cell, 'fill', { zoom: 0.5, ox: 0, oy: 0 });
		expect(p.h).toBeCloseTo(100);
		expect(p.w).toBeCloseTo(100);
		expect(p.x).toBeCloseTo(50);
	});
	it('stops at a quarter of the whole image', () => {
		const p = placeImage(100, 100, cell, 'fill', { zoom: 0.01, ox: 0, oy: 0 });
		expect(p.h).toBeCloseTo(25);
	});
	it('lets fitted images shrink to a quarter', () => {
		expect(minZoom(100, 100, cell, 'fit')).toBe(0.25);
		expect(placeImage(100, 100, cell, 'fit', { zoom: 0.25, ox: 0, oy: 0 }).h).toBeCloseTo(25);
	});
	it('moves a shrunken image anywhere inside its cell', () => {
		const left = placeImage(100, 100, cell, 'fill', { zoom: 0.5, ox: -1, oy: 0 });
		expect(left.x).toBeCloseTo(0);
		const right = placeImage(100, 100, cell, 'fill', { zoom: 0.5, ox: 1, oy: 1 });
		expect(right.x + right.w).toBeCloseTo(200);
		expect(right.y + right.h).toBeCloseTo(100);
		const top = placeImage(100, 100, cell, 'fill', { zoom: 0.25, ox: 0, oy: -1 });
		expect(top.y).toBeCloseTo(0);
	});
	it('moves a free image until only a sliver still overlaps the cell', () => {
		const sq = { x: 0, y: 0, w: 100, h: 100 };
		expect(placeImage(100, 100, sq, 'fill', { zoom: 1, ox: 1, oy: 0 }).x).toBe(0);
		const moved = placeImage(100, 100, sq, 'fill', { zoom: 1, ox: 1, oy: -1 }, true);
		expect(moved.x).toBeCloseTo(80);
		expect(moved.y).toBeCloseTo(-80);
		const big = placeImage(100, 100, sq, 'fill', { zoom: 2, ox: -1, oy: 0 }, true);
		expect(big.x + big.w).toBeCloseTo(30);
	});
});
