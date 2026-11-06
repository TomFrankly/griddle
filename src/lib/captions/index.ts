/**
 * Captions: a title and a description per image, each with its own font, size, color, shadow and
 * position. Text is stored as paragraphs of styled runs and laid out on the canvas here.
 */
import type { Rect } from '../grid';

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean };
/** Paragraphs of runs. */
export type RichText = Run[][];

export type TextShadow = { on: boolean; strength: number; distance: number; softness: number; color: string };

export type TextStyle = {
	on: boolean;
	font: string;
	/** Output pixels. */
	size: number;
	color: string;
	/** Above or below the image, or inside the cell at its top or bottom. */
	position: 'above' | 'below' | 'top' | 'bottom';
	/** Space above and below this text, in output pixels. */
	padTop: number;
	padBottom: number;
	/** Lines kept before the text is cut off with an ellipsis. */
	lines: number;
	shadow: TextShadow;
};

export type CaptionStyle = {
	on: boolean;
	align: 'left' | 'center' | 'right';
	title: TextStyle;
	desc: TextStyle;
};

const NO_SHADOW: TextShadow = { on: false, strength: 40, distance: 2, softness: 6, color: '#000000' };

export const DEFAULT_CAPTIONS: CaptionStyle = {
	on: false,
	align: 'center',
	title: { on: true, font: 'Inter', size: 36, color: '#111111', position: 'below', padTop: 16, padBottom: 4, lines: 1, shadow: { ...NO_SHADOW } },
	desc: { on: true, font: 'Inter', size: 24, color: '#555555', position: 'below', padTop: 4, padBottom: 16, lines: 2, shadow: { ...NO_SHADOW } }
};

export const LINE_HEIGHT = 1.3;

export const isEmpty = (t: RichText | undefined) => !t || t.every((p) => p.every((r) => !r.text.trim()));

export const plainText = (t: RichText | undefined) => (t ?? []).map((p) => p.map((r) => r.text).join('')).join('\n');

export const fromPlain = (s: string): RichText => s.split('\n').map((line) => (line ? [{ text: line }] : []));

type Part = { key: 'title' | 'desc'; style: TextStyle };

/** The title and description that are on, in the order they stack outward from the image. */
function parts(c: CaptionStyle, where: TextStyle['position']): Part[] {
	if (!c.on) return [];
	const list: Part[] = [];
	if (c.title.on && c.title.position === where) list.push({ key: 'title', style: c.title });
	if (c.desc.on && c.desc.position === where) list.push({ key: 'desc', style: c.desc });
	// Above the image the title still reads first, so the description is the nearer one.
	return where === 'above' ? list.reverse() : list;
}

/** Space taken inside each cell, at its top and bottom, by captions placed there. */
export function captionInsets(c: CaptionStyle): { top: number; bottom: number } {
	const sum = (p: Part[]) => p.reduce((t, x) => t + blockHeight(x.style), 0);
	return { top: sum(parts(c, 'top')), bottom: sum(parts(c, 'bottom')) };
}

const blockHeight = (s: TextStyle) => s.padTop + s.padBottom + Math.max(1, s.lines) * s.size * LINE_HEIGHT;

/** Space a row needs above and below its images. */
export function captionBands(c: CaptionStyle): { above: number; below: number } {
	const sum = (p: Part[]) => Math.ceil(p.reduce((t, x) => t + blockHeight(x.style), 0));
	return { above: sum(parts(c, 'above')), below: sum(parts(c, 'below')) };
}

// Fonts

/** The bundled family used for "Inter", so the default needs no network. */
const BUNDLED: Record<string, string> = { Inter: 'Inter Variable' };

export type FontEntry = { family: string; category: string; variants: string[] };
let catalog: Promise<FontEntry[]> | null = null;

/** All Google Fonts families, most popular first. Loaded on first use. */
export function fontCatalog(): Promise<FontEntry[]> {
	catalog ??= import('./google-fonts.json').then((m) =>
		(m.default as [string, string, string][]).map(([family, category, v]) => ({ family, category, variants: v.split(',') }))
	);
	return catalog;
}

const cssFamily = (family: string) => BUNDLED[family] ?? family;
const requested = new Map<string, Promise<void>>();

function nearest(variants: string[], weight: number, italic: boolean): string {
	const pool = variants.filter((v) => v.endsWith('i') === italic);
	const list = pool.length ? pool : variants;
	let best = list[0] ?? '400';
	for (const v of list) if (Math.abs(parseInt(v) - weight) < Math.abs(parseInt(best) - weight)) best = v;
	return best;
}

/** Loads the weights and styles used by captions from Google Fonts (once per family). */
export async function loadFont(family: string): Promise<void> {
	if (BUNDLED[family]) return;
	let p = requested.get(family);
	if (!p) {
		p = (async () => {
			const entry = (await fontCatalog()).find((f) => f.family === family);
			const variants = entry?.variants ?? ['400'];
			const want = new Set([nearest(variants, 400, false), nearest(variants, 700, false), nearest(variants, 400, true), nearest(variants, 700, true)]);
			const axes = [...want]
				.map((v) => [v.endsWith('i') ? 1 : 0, parseInt(v)] as const)
				.sort((a, b) => a[0] - b[0] || a[1] - b[1])
				.map(([i, w]) => `${i},${w}`)
				.join(';');
			const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@${axes}&display=swap`;
			await new Promise<void>((resolve) => {
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = href;
				link.onload = () => resolve();
				link.onerror = () => resolve();
				document.head.appendChild(link);
			});
			await Promise.all(
				[...want].map((v) =>
					document.fonts.load(`${v.endsWith('i') ? 'italic ' : ''}${parseInt(v)} 32px "${family}"`).catch(() => [])
				)
			);
		})();
		requested.set(family, p);
	}
	return p;
}

/** Resolves once the fonts the captions use are ready to draw. */
export async function ensureCaptionFonts(c: CaptionStyle): Promise<void> {
	if (!c.on) return;
	const families = new Set<string>();
	if (c.title.on) families.add(c.title.font);
	if (c.desc.on) families.add(c.desc.font);
	await Promise.all([...families].map(loadFont));
	if (BUNDLED.Inter) await document.fonts.load(`400 32px "${BUNDLED.Inter}"`).catch(() => []);
}

// Layout and drawing

type Ctx = CanvasRenderingContext2D;
type Piece = Run & { width: number };
type Line = { pieces: Piece[]; width: number };

const fontFor = (r: Run, s: TextStyle) =>
	`${r.italic ? 'italic ' : ''}${r.bold ? 700 : 400} ${s.size}px "${cssFamily(s.font)}", system-ui, sans-serif`;

/** Breaks runs into lines no wider than `maxW`, cutting the last kept line with an ellipsis. */
function layoutText(ctx: Ctx, text: RichText, s: TextStyle, maxW: number): Line[] {
	const lines: Line[] = [];
	const limit = Math.max(1, s.lines);
	const measure = (r: Run, t: string) => {
		ctx.font = fontFor(r, s);
		return ctx.measureText(t).width;
	};
	let truncated = false;
	outer: for (const para of text) {
		let line: Line = { pieces: [], width: 0 };
		const push = () => {
			if (lines.length >= limit) {
				truncated = true;
				return false;
			}
			lines.push(line);
			line = { pieces: [], width: 0 };
			return true;
		};
		// Split into words, keeping the spaces so runs join back exactly.
		const words = para.flatMap((r) => r.text.split(/(\s+)/).filter(Boolean).map((t) => ({ ...r, text: t })));
		for (const w of words) {
			const ww = measure(w, w.text);
			if (line.width + ww > maxW && line.pieces.length && !/^\s+$/.test(w.text)) {
				if (!push()) break outer;
			}
			if (!line.pieces.length && /^\s+$/.test(w.text)) continue;
			line.pieces.push({ ...w, width: ww });
			line.width += ww;
		}
		if (!push()) break;
	}
	if (lines.length > limit) lines.length = limit;
	const last = lines[lines.length - 1];
	if (last && (truncated || last.width > maxW)) {
		// Trim characters until the line and an ellipsis fit.
		while (last.pieces.length) {
			const p = last.pieces[last.pieces.length - 1];
			const ell = measure(p, '…');
			if (last.width + ell <= maxW) {
				p.text = p.text.replace(/\s+$/, '') + '…';
				p.width = measure(p, p.text);
				break;
			}
			if (p.text.length <= 1) {
				last.width -= p.width;
				last.pieces.pop();
				continue;
			}
			p.text = p.text.slice(0, -1);
			const nw = measure(p, p.text);
			last.width += nw - p.width;
			p.width = nw;
		}
		last.width = last.pieces.reduce((t, p) => t + p.width, 0);
	}
	return lines;
}

function drawBlock(ctx: Ctx, text: RichText, s: TextStyle, box: Rect, align: CaptionStyle['align'], scale: number) {
	const lines = layoutText(ctx, text, s, box.w);
	const lh = s.size * LINE_HEIGHT;
	ctx.save();
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = s.color;
	if (s.shadow.on && s.shadow.strength > 0) {
		const n = parseInt(s.shadow.color.slice(1), 16);
		ctx.shadowColor = `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.min(1, s.shadow.strength / 100)})`;
		ctx.shadowBlur = s.shadow.softness * scale;
		ctx.shadowOffsetY = s.shadow.distance * scale;
	}
	lines.forEach((line, i) => {
		let x = box.x + (align === 'left' ? 0 : align === 'right' ? box.w - line.width : (box.w - line.width) / 2);
		const base = box.y + i * lh + (lh - s.size) / 2 + s.size * 0.8;
		for (const p of line.pieces) {
			ctx.font = fontFor(p, s);
			ctx.fillText(p.text, x, base);
			const t = Math.max(1, s.size / 14);
			if (p.underline) ctx.fillRect(x, base + s.size * 0.12, p.width, t);
			if (p.strike) ctx.fillRect(x, base - s.size * 0.3, p.width, t);
			x += p.width;
		}
	});
	ctx.restore();
}

export type Captioned = { title?: RichText; desc?: RichText };

/** Draws each cell's title and description in the space above or below its image. */
export function drawCaptions(ctx: Ctx, cells: Rect[], texts: (Captioned | null)[], c: CaptionStyle, scale: number) {
	if (!c.on) return;
	cells.forEach((cell, i) => {
		const t = texts[i];
		if (!t) return;
		let y = cell.y;
		for (const { key, style } of parts(c, 'above')) {
			const h = style.lines * style.size * LINE_HEIGHT;
			y -= style.padBottom + h;
			if (!isEmpty(t[key])) drawBlock(ctx, t[key]!, style, { x: cell.x, y, w: cell.w, h }, c.align, scale);
			y -= style.padTop;
		}
		y = cell.y + cell.h;
		for (const { key, style } of parts(c, 'below')) {
			const h = style.lines * style.size * LINE_HEIGHT;
			y += style.padTop;
			if (!isEmpty(t[key])) drawBlock(ctx, t[key]!, style, { x: cell.x, y, w: cell.w, h }, c.align, scale);
			y += h + style.padBottom;
		}
		// Inside the cell, text keeps a little distance from the cell's sides.
		const inside = (style: TextStyle) => {
			const side = Math.round(style.size * 0.5);
			return { x: cell.x + side, w: Math.max(1, cell.w - side * 2) };
		};
		const bottom = parts(c, 'bottom');
		for (const [list, start] of [
			[parts(c, 'top'), cell.y],
			[bottom, cell.y + cell.h - bottom.reduce((s, x) => s + blockHeight(x.style), 0)]
		] as const) {
			y = start;
			for (const { key, style } of list) {
				const h = style.lines * style.size * LINE_HEIGHT;
				y += style.padTop;
				if (!isEmpty(t[key])) drawBlock(ctx, t[key]!, style, { ...inside(style), y, h }, c.align, scale);
				y += h + style.padBottom;
			}
		}
	});
}
