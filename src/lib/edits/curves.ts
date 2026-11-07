/**
 * Tone curves: a few points from black to white that the image's tones are mapped through, with a
 * smooth line between them that never overshoots (monotone cubic interpolation). Curves are
 * stored as short text, such as `0,0 0.25,0.2 1,1`, so they compare and copy like other values.
 */

export type CurvePoint = [x: number, y: number];

export const IDENTITY_CURVE = '0,0 1,1';
const MAX_POINTS = 16;

const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Points sorted by x, one per x, within 0 to 1; null when the text isn't a curve. */
export function parseCurve(text: unknown): CurvePoint[] | null {
	if (typeof text !== 'string') return null;
	const pts: CurvePoint[] = [];
	for (const pair of text.trim().split(/\s+/)) {
		const [x, y] = pair.split(',').map(Number);
		if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
		pts.push([round(clamp01(x)), round(clamp01(y))]);
	}
	pts.sort((a, b) => a[0] - b[0]);
	const unique = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0]);
	return unique.length >= 2 && unique.length <= MAX_POINTS ? unique : null;
}

export const formatCurve = (pts: CurvePoint[]) => pts.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');

/** Samples a curve at `n` evenly spaced inputs from 0 to 1. Outside its end points it is flat. */
export function sampleCurve(pts: CurvePoint[], n = 256): Float32Array {
	const out = new Float32Array(n);
	const k = pts.length;
	// Fritsch–Carlson slopes keep each segment monotone, so the curve has no wiggles.
	const d: number[] = [];
	for (let i = 0; i < k - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / Math.max(1e-6, pts[i + 1][0] - pts[i][0]));
	const m: number[] = new Array(k);
	m[0] = d[0];
	m[k - 1] = d[k - 2];
	for (let i = 1; i < k - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
	for (let i = 0; i < k - 1; i++) {
		if (d[i] === 0) {
			m[i] = m[i + 1] = 0;
			continue;
		}
		const a = m[i] / d[i];
		const b = m[i + 1] / d[i];
		const s = a * a + b * b;
		if (s > 9) {
			const t = 3 / Math.sqrt(s);
			m[i] = t * a * d[i];
			m[i + 1] = t * b * d[i];
		}
	}
	let seg = 0;
	for (let j = 0; j < n; j++) {
		const x = j / (n - 1);
		if (x <= pts[0][0]) {
			out[j] = pts[0][1];
			continue;
		}
		if (x >= pts[k - 1][0]) {
			out[j] = pts[k - 1][1];
			continue;
		}
		while (seg < k - 2 && x > pts[seg + 1][0]) seg++;
		const [x0, y0] = pts[seg];
		const [x1, y1] = pts[seg + 1];
		const h = x1 - x0;
		const t = (x - x0) / h;
		const t2 = t * t;
		const t3 = t2 * t;
		out[j] = clamp01((2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[seg] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[seg + 1]);
	}
	return out;
}
