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
	/** The image's focal point, from 0 to 1 across and down, when one is set. */
	focus?: Focus | null;
};

export type Focus = { x: number; y: number };

/** An image's focal point from its edits, or null when it is the center (the default). */
export function focusOf(edits: ImageEdits | undefined): Focus | null {
	const x = Number(valueOf(edits, 'focusX'));
	const y = Number(valueOf(edits, 'focusY'));
	return x === 50 && y === 50 ? null : { x: x / 100, y: y / 100 };
}

/**
 * How far the focal point moves the image, in position units: the offset that puts the focal
 * point in the middle of the cell. Positions set by the user are added to it, so zooming or
 * reshaping the cell keeps the focal point in view instead of the image's center.
 */
function focusShift(width: number, height: number, area: Rect, fit: 'fill' | 'fit', zoom: number, free: boolean, focus: Focus | null | undefined) {
	if (!focus) return { x: 0, y: 0 };
	const p = placeImage(width, height, area, fit, { zoom, ox: 0, oy: 0 }, free);
	return { x: ((focus.x - 0.5) * p.w) / (p.slackX / 2), y: ((focus.y - 0.5) * p.h) / (p.slackY / 2) };
}

/** Where an image is drawn in its area, with its framing and focal point. */
export function framePlace(
	width: number,
	height: number,
	area: Rect,
	fit: 'fill' | 'fit',
	adjust: Adjust,
	free: boolean,
	focus?: Focus | null
) {
	const f = focusShift(width, height, area, fit, adjust.zoom, free, focus);
	return placeImage(width, height, area, fit, { ...adjust, ox: adjust.ox + f.x, oy: adjust.oy + f.y }, free);
}

export type CellChange =
	| { kind: 'set'; values: Partial<Adjust> }
	/** `at` is where to zoom around, from 0 to 1 across and down the cell; the middle if left out. */
	| { kind: 'zoom'; factor: number; at?: { u: number; v: number } }
	/** Lines the image up with an edge or corner of its cell: -1, 0 or 1 across and down. */
	| { kind: 'align'; x: -1 | 0 | 1; y: -1 | 0 | 1 }
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
	const area = t.area;
	if (change.kind === 'zoom') {
		const zoom = clamp(a.zoom * change.factor, lowest, ZOOM_MAX);
		if (!area || !change.at) return { ...a, zoom };
		// Keep the spot under the pointer where it is: work in drawn positions (the stored offset
		// plus the focal point's), then store the difference from the new focal offset.
		const before = framePlace(t.width, t.height, area, opts.fit, a, opts.free, t.focus);
		const px = area.x + change.at.u * area.w;
		const py = area.y + change.at.v * area.h;
		const ix = (px - before.x) / before.w;
		const iy = (py - before.y) / before.h;
		const p0 = placeImage(t.width, t.height, area, opts.fit, { zoom, ox: 0, oy: 0 }, opts.free);
		const f = focusShift(t.width, t.height, area, opts.fit, zoom, opts.free, t.focus);
		const ex = clamp((p0.x - (px - ix * p0.w)) / (p0.slackX / 2), -p0.limitX, p0.limitX);
		const ey = clamp((p0.y - (py - iy * p0.h)) / (p0.slackY / 2), -p0.limitY, p0.limitY);
		return { zoom, ox: p0.limitX > 0.001 ? ex - f.x : a.ox, oy: p0.limitY > 0.001 ? ey - f.y : a.oy };
	}
	if (!area) return a;
	const f = focusShift(t.width, t.height, area, opts.fit, a.zoom, opts.free, t.focus);
	const p = placeImage(t.width, t.height, area, opts.fit, { ...a, ox: 0, oy: 0 }, opts.free);
	if (change.kind === 'align') {
		// The offset that lines the image's edge up with the cell's, whether it overflows or not.
		a.ox = (-change.x * (area.w - p.w)) / p.slackX - f.x;
		a.oy = (-change.y * (area.h - p.h)) / p.slackY - f.y;
		return a;
	}
	if (change.kind !== 'pan') return a;
	if (p.limitX > 0.001) a.ox = clamp(clamp(a.ox + f.x, -p.limitX, p.limitX) - (2 * change.dx) / p.slackX, -p.limitX, p.limitX) - f.x;
	if (p.limitY > 0.001) a.oy = clamp(clamp(a.oy + f.y, -p.limitY, p.limitY) - (2 * change.dy) / p.slackY, -p.limitY, p.limitY) - f.y;
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
