/**
 * An image's edits: the value of each parameter from the registry that differs from its initial
 * value. Leaving initial values out keeps stored edits small and makes "no edits" an empty object.
 */
import { OPERATIONS, PARAMS, bulkMode, paramById, operationOf, type OperationGroup, type Param, type ParamValue } from './registry';

export type ImageEdits = Record<string, ParamValue>;

export const NO_EDITS: ImageEdits = Object.freeze({}) as ImageEdits;

/** A parameter's value on an image, falling back to its initial value. */
export function valueOf(edits: ImageEdits | undefined, id: string): ParamValue {
	const p = paramById(id);
	const v = edits?.[id];
	return v === undefined || !p ? (p?.initial ?? 0) : v;
}

export const num = (edits: ImageEdits | undefined, id: string) => Number(valueOf(edits, id)) || 0;
export const bool = (edits: ImageEdits | undefined, id: string) => valueOf(edits, id) === true;

/** A value made valid for its parameter, or undefined when it can't be. */
export function coerce(p: Param, v: unknown): ParamValue | undefined {
	switch (p.kind) {
		case 'number': {
			let n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
			if (!Number.isFinite(n)) return undefined;
			if (p.wrap) {
				const span = p.max - p.min + p.step;
				n = ((((n - p.min) % span) + span) % span) + p.min;
			}
			return Math.min(p.max, Math.max(p.min, +(Math.round(n / p.step) * p.step).toFixed(6)));
		}
		case 'toggle':
			return typeof v === 'boolean' ? v : undefined;
		case 'choice': {
			const s = String(v);
			return p.options.some((o) => o.value === s) ? s : undefined;
		}
		case 'color':
			return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined;
	}
}

const isInitial = (p: Param, v: ParamValue) => (p.kind === 'number' ? Math.abs(Number(v) - p.initial) < 1e-9 : v === p.initial);

/**
 * Applies `changes` to `edits`, returning a new object. Unknown parameters and invalid values are
 * ignored, values are kept within range, and values equal to the initial one are dropped.
 */
export function withEdits(edits: ImageEdits | undefined, changes: Record<string, unknown>): ImageEdits {
	const out: ImageEdits = { ...(edits ?? {}) };
	for (const [id, raw] of Object.entries(changes)) {
		const p = paramById(id);
		if (!p) continue;
		const v = coerce(p, raw);
		if (v === undefined) continue;
		if (isInitial(p, v)) delete out[id];
		else out[id] = v;
	}
	return out;
}

/** Cleans stored edits, such as ones saved by an older version: unknown or invalid values go. */
export const normalizeEdits = (edits: unknown): ImageEdits =>
	edits && typeof edits === 'object' ? withEdits(NO_EDITS, edits as Record<string, unknown>) : {};

export const hasEdits = (edits: ImageEdits | undefined) => !!edits && Object.keys(edits).length > 0;

/** True when any parameter of the given stage differs from its initial value. */
export function stageActive(edits: ImageEdits | undefined, stage: 'geometry' | 'pixel'): boolean {
	if (!edits) return false;
	return Object.keys(edits).some((id) => operationOf(id)?.stage === stage);
}

/** The value every image shares for a parameter, or null when they differ. */
export function sharedEdit(all: (ImageEdits | undefined)[], id: string): ParamValue | null {
	if (!all.length) return null;
	const first = valueOf(all[0], id);
	const p = paramById(id);
	return all.every((e) => {
		const v = valueOf(e, id);
		return p?.kind === 'number' ? Math.abs(Number(v) - Number(first)) < 1e-9 : v === first;
	})
		? first
		: null;
}

/** The parameters of the given groups, as a full set of values (initial ones included), so
 * pasting them also resets what the source image left unchanged. Parameters that belong to one
 * image only, such as a focal point, are left out. */
export function pickGroups(edits: ImageEdits | undefined, groups: readonly OperationGroup[]): Record<string, ParamValue> {
	const out: Record<string, ParamValue> = {};
	for (const op of OPERATIONS)
		if (groups.includes(op.group)) for (const p of op.params) if (bulkMode(p) !== 'single') out[p.id] = valueOf(edits, p.id);
	return out;
}

/** Every parameter at its initial value, for the given groups. */
export function resetGroups(groups: readonly OperationGroup[]): Record<string, ParamValue> {
	const out: Record<string, ParamValue> = {};
	for (const p of PARAMS) if (groups.includes(operationOf(p.id)!.group)) out[p.id] = p.initial;
	return out;
}

/** A stable text key for a set of edits, for caching rendered results. */
export const editsKey = (edits: ImageEdits | undefined) =>
	edits ? PARAMS.filter((p) => edits[p.id] !== undefined && operationOf(p.id)?.stage !== 'framing').map((p) => `${p.id}=${edits[p.id]}`).join('&') : '';
