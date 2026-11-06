/**
 * Looks: saved spacing, styling and background settings that can be applied to any grid. Pixel
 * values are stored with the output size they were made at and scaled to the current one.
 */
import { DEFAULT_CAPTIONS } from './captions';
import { DEFAULT_STYLE, type CellStyle, type FitMode } from './render';

export type Look = {
	gap: number;
	padding: number;
	linkPadding: boolean;
	fit: FitMode;
	style: CellStyle;
	bgId: string;
	customColor: string;
	/** The output's long edge when the look was saved. */
	ref: number;
};

export type NamedLook = { id: string; name: string; look: Look };

const r = (n: number, k: number, min = 0) => Math.max(min, Math.round(n * k));

/** Scales every pixel value in a style by `k`. */
export function scaleStyle(s: CellStyle, k: number): CellStyle {
	const c = s.captions;
	const text = (t: CellStyle['captions']['title']) => ({
		...t,
		size: r(t.size, k, 4),
		padTop: r(t.padTop, k),
		padBottom: r(t.padBottom, k),
		shadow: { ...t.shadow, distance: r(t.shadow.distance, k), softness: r(t.shadow.softness, k) }
	});
	return {
		corners: { ...s.corners },
		border: { ...s.border, width: r(s.border.width, k, 1) },
		shadow: { ...s.shadow, distance: r(s.shadow.distance, k), softness: r(s.shadow.softness, k) },
		lines: { ...s.lines, width: r(s.lines.width, k, 1) },
		fill: { ...s.fill, padding: r(s.fill.padding, k) },
		captions: { ...c, title: text(c.title), desc: text(c.desc) }
	};
}

/** The look's values scaled to an output whose long edge is `ref`. */
export function applyLook(look: Look, ref: number): Omit<Look, 'ref'> {
	const k = ref / (look.ref || ref);
	return {
		gap: r(look.gap, k),
		padding: r(look.padding, k),
		linkPadding: look.linkPadding,
		fit: look.fit,
		style: scaleStyle(withDefaults(look.style), k),
		bgId: look.bgId,
		customColor: look.customColor
	};
}

/** Fills in settings added after a look or session was saved. */
export function withDefaults(s: Partial<CellStyle>): CellStyle {
	const d = structuredClone(DEFAULT_STYLE);
	return {
		corners: { ...d.corners, ...s.corners },
		border: { ...d.border, ...s.border },
		shadow: { ...d.shadow, ...s.shadow },
		lines: { ...d.lines, ...s.lines },
		fill: { ...d.fill, ...s.fill },
		captions: {
			...d.captions,
			...s.captions,
			title: { ...d.captions.title, ...s.captions?.title },
			desc: { ...d.captions.desc, ...s.captions?.desc }
		}
	};
}

const base = (): Look => ({
	gap: 24,
	padding: 24,
	linkPadding: true,
	fit: 'fill',
	style: structuredClone(DEFAULT_STYLE),
	bgId: 'white',
	customColor: '#f4f1ea',
	ref: 1920
});

export const BUILT_IN_LOOKS: NamedLook[] = [
	{ id: 'clean', name: 'Clean', look: base() },
	{
		id: 'bento',
		name: 'Bento',
		look: (() => {
			const l = base();
			l.gap = l.padding = 20;
			l.bgId = 'paint:dark';
			l.style.corners = { on: true, radius: 10 };
			return l;
		})()
	},
	{
		id: 'hairline',
		name: 'Hairline',
		look: (() => {
			const l = base();
			l.gap = l.padding = 32;
			l.style.lines = { on: true, width: 2, color: '#000000', opacity: 18 };
			return l;
		})()
	},
	{
		id: 'polaroid',
		name: 'Polaroid',
		look: (() => {
			const l = base();
			l.gap = l.padding = 56;
			l.linkPadding = true;
			l.bgId = 'paint:paper';
			l.style.shadow = { on: true, strength: 30, distance: 10, softness: 30 };
			l.style.border = { on: true, width: 18, color: '#ffffff', opacity: 100 };
			l.style.captions = {
				...structuredClone(DEFAULT_CAPTIONS),
				on: true,
				title: { ...structuredClone(DEFAULT_CAPTIONS.title), font: 'Caveat', size: 48, color: '#2b2b2b', padTop: 14, padBottom: 6 },
				desc: { ...structuredClone(DEFAULT_CAPTIONS.desc), on: false }
			};
			return l;
		})()
	}
];

const KEY = 'griddle:looks';

export function loadLooks(): NamedLook[] {
	try {
		const raw = localStorage.getItem(KEY);
		const list = raw ? (JSON.parse(raw) as NamedLook[]) : [];
		return Array.isArray(list) ? list.filter((l) => l && typeof l.name === 'string' && l.look) : [];
	} catch {
		return [];
	}
}

export function saveLooks(list: NamedLook[]) {
	try {
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {
		// Storage can be unavailable (private windows); looks then last for this visit only.
	}
}
