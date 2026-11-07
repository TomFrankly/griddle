import { describe, expect, it } from 'vitest';
import { autoToneFromPixels } from './auto';

const image = (pixel: (i: number) => [number, number, number], n = 4096) => {
	const d = new Uint8ClampedArray(n * 4);
	for (let i = 0; i < n; i++) {
		const [r, g, b] = pixel(i);
		d.set([r, g, b, 255], i * 4);
	}
	return d;
};

describe('autoToneFromPixels', () => {
	it('brightens a dark image and stretches its range', () => {
		const out = autoToneFromPixels(image((i) => { const v = 20 + (i % 60); return [v, v, v]; }));
		expect(out.exposure).toBeGreaterThan(0.5);
		expect(out.blacks).toBeLessThanOrEqual(0);
	});

	it('warms a blue cast and cools an orange one', () => {
		expect(autoToneFromPixels(image((i) => [90 + (i % 40), 110 + (i % 40), 160 + (i % 40)])).temperature).toBeGreaterThan(10);
		expect(autoToneFromPixels(image((i) => [170 + (i % 40), 120 + (i % 40), 80 + (i % 40)])).temperature).toBeLessThan(-10);
	});

	it('leaves a well-exposed neutral image nearly alone', () => {
		const out = autoToneFromPixels(image((i) => { const v = Math.round((i / 4095) * 255); return [v, v, v]; }));
		expect(Math.abs(out.exposure)).toBeLessThan(0.3);
		expect(Math.abs(out.temperature)).toBeLessThan(3);
		expect(Math.abs(out.tint)).toBeLessThan(3);
	});

	it('ignores transparent pixels', () => {
		expect(autoToneFromPixels(new Uint8ClampedArray(64))).toEqual({});
	});
});
