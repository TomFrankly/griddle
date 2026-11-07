/**
 * Per-cell edits, and how they spread across a selection of cells.
 *
 * Every per-cell setting is described once in CELL_SETTINGS: where it is stored on an image, its
 * range, how the Image tab shows it, and whether Copy settings carries it. Bulk tools work through
 * these descriptions, so a new setting (a blend mode, a color grade) only needs a new entry.
 *
 * Changes come in three kinds:
 * - `set` gives every target the same value (sliders, Center, Reset, Paste settings).
 * - `zoom` multiplies each target's zoom by the same factor (scrolling over a cell).
 * - `pan` moves each target by the same distance on screen (dragging or arrow keys).
 * Each target keeps to its own limits, which depend on its image and cell.
 */
import { minZoom, placeImage, ZOOM_MAX, ZOOM_OUT, type Adjust, type Rect } from './grid';
import { OPERATIONS, paramById, pickGroups, valueOf, withEdits, type ImageEdits, type OperationGroup, type ParamValue } from './edits';

export type CellSettingKey = keyof Adjust;

export type CellSetting = {
	key: CellSettingKey;
	label: string;
	/** Settings in the same group are shown together and copied together. */
	group: 'framing';
	min: number;
	max: number;
	/** The value a reset goes back to. */
	initial: number;
	/** Converts between the stored value and the number shown in the Image tab. */
	toUi: (v: number) => number;
	fromUi: (v: number) => number;
	uiMin: number;
	uiMax: number;
	uiStep: number;
	unit: string;
};

export const CELL_SETTINGS: CellSetting[] = [
	{
		key: 'zoom',
		label: 'Zoom',
		group: 'framing',
		min: ZOOM_OUT,
		max: ZOOM_MAX,
		initial: 1,
		toUi: (v) => Math.round(v * 100),
		fromUi: (v) => v / 100,
		uiMin: 25,
		uiMax: ZOOM_MAX * 100,
		uiStep: 1,
		unit: '%'
	},
	// Positive offsets show more of the right or bottom of the image, which moves it left or up,
	// so the tab flips the sign: dragging a position slider right moves the image right.
	{
		key: 'ox',
		label: 'Horizontal',
		group: 'framing',
		min: -1,
		max: 1,
		initial: 0,
		toUi: (v) => Math.round(-v * 100),
		fromUi: (v) => -v / 100,
		uiMin: -100,
		uiMax: 100,
		uiStep: 1,
		unit: '%'
	},
	{
		key: 'oy',
		label: 'Vertical',
		group: 'framing',
		min: -1,
		max: 1,
		initial: 0,
		toUi: (v) => Math.round(-v * 100),
		fromUi: (v) => -v / 100,
		uiMin: -100,
		uiMax: 100,
		uiStep: 1,
		unit: '%'
	}
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** What a cell needs to know to keep an edit within its limits. */
export type EditTarget = {
	adjust: Adjust;
	width: number;
	height: number;
	/** The area the image sits in, in screen pixels. Cells not on the grid have none. */
	area: Rect | null;
};

export type CellChange =
	| { kind: 'set'; values: Partial<Adjust> }
	| { kind: 'zoom'; factor: number }
	| { kind: 'pan'; dx: number; dy: number }
	/** Sets image edits (see edits/registry.ts) to the same value on every target. */
	| { kind: 'edit'; values: Record<string, ParamValue> }
	/** Moves a numeric image edit by the same amount on every target, from each one's own value,
	 * or flips a toggle on each target. */
	| { kind: 'shift'; id: string; by: number };

export const isImageEdit = (c: CellChange): c is Extract<CellChange, { kind: 'edit' | 'shift' }> =>
	c.kind === 'edit' || c.kind === 'shift';

/** An image's edits after a change. Framing changes leave them as they are. */
export function applyImageEdit(edits: ImageEdits, change: CellChange): ImageEdits {
	if (change.kind === 'edit') return withEdits(edits, change.values);
	if (change.kind === 'shift') {
		const p = paramById(change.id);
		if (p?.kind === 'toggle') return withEdits(edits, { [p.id]: valueOf(edits, p.id) !== true });
		if (p?.kind !== 'number') return edits;
		return withEdits(edits, { [p.id]: Number(valueOf(edits, p.id)) + change.by });
	}
	return edits;
}

export type FrameOptions = { fit: 'fill' | 'fit'; free: boolean };

/** The new framing for one cell after a change. Positions set directly are kept as given and
 * limited when drawn, so they still apply after a later zoom makes room for them. */
export function applyChange(t: EditTarget, change: CellChange, opts: FrameOptions): Adjust {
	const a = { ...t.adjust };
	const lowest = t.area ? minZoom(t.width, t.height, t.area, opts.fit) : ZOOM_OUT;
	if (change.kind === 'set') {
		for (const s of CELL_SETTINGS) {
			const v = change.values[s.key];
			if (v === undefined || !Number.isFinite(v)) continue;
			a[s.key] = s.key === 'zoom' ? clamp(v, lowest, ZOOM_MAX) : clamp(v, s.min, s.max);
		}
		return a;
	}
	if (change.kind === 'zoom') {
		a.zoom = clamp(a.zoom * change.factor, lowest, ZOOM_MAX);
		return a;
	}
	if (change.kind !== 'pan' || !t.area) return a;
	const p = placeImage(t.width, t.height, t.area, opts.fit, a, opts.free);
	if (p.limitX > 0.001) a.ox = clamp(clamp(a.ox, -p.limitX, p.limitX) - (2 * change.dx) / p.slackX, -p.limitX, p.limitX);
	if (p.limitY > 0.001) a.oy = clamp(clamp(a.oy, -p.limitY, p.limitY) - (2 * change.dy) / p.slackY, -p.limitY, p.limitY);
	return a;
}

/** The value every image shares for a setting, or null when they differ. */
export function sharedValue(adjusts: Adjust[], key: CellSettingKey): number | null {
	if (!adjusts.length) return null;
	const first = adjusts[0][key];
	return adjusts.every((a) => Math.abs(a[key] - first) < 1e-6) ? first : null;
}

/** A cell's settings that Copy settings carries to other cells: its framing and image edits. */
export type CellSettings = { framing: Partial<Adjust>; edits: Record<string, ParamValue> };

export const ALL_GROUPS: OperationGroup[] = [...new Set(OPERATIONS.map((op) => op.group))];

export function copySettings(adjust: Adjust, edits?: ImageEdits): CellSettings {
	const framing: Partial<Adjust> = {};
	for (const s of CELL_SETTINGS) framing[s.key] = adjust[s.key];
	return { framing, edits: pickGroups(edits, ALL_GROUPS) };
}

/** The changes that paste copied settings onto a selection. */
export const pasteChanges = (s: CellSettings): CellChange[] => [
	{ kind: 'set', values: s.framing },
	{ kind: 'edit', values: s.edits }
];

/** Back to the starting framing. */
export const RESET_FRAMING: Partial<Adjust> = Object.fromEntries(CELL_SETTINGS.map((s) => [s.key, s.initial]));
