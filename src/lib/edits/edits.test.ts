import { describe, expect, it } from 'vitest';
import { editsKey, normalizeEdits, pickGroups, resetGroups, sharedEdit, valueOf, withEdits } from './edits';
import type { ImageEdits } from './edits';
import { editedSize, rotationCrop } from './geometry';
import { OPERATIONS, PARAMS } from './registry';
import { FRAG } from './pixel-gl';
import { IDENTITY_CURVE, parseCurve, sampleCurve } from './curves';
import { applyImageEdit, copySettings, pasteChanges } from '../cell-edits';

describe('operations registry', () => {
	it('gives every parameter a unique id', () => {
		const ids = PARAMS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('builds one shader with a uniform for every pixel parameter', () => {
		for (const op of OPERATIONS.filter((o) => o.stage === 'pixel'))
			for (const p of op.params.filter((q) => q.kind !== 'curve')) expect(FRAG).toContain(`uniform ${p.kind === 'color' ? 'vec3' : 'float'} u_${p.id};`);
		expect(FRAG).not.toContain('u_angle');
	});
});

describe('edit values', () => {
	it('keeps only values that differ from the initial one', () => {
		const e = withEdits({}, { exposure: 1, contrast: 0, flipH: true });
		expect(e).toEqual({ exposure: 1, flipH: true });
		expect(withEdits(e, { exposure: 0 })).toEqual({ flipH: true });
	});

	it('keeps numbers in range and on their step, and ignores invalid values', () => {
		expect(withEdits({}, { exposure: 99 }).exposure).toBe(3);
		expect(withEdits({}, { exposure: 0.37 }).exposure).toBe(0.35);
		expect(withEdits({}, { exposure: 'loud', nope: 4, flipH: 'yes' })).toEqual({});
	});

	it('wraps quarter turns around', () => {
		expect(withEdits({}, { turn: 360 })).toEqual({});
		expect(withEdits({}, { turn: -90 }).turn).toBe(270);
	});

	it('cleans stored edits from older versions', () => {
		expect(normalizeEdits(undefined)).toEqual({});
		expect(normalizeEdits({ saturation: 20, gone: 1 })).toEqual({ saturation: 20 });
	});

	it('reports a shared value or null when images differ', () => {
		expect(sharedEdit([{ exposure: 1 }, { exposure: 1 }], 'exposure')).toBe(1);
		expect(sharedEdit([{}, { contrast: 0 }], 'contrast')).toBe(0);
		expect(sharedEdit([{ exposure: 1 }, {}], 'exposure')).toBeNull();
	});

	it('gives a cache key that changes with the edits', () => {
		expect(editsKey({ exposure: 1 })).not.toBe(editsKey({ exposure: 2 }));
		expect(editsKey({ exposure: 1, flipH: true })).toBe(editsKey({ flipH: true, exposure: 1 }));
	});
});

describe('bulk changes', () => {
	it('turns and flips each image from where it is', () => {
		expect(applyImageEdit({ turn: 270 }, { kind: 'shift', id: 'turn', by: 90 })).toEqual({});
		expect(applyImageEdit({}, { kind: 'shift', id: 'turn', by: -90 })).toEqual({ turn: 270 });
		expect(applyImageEdit({ flipH: true }, { kind: 'shift', id: 'flipH', by: 1 })).toEqual({});
	});

	it('copies framing and every edit, so pasting also clears what the source left alone', () => {
		const copied = copySettings({ zoom: 2, ox: 0, oy: 0 }, { exposure: 1 });
		const target: ImageEdits = { contrast: 40, exposure: -1 };
		const pasted = pasteChanges(copied).reduce((e, c) => applyImageEdit(e, c), target);
		expect(pasted).toEqual({ exposure: 1 });
	});

	it('resets and picks by group', () => {
		expect(withEdits({ exposure: 1, saturation: 10 }, resetGroups(['light']))).toEqual({ saturation: 10 });
		expect(Object.keys(pickGroups({}, ['geometry'])).sort()).toEqual(['angle', 'flipH', 'flipV', 'turn']);
		expect(valueOf({}, 'turn')).toBe(0);
	});
});

describe('geometry', () => {
	it('swaps width and height on quarter turns', () => {
		expect(editedSize(300, 200, { turn: 90 })).toEqual({ width: 200, height: 300 });
		expect(editedSize(300, 200, { turn: 180, flipH: true })).toEqual({ width: 300, height: 200 });
	});

	it('crops a free rotation so the turned image has no empty corners', () => {
		const k = rotationCrop(300, 200, 10);
		const s = editedSize(300, 200, { angle: 10 });
		expect(s.width).toBeCloseTo(300 * k);
		expect(s.width / s.height).toBeCloseTo(1.5);
		// The cropped box, turned back, must fit inside the original.
		const t = (10 * Math.PI) / 180;
		expect(s.width * Math.cos(t) + s.height * Math.sin(t)).toBeLessThanOrEqual(300 + 1e-9);
		expect(s.width * Math.sin(t) + s.height * Math.cos(t)).toBeLessThanOrEqual(200 + 1e-9);
	});
});

describe('curves', () => {
	it('stores curves as sorted, deduplicated text', () => {
		expect(withEdits({}, { curve: '1,1 0,0.1 0.5,0.6' })).toEqual({ curve: '0,0.1 0.5,0.6 1,1' });
		expect(withEdits({}, { curve: '0,0 1,1' })).toEqual({});
		expect(withEdits({}, { curve: 'nonsense' })).toEqual({});
	});

	it('samples a smooth line through every point without overshooting', () => {
		const pts = parseCurve('0,0 0.25,0.1 0.5,0.5 1,1')!;
		const s = sampleCurve(pts, 101);
		expect(s[0]).toBeCloseTo(0);
		expect(s[25]).toBeCloseTo(0.1, 2);
		expect(s[50]).toBeCloseTo(0.5, 2);
		expect(s[100]).toBeCloseTo(1);
		for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1] - 1e-6);
	});

	it('is a straight line for the identity curve', () => {
		const s = sampleCurve(parseCurve(IDENTITY_CURVE)!, 11);
		s.forEach((y, i) => expect(y).toBeCloseTo(i / 10));
	});
});
