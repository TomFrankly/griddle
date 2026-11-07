/**
 * Auto tone: reads an image's histogram and suggests exposure, whites, blacks and white balance
 * that spread its tones across the full range and neutralize a color cast. It runs per image, on
 * the device, from a small copy of the image.
 */

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number, step: number) => Math.round(n / step) * step;

/** Pixel values (RGBA, 0 to 255) to suggested edits. Transparent pixels are ignored. */
export function autoToneFromPixels(data: Uint8ClampedArray | Uint8Array): Record<string, number> {
	const hist = new Uint32Array(256);
	let r = 0;
	let g = 0;
	let b = 0;
	let n = 0;
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 128) continue;
		const R = data[i] / 255;
		const G = data[i + 1] / 255;
		const B = data[i + 2] / 255;
		const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
		hist[Math.round(y * 255)]++;
		// White balance looks at midtones only: shadows are noisy and highlights may be clipped.
		if (y > 0.15 && y < 0.85) {
			r += lin(R);
			g += lin(G);
			b += lin(B);
			n++;
		}
	}
	const total = hist.reduce((a, v) => a + v, 0);
	if (!total) return {};
	const pct = (p: number) => {
		let acc = 0;
		for (let i = 0; i < 256; i++) if ((acc += hist[i]) >= p * total) return i / 255;
		return 1;
	};
	const median = Math.max(0.02, pct(0.5));
	// Exposure brings the middle tone toward a natural middle gray, gently.
	const ev = clamp(Math.log2(lin(0.45) / lin(median)) * 0.6, -2, 2);
	const shift = (v: number) => srgb(clamp(lin(v) * 2 ** ev, 0, 1));
	// Whites and blacks then stretch what's left to fill the range (see the levels shader).
	const lo = shift(pct(0.005));
	const hi = shift(pct(0.995));
	const whites = clamp(((1 - hi) / 0.25) * 100, 0, 100);
	const blacks = clamp((-lo / 0.2) * 100, -100, 0);
	const out: Record<string, number> = { exposure: round(ev, 0.05), whites: Math.round(whites), blacks: Math.round(blacks) };
	if (n > 50) {
		// Gray world: the midtones should average out to neutral (see the white balance shader).
		const t = clamp(((b - r) / (b + r)) / 0.35, -1, 1);
		const m = clamp((1 - (r + b) / 2 / g) / 0.25, -1, 1);
		out.temperature = Math.round(t * 70);
		out.tint = Math.round(m * 70);
	}
	return out;
}

/** Suggested edits for an image, read from a copy at most 256 pixels across. */
export function autoTone(source: CanvasImageSource & { width: number; height: number }): Record<string, number> {
	const k = Math.min(1, 256 / Math.max(source.width, source.height));
	const w = Math.max(1, Math.round(source.width * k));
	const h = Math.max(1, Math.round(source.height * k));
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d', { willReadFrequently: true });
	if (!ctx) return {};
	ctx.drawImage(source, 0, 0, w, h);
	return autoToneFromPixels(ctx.getImageData(0, 0, w, h).data);
}
