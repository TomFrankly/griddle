/**
 * The image operations registry: every edit an image can carry, described once.
 *
 * An operation (rotate, exposure, duotone…) declares its parameters with their kind and range.
 * Everything else works from these descriptions: the Image tab builds its controls from them,
 * bulk edits and Mixed values compare them, Copy settings carries them by group, the renderer
 * runs them in registry order, and anything that drives Griddle from outside (scripts, an AI
 * assistant) can read the same list to know what it may change.
 *
 * Edits belong to the image, not to the cell it sits in: an image keeps them wherever it is
 * drawn. How it is framed in a cell (zoom and position) lives on the cell, in cell-edits.ts.
 */

export type ParamValue = number | boolean | string;

type ParamBase = {
	/** Unique across all operations; it is the key the value is stored under. */
	id: string;
	label: string;
	/** A short explanation for a tooltip. */
	tip?: string;
	/**
	 * How the parameter spreads across a selection: `same` sets one value on every image,
	 * `relative` can also shift each image's own value by the same amount, and `single` only makes
	 * sense on one image at a time (such as a hand-drawn mask). Defaults to `same`.
	 */
	bulk?: BulkMode;
};

export type BulkMode = 'same' | 'relative' | 'single';

export type NumberParam = ParamBase & {
	kind: 'number';
	min: number;
	max: number;
	step: number;
	initial: number;
	unit: string;
	/** Values past `max` wrap around to `min` and back, like angles. */
	wrap?: boolean;
};
export type ToggleParam = ParamBase & { kind: 'toggle'; initial: boolean };
export type ChoiceParam = ParamBase & {
	kind: 'choice';
	options: { value: string; label: string }[];
	initial: string;
};
export type ColorParam = ParamBase & { kind: 'color'; initial: string };

export type Param = NumberParam | ToggleParam | ChoiceParam | ColorParam;

/**
 * Where an operation runs:
 * - `geometry` changes the image's shape (turns, flips, rotation) on a 2D canvas.
 * - `pixel` changes each pixel's color in one WebGL pass shared by all pixel operations.
 */
export type OperationStage = 'geometry' | 'pixel';

/** Operations in the same group are shown together and can be pasted together. */
export type OperationGroup = 'geometry' | 'light' | 'color';

export type Operation = {
	id: string;
	label: string;
	group: OperationGroup;
	stage: OperationStage;
	params: Param[];
	/**
	 * For pixel operations: GLSL that updates `vec3 c` (sRGB, 0 to 1). Each parameter is a uniform
	 * named `u_<id>` (a float, or a vec3 for colors). Helpers from the shader's header are in scope.
	 */
	glsl?: string;
};

export const GROUP_LABELS: Record<OperationGroup, string> = {
	geometry: 'Rotate and flip',
	light: 'Light',
	color: 'Color'
};

const num = (id: string, label: string, min: number, max: number, extra: Partial<NumberParam> = {}): NumberParam => ({
	kind: 'number',
	id,
	label,
	min,
	max,
	step: 1,
	initial: 0,
	unit: '',
	...extra
});

/** The order here is the order edits are applied in. */
export const OPERATIONS: Operation[] = [
	{
		id: 'flip',
		label: 'Flip',
		group: 'geometry',
		stage: 'geometry',
		params: [
			{ kind: 'toggle', id: 'flipH', label: 'Flip horizontal', initial: false, bulk: 'relative' },
			{ kind: 'toggle', id: 'flipV', label: 'Flip vertical', initial: false, bulk: 'relative' }
		]
	},
	{
		id: 'turn',
		label: 'Rotate 90°',
		group: 'geometry',
		stage: 'geometry',
		params: [num('turn', 'Quarter turns', 0, 270, { step: 90, unit: '°', wrap: true, bulk: 'relative' })]
	},
	{
		id: 'rotate',
		label: 'Rotate',
		group: 'geometry',
		stage: 'geometry',
		params: [
			num('angle', 'Angle', -45, 45, {
				step: 0.1,
				unit: '°',
				bulk: 'relative',
				tip: 'Turns the image and crops it so no corners show.'
			})
		]
	},
	{
		id: 'exposure',
		label: 'Exposure',
		group: 'light',
		stage: 'pixel',
		params: [num('exposure', 'Exposure', -3, 3, { step: 0.05, unit: ' EV', bulk: 'relative', tip: 'Brightens or darkens in camera stops.' })],
		glsl: `{ vec3 l = toLinear(c) * exp2(u_exposure); c = toSrgb(l); }`
	},
	{
		id: 'contrast',
		label: 'Contrast',
		group: 'light',
		stage: 'pixel',
		params: [num('contrast', 'Contrast', -100, 100)],
		// An S-curve around middle gray that never pushes values past black or white.
		glsl: `{
  float k = u_contrast / 100.;
  float g = k >= 0. ? 1. + k * 2. : 1. + k * .75;
  vec3 x = clamp(c, 0., 1.);
  vec3 a = pow(x * 2., vec3(g)) * .5;
  vec3 b = 1. - pow((1. - x) * 2., vec3(g)) * .5;
  c = mix(a, b, step(.5, x));
}`
	},
	{
		id: 'white-balance',
		label: 'White balance',
		group: 'color',
		stage: 'pixel',
		params: [
			num('temperature', 'Temperature', -100, 100, { bulk: 'relative', tip: 'Cooler (blue) to warmer (yellow).' }),
			num('tint', 'Tint', -100, 100, { bulk: 'relative', tip: 'Green to magenta.' })
		],
		// Scales the channels in linear light, keeping brightness the same.
		glsl: `{
  float t = u_temperature / 100. * .35, m = u_tint / 100. * .25;
  vec3 g = vec3(1. + t, 1. - m, 1. - t);
  g /= dot(g, LUMA);
  c = toSrgb(toLinear(c) * g);
}`
	},
	{
		id: 'saturation',
		label: 'Saturation',
		group: 'color',
		stage: 'pixel',
		params: [num('saturation', 'Saturation', -100, 100)],
		glsl: `{ float y = dot(c, LUMA); c = mix(vec3(y), c, 1. + u_saturation / 100.); }`
	}
];

export const PARAMS: Param[] = OPERATIONS.flatMap((op) => op.params);
const PARAM_BY_ID = new Map(PARAMS.map((p) => [p.id, p]));
const OP_BY_PARAM = new Map(OPERATIONS.flatMap((op) => op.params.map((p) => [p.id, op] as const)));

export const bulkMode = (p: Param): BulkMode => p.bulk ?? 'same';

export const paramById = (id: string): Param | undefined => PARAM_BY_ID.get(id);
export const operationOf = (paramId: string): Operation | undefined => OP_BY_PARAM.get(paramId);
