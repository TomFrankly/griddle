import { describe, expect, it } from 'vitest';
import { computeLayout, placeImage } from './grid';

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
		expect(placeImage(100, 100, cell, 'fill', { zoom: 0.2, ox: 0, oy: 0 }).w).toBe(100);
		expect(placeImage(100, 100, cell, 'fill', { zoom: 99, ox: 0, oy: 0 }).w).toBe(500);
	});
});
