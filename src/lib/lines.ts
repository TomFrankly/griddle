/**
 * Divider lines: the lines through the gaps between cells, in a choice of line types, with marks
 * where lines cross and ornaments along them. Lines are drawn opaque onto a separate layer and
 * composited once, so overlaps never show through at partial opacity.
 */
import type { Layout } from './grid';

export type LineType =
	| 'solid'
	| 'dotted'
	| 'dashed'
	| 'dash-dot'
	| 'double'
	| 'thick-thin'
	| 'wavy'
	| 'zigzag'
	| 'scalloped'
	| 'stitched'
	| 'perforated'
	| 'beaded'
	| 'diamonds'
	| 'stars'
	| 'hand'
	| 'brush'
	| 'torn'
	| 'none';

export type Mark = 'none' | 'gap' | 'dot' | 'plus' | 'square' | 'diamond' | 'star';
export type Ornament = 'none' | 'dot' | 'diamond' | 'star' | 'square';

export type LineStyle = {
	on: boolean;
	width: number;
	color: string;
	opacity: number;
	type: LineType;
	/** Pattern repeat length (dots, dashes, waves), in output pixels. */
	spacing: number;
	/** Height of waves, zigzags and wobble, in output pixels. */
	amplitude: number;
	cap: 'round' | 'square';
	/** What is drawn where lines meet. */
	crossing: Mark;
	/** A motif in the middle of each line segment. */
	ornament: Ornament;
	markSize: number;
	/** How far each segment stops short of crossings and edges, in output pixels. */
	inset: number;
	/** Fades the lines out toward the canvas edges. */
	fade: boolean;
	gradient: boolean;
	color2: string;
};

export const DEFAULT_LINES: LineStyle = {
	on: false,
	width: 2,
	color: '#000000',
	opacity: 25,
	type: 'solid',
	spacing: 14,
	amplitude: 4,
	cap: 'round',
	crossing: 'none',
	ornament: 'none',
	markSize: 14,
	inset: 0,
	fade: false,
	gradient: false,
	color2: '#888888'
};

export const LINE_TYPES: { group: string; items: { value: LineType; label: string }[] }[] = [
	{
		group: 'Basic',
		items: [
			{ value: 'solid', label: 'Solid' },
			{ value: 'dotted', label: 'Dotted' },
			{ value: 'dashed', label: 'Dashed' },
			{ value: 'dash-dot', label: 'Dash dot' },
			{ value: 'double', label: 'Double' },
			{ value: 'thick-thin', label: 'Thick and thin' }
		]
	},
	{
		group: 'Shaped',
		items: [
			{ value: 'wavy', label: 'Wavy' },
			{ value: 'zigzag', label: 'Zigzag' },
			{ value: 'scalloped', label: 'Scalloped' },
			{ value: 'stitched', label: 'Stitched' },
			{ value: 'perforated', label: 'Perforated' }
		]
	},
	{
		group: 'Ornamental',
		items: [
			{ value: 'beaded', label: 'Beaded' },
			{ value: 'diamonds', label: 'Diamonds' },
			{ value: 'stars', label: 'Stars' }
		]
	},
	{
		group: 'Texture',
		items: [
			{ value: 'hand', label: 'Hand-drawn' },
			{ value: 'brush', label: 'Brush' },
			{ value: 'torn', label: 'Torn paper' }
		]
	},
	{ group: 'Other', items: [{ value: 'none', label: 'Marks only' }] }
];

export const MARKS: { value: Mark; label: string }[] = [
	{ value: 'none', label: 'Nothing' },
	{ value: 'gap', label: 'Gap' },
	{ value: 'dot', label: 'Dot' },
	{ value: 'plus', label: 'Crosshair' },
	{ value: 'square', label: 'Square' },
	{ value: 'diamond', label: 'Diamond' },
	{ value: 'star', label: 'Star' }
];

export const ORNAMENTS: { value: Ornament; label: string }[] = [
	{ value: 'none', label: 'None' },
	{ value: 'dot', label: 'Dot' },
	{ value: 'diamond', label: 'Diamond' },
	{ value: 'star', label: 'Star' },
	{ value: 'square', label: 'Square' }
];

/** Line types whose look depends on the spacing and amplitude settings. */
export const USES_SPACING = new Set<LineType>(['dotted', 'dashed', 'dash-dot', 'wavy', 'zigzag', 'scalloped', 'stitched', 'perforated', 'beaded', 'diamonds', 'stars']);
export const USES_AMPLITUDE = new Set<LineType>(['wavy', 'zigzag', 'stitched', 'hand', 'brush', 'torn']);
export const USES_CAP = new Set<LineType>(['solid', 'dashed', 'dash-dot', 'wavy', 'zigzag', 'scalloped', 'stitched', 'perforated']);

type Ctx = CanvasRenderingContext2D;
type Seg = { axis: 'h' | 'v'; at: number; a: number; b: number };
type Piece = { axis: 'h' | 'v'; at: number; a: number; b: number };

const EPS = 1e-6;

/** The divider segments of a layout, merged so each straight run is one segment. */
export function segments(layout: Layout): Seg[] {
	const { slots, cells, gutter: g, bandAbove: ba, bandBelow: bb, cols, rows } = layout;
	if (!cells.length) return [];
	const top = (i: number) => (slots[i].r === 0 ? 0 : cells[i].y - ba - g / 2);
	const bottom = (i: number) => (slots[i].r + slots[i].h >= rows ? layout.height : cells[i].y + cells[i].h + bb + g / 2);
	const left = (i: number) => (slots[i].c < EPS ? 0 : cells[i].x - g / 2);
	const right = (i: number) => (slots[i].c + slots[i].w > cols - EPS ? layout.width : cells[i].x + cells[i].w + g / 2);
	const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - EPS && b0 < a1 - EPS;
	const raw: Seg[] = [];
	slots.forEach((p, i) => {
		if (slots.some((q) => Math.abs(q.c - (p.c + p.w)) < EPS && overlaps(p.r, p.r + p.h, q.r, q.r + q.h)))
			raw.push({ axis: 'v', at: cells[i].x + cells[i].w + g / 2, a: top(i), b: bottom(i) });
		if (slots.some((q) => Math.abs(q.r - (p.r + p.h)) < EPS && overlaps(p.c - 0.5, p.c + p.w + 0.5, q.c, q.c + q.w)))
			raw.push({ axis: 'h', at: cells[i].y + cells[i].h + bb + g / 2, a: left(i), b: right(i) });
	});
	// Merge runs on the same line that touch or overlap.
	const groups = new Map<string, Seg[]>();
	for (const s of raw) {
		const k = `${s.axis}:${s.at.toFixed(3)}`;
		groups.set(k, [...(groups.get(k) ?? []), s]);
	}
	const out: Seg[] = [];
	for (const list of groups.values()) {
		list.sort((x, y) => x.a - y.a);
		let cur = { ...list[0] };
		for (const s of list.slice(1)) {
			if (s.a <= cur.b + 0.5) cur.b = Math.max(cur.b, s.b);
			else {
				out.push(cur);
				cur = { ...s };
			}
		}
		out.push(cur);
	}
	return out;
}

/** Points where a horizontal and a vertical segment meet, including T-junctions. */
export function crossings(segs: Seg[]): { x: number; y: number }[] {
	const pts: { x: number; y: number }[] = [];
	const tol = 0.5;
	for (const v of segs) {
		if (v.axis !== 'v') continue;
		for (const h of segs) {
			if (h.axis !== 'h') continue;
			if (h.at >= v.a - tol && h.at <= v.b + tol && v.at >= h.a - tol && v.at <= h.b + tol) pts.push({ x: v.at, y: h.at });
		}
	}
	return pts;
}

/** Splits segments at crossings and pulls the ends in for gaps and floating lines. */
function pieces(segs: Seg[], pts: { x: number; y: number }[], l: LineStyle, split: boolean): Piece[] {
	const cross = l.crossing === 'gap' ? Math.max(l.width * 2, l.markSize / 2) : 0;
	const out: Piece[] = [];
	for (const s of segs) {
		const along = pts
			.filter((p) => (s.axis === 'v' ? Math.abs(p.x - s.at) < 0.5 : Math.abs(p.y - s.at) < 0.5))
			.map((p) => (s.axis === 'v' ? p.y : p.x));
		const inner = split ? along : [];
		const stops = [...new Set([s.a, ...inner.filter((t) => t > s.a + 0.5 && t < s.b - 0.5), s.b])].sort((x, y) => x - y);
		const isCross = (t: number) => along.some((c) => Math.abs(c - t) < 0.5);
		for (let i = 0; i < stops.length - 1; i++) {
			const a = stops[i] + l.inset + (isCross(stops[i]) ? cross : 0);
			const b = stops[i + 1] - l.inset - (isCross(stops[i + 1]) ? cross : 0);
			if (b - a > 0.5) out.push({ axis: s.axis, at: s.at, a, b });
		}
	}
	return out;
}

/** A small deterministic random source, so textured lines don't change between redraws. */
function seeded(...n: number[]) {
	let h = 2166136261;
	for (const v of n) h = Math.imul(h ^ Math.round(v * 10), 16777619);
	return () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return ((h ^= h >>> 16) >>> 0) / 4294967296;
	};
}

export function drawMark(ctx: Ctx, kind: Mark | Ornament, x: number, y: number, size: number, width: number) {
	const s = size;
	ctx.beginPath();
	switch (kind) {
		case 'dot':
			ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
			break;
		case 'plus': {
			const t = Math.max(1, width);
			ctx.rect(x - s / 2, y - t / 2, s, t);
			ctx.rect(x - t / 2, y - s / 2, t, s);
			break;
		}
		case 'square':
			ctx.rect(x - s * 0.3, y - s * 0.3, s * 0.6, s * 0.6);
			break;
		case 'diamond':
			ctx.moveTo(x, y - s * 0.45);
			ctx.lineTo(x + s * 0.32, y);
			ctx.lineTo(x, y + s * 0.45);
			ctx.lineTo(x - s * 0.32, y);
			ctx.closePath();
			break;
		case 'star':
			for (let i = 0; i < 10; i++) {
				const r = i % 2 ? s * 0.22 : s * 0.5;
				const a = -Math.PI / 2 + (i * Math.PI) / 5;
				if (i) ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
				else ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
			}
			ctx.closePath();
			break;
		default:
			return;
	}
	ctx.fill();
}

/** Evenly spread repeats along a length, so a pattern starts and ends cleanly. */
const repeats = (len: number, period: number) => {
	const n = Math.max(1, Math.round(len / Math.max(1, period)));
	return { n, step: len / n };
};

/** Draws one piece in local space: it runs from (0, 0) to (len, 0). */
function drawPiece(ctx: Ctx, len: number, l: LineStyle, seed: () => number) {
	const w = Math.max(0.5, l.width);
	const amp = Math.max(0, l.amplitude);
	const period = Math.max(w * 1.5, l.spacing);
	ctx.lineWidth = w;
	ctx.lineCap = l.cap === 'round' ? 'round' : 'butt';
	ctx.lineJoin = 'round';
	const stroke = (path: () => void) => {
		ctx.beginPath();
		path();
		ctx.stroke();
	};
	const dashes = (pattern: number[]) => {
		ctx.save();
		ctx.setLineDash(pattern);
		stroke(() => {
			ctx.moveTo(0, 0);
			ctx.lineTo(len, 0);
		});
		ctx.restore();
	};
	switch (l.type) {
		case 'none':
			return;
		case 'solid':
			if (l.cap === 'round') stroke(() => (ctx.moveTo(0, 0), ctx.lineTo(len, 0)));
			else ctx.fillRect(0, -w / 2, len, w);
			return;
		case 'dotted': {
			const { n, step } = repeats(len, period);
			ctx.beginPath();
			for (let i = 0; i <= n; i++) {
				const r = Math.max(1, w * 0.75);
				ctx.moveTo(i * step + r, 0);
				ctx.arc(i * step, 0, r, 0, Math.PI * 2);
			}
			ctx.fill();
			return;
		}
		case 'dashed': {
			const { step } = repeats(len, period);
			const cap = l.cap === 'round' ? w : 0;
			dashes([Math.max(0.1, step * 0.6 - cap), step * 0.4 + cap]);
			return;
		}
		case 'dash-dot': {
			const { step } = repeats(len, period * 1.6);
			const cap = l.cap === 'round' ? w : 0;
			const dot = l.cap === 'round' ? 0.01 : w;
			dashes([Math.max(0.1, step * 0.5 - cap), step * 0.2 + cap, dot, Math.max(0.1, step * 0.3 - dot + cap)]);
			return;
		}
		case 'double': {
			const t = Math.max(1, w * 0.6);
			ctx.fillRect(0, -w - t / 2, len, t);
			ctx.fillRect(0, w - t / 2, len, t);
			return;
		}
		case 'thick-thin': {
			const thin = Math.max(1, w / 3);
			ctx.fillRect(0, -w * 1.2, len, w * 1.4);
			ctx.fillRect(0, w * 0.6, len, thin);
			return;
		}
		case 'wavy':
		case 'zigzag':
		case 'scalloped': {
			const { n, step } = repeats(len, period);
			stroke(() => {
				ctx.moveTo(0, 0);
				for (let i = 0; i < n; i++) {
					const x0 = i * step;
					if (l.type === 'zigzag') {
						ctx.lineTo(x0 + step / 2, -amp);
						ctx.lineTo(x0 + step, 0);
					} else if (l.type === 'scalloped') {
						ctx.arc(x0 + step / 2, 0, step / 2, Math.PI, 0);
					} else {
						ctx.bezierCurveTo(x0 + step * 0.18, -amp * 1.3, x0 + step * 0.32, -amp * 1.3, x0 + step / 2, 0);
						ctx.bezierCurveTo(x0 + step * 0.68, amp * 1.3, x0 + step * 0.82, amp * 1.3, x0 + step, 0);
					}
				}
			});
			return;
		}
		case 'stitched': {
			const { n, step } = repeats(len, period);
			const h = Math.max(w, amp);
			stroke(() => {
				for (let i = 0; i < n; i++) {
					const x = (i + 0.5) * step;
					ctx.moveTo(x - step * 0.3, h / 2);
					ctx.lineTo(x + step * 0.3, -h / 2);
				}
			});
			return;
		}
		case 'perforated': {
			const { n, step } = repeats(len, Math.max(w * 2, period * 0.5));
			ctx.beginPath();
			for (let i = 0; i < n; i++) ctx.rect(i * step + step * 0.15, -w / 2, step * 0.7, w);
			ctx.fill();
			return;
		}
		case 'beaded':
		case 'diamonds':
		case 'stars': {
			const thin = Math.max(0.75, w / 3);
			ctx.fillRect(0, -thin / 2, len, thin);
			const { n, step } = repeats(len, Math.max(period, w * 4));
			const kind = l.type === 'beaded' ? 'dot' : l.type === 'diamonds' ? 'diamond' : 'star';
			const size = l.type === 'beaded' ? w * 3 : w * 4;
			for (let i = 0; i <= n; i++) drawMark(ctx, kind, i * step, 0, size, w);
			return;
		}
		case 'hand':
		case 'brush':
		case 'torn': {
			const r = seeded(len, w, amp);
			const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
			const f1 = (Math.PI * 2) / (90 + r() * 60);
			const f2 = (Math.PI * 2) / (25 + r() * 20);
			const sample = Math.max(2, Math.min(6, len / 60));
			const xs: number[] = [];
			for (let x = 0; x < len; x += sample) xs.push(x);
			xs.push(len);
			const mid = (x: number) => (l.type === 'torn' ? 0 : amp * 0.5 * (Math.sin(x * f1 + ph[0]) * 0.65 + Math.sin(x * f2 + ph[1]) * 0.35));
			const half = (x: number, side: number) => {
				const end = Math.max(0, Math.min(1, x / (w * 3), (len - x) / (w * 3)));
				if (l.type === 'torn') return w / 2 + amp * 0.3 + (r() - 0.5) * amp * 0.6;
				if (l.type === 'brush') {
					const swell = 0.55 + 0.45 * Math.sin((x / len) * Math.PI);
					return (w / 2) * (0.6 + 0.8 * swell) * (0.4 + 0.6 * end) + (r() - 0.5) * w * 0.15 * side;
				}
				return (w / 2) * (0.8 + 0.3 * Math.sin(x * f2 * 0.7 + ph[2])) * (0.75 + 0.25 * end);
			};
			ctx.beginPath();
			xs.forEach((x, i) => (i ? ctx.lineTo(x, mid(x) - half(x, -1)) : ctx.moveTo(x, mid(x) - half(x, -1))));
			for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], mid(xs[i]) + half(xs[i], 1));
			ctx.closePath();
			ctx.fill();
			if (l.type === 'hand') {
				// A faint second pass, like a pen going over the line again.
				ctx.save();
				ctx.globalAlpha = 0.35;
				ctx.lineWidth = Math.max(0.5, w * 0.35);
				stroke(() => xs.forEach((x, i) => (i ? ctx.lineTo(x, mid(x) + Math.sin(x * f2 + ph[3]) * w * 0.4) : ctx.moveTo(x, mid(x)))));
				ctx.restore();
			}
			return;
		}
	}
}

let layerCanvas: HTMLCanvasElement | null = null;

/** Draws the layout's divider lines onto `ctx`, honouring its current transform. */
export function drawLines(ctx: Ctx, layout: Layout, l: LineStyle) {
	if (!l.on || l.width <= 0 || !layout.cells.length) return;
	const segs = segments(layout);
	if (!segs.length) return;
	const pts = crossings(segs);
	// Lines run unbroken through crossings unless something needs a break there.
	const list = pieces(segs, pts, l, l.crossing === 'gap' || l.inset > 0);
	const cells = pieces(segs, pts, { ...l, crossing: 'none', inset: 0 }, true);

	const target = ctx.canvas;
	layerCanvas ??= document.createElement('canvas');
	const layer = layerCanvas;
	if (layer.width !== target.width || layer.height !== target.height) {
		layer.width = target.width;
		layer.height = target.height;
	}
	const lc = layer.getContext('2d');
	if (!lc) return;
	lc.setTransform(1, 0, 0, 1, 0, 0);
	lc.clearRect(0, 0, layer.width, layer.height);
	lc.setTransform(ctx.getTransform());

	let paint: string | CanvasGradient = l.color;
	if (l.gradient) {
		const g = lc.createLinearGradient(0, 0, layout.width, layout.height);
		g.addColorStop(0, l.color);
		g.addColorStop(1, l.color2);
		paint = g;
	}
	lc.fillStyle = paint;
	lc.strokeStyle = paint;

	for (const p of list) {
		lc.save();
		if (p.axis === 'h') lc.translate(p.a, p.at);
		else {
			lc.translate(p.at, p.a);
			lc.rotate(Math.PI / 2);
		}
		drawPiece(lc, p.b - p.a, l, seeded(p.a, p.at, p.b - p.a));
		lc.restore();
	}
	const orn = l.ornament !== 'none' && l.type !== 'none' ? l.ornament : null;
	if (orn) {
		// Clear a little space in the middle of each cell-length run, then place the ornament.
		const gap = l.markSize * 0.8;
		const across = l.width * 4 + l.amplitude * 3 + 4;
		for (const p of cells) {
			if (p.b - p.a < gap + l.width * 4) continue;
			const m = (p.a + p.b) / 2;
			const [x, y] = p.axis === 'h' ? [m, p.at] : [p.at, m];
			lc.save();
			lc.globalCompositeOperation = 'destination-out';
			if (p.axis === 'h') lc.fillRect(x - gap / 2, y - across / 2, gap, across);
			else lc.fillRect(x - across / 2, y - gap / 2, across, gap);
			lc.restore();
			drawMark(lc, orn, x, y, l.markSize, l.width);
		}
	}
	if (l.crossing !== 'none' && l.crossing !== 'gap') for (const c of pts) drawMark(lc, l.crossing, c.x, c.y, l.markSize, l.width);

	if (l.fade) {
		// Keep the middle and fade out toward each edge.
		lc.save();
		lc.globalCompositeOperation = 'destination-in';
		const cx = layout.width / 2;
		const cy = layout.height / 2;
		lc.translate(cx, cy);
		lc.scale(1, layout.height / layout.width);
		const g = lc.createRadialGradient(0, 0, 0, 0, 0, layout.width / 2);
		g.addColorStop(0, 'rgba(0,0,0,1)');
		g.addColorStop(0.45, 'rgba(0,0,0,1)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		lc.fillStyle = g;
		lc.fillRect(-cx, -cy * (layout.width / layout.height), layout.width, layout.width);
		lc.restore();
	}

	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.globalAlpha = Math.min(1, Math.max(0, l.opacity / 100));
	ctx.drawImage(layer, 0, 0);
	ctx.restore();
}
