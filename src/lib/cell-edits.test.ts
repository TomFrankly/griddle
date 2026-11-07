import { describe, expect, it } from 'vitest';
import { applyChange, copySettings, RESET_FRAMING, sharedValue, type EditTarget } from './cell-edits';
import { ZOOM_MAX } from './grid';

const opts = { fit: 'fill' as const, free: false };
const cell = { x: 0, y: 0, w: 100, h: 100 };
// A wide image in a square cell overflows sideways only.
const wide = (adjust = { zoom: 1, ox: 0, oy: 0 }): EditTarget => ({ adjust, width: 200, height: 100, area: cell });

describe('applyChange', () => {
	it('sets the same zoom on every target, within each one’s limits', () => {
		expect(applyChange(wide(), { kind: 'set', values: { zoom: 1.5 } }, opts).zoom).toBe(1.5);
		expect(applyChange(wide(), { kind: 'set', values: { zoom: 99 } }, opts).zoom).toBe(ZOOM_MAX);
	});

	it('multiplies zoom for scroll gestures', () => {
		const a = applyChange(wide({ zoom: 2, ox: 0, oy: 0 }), { kind: 'zoom', factor: 1.25 }, opts);
		expect(a.zoom).toBeCloseTo(2.5);
	});

	it('pans only where the image overflows, and stops at the edge', () => {
		const moved = applyChange(wide(), { kind: 'pan', dx: -20, dy: -20 }, opts);
		expect(moved.ox).toBeGreaterThan(0);
		expect(moved.oy).toBe(0);
		const far = applyChange(wide(), { kind: 'pan', dx: -10_000, dy: 0 }, opts);
		const further = applyChange({ ...wide(), adjust: far }, { kind: 'pan', dx: -50, dy: 0 }, opts);
		expect(further.ox).toBeCloseTo(far.ox);
	});

	it('starts a pan from the visible position when a set one is out of reach', () => {
		const set = applyChange(wide(), { kind: 'set', values: { ox: 1 } }, opts);
		expect(set.ox).toBe(1);
		const back = applyChange({ ...wide(), adjust: set }, { kind: 'pan', dx: 1, dy: 0 }, opts);
		expect(back.ox).toBeLessThan(1);
		expect(back.ox).toBeGreaterThan(0);
	});

	it('leaves cells that are off the grid unmoved by a pan', () => {
		const off = { ...wide(), area: null };
		expect(applyChange(off, { kind: 'pan', dx: 30, dy: 30 }, opts)).toEqual(off.adjust);
	});
});

describe('sharedValue and copied settings', () => {
	it('reports a shared value or null when mixed', () => {
		expect(sharedValue([{ zoom: 1.2, ox: 0, oy: 0 }, { zoom: 1.2, ox: 0.5, oy: 0 }], 'zoom')).toBe(1.2);
		expect(sharedValue([{ zoom: 1.2, ox: 0, oy: 0 }, { zoom: 1.2, ox: 0.5, oy: 0 }], 'ox')).toBeNull();
	});

	it('copies every setting and resets to the starting values', () => {
		expect(copySettings({ zoom: 2, ox: 0.1, oy: -0.2 }).framing).toEqual({ zoom: 2, ox: 0.1, oy: -0.2 });
		expect(applyChange(wide({ zoom: 2, ox: 0.3, oy: 0 }), { kind: 'set', values: RESET_FRAMING }, opts)).toEqual({ zoom: 1, ox: 0, oy: 0 });
	});
});
