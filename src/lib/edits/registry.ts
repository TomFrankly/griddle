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
/** A tone curve, stored as text (see curves.ts). The pixel pass reads it from a lookup texture
 * whose channel is `lut`: 0 red, 1 green, 2 blue, 3 all three. */
export type CurveParam = ParamBase & { kind: 'curve'; initial: string; lut: 0 | 1 | 2 | 3 };

export type Param = NumberParam | ToggleParam | ChoiceParam | ColorParam | CurveParam;

/**
 * Where an operation runs:
 * - `geometry` changes the image's shape (turns, flips, rotation) on a 2D canvas.
 * - `pixel` changes each pixel's color in one WebGL pass shared by all pixel operations.
 * - `framing` changes no pixels; it guides how the image is placed in its cell.
 */
export type OperationStage = 'geometry' | 'pixel' | 'framing';

/** Operations in the same group are shown together and can be pasted together. */
export type OperationGroup = 'geometry' | 'light' | 'color' | 'looks' | 'effects';

export type Operation = {
	id: string;
	label: string;
	group: OperationGroup;
	stage: OperationStage;
	params: Param[];
	/** A toggle or choice among `params` that switches the whole operation on: the Image tab shows
	 * the other parameters only while it is away from its initial value. */
	enabledBy?: string;
	/**
	 * For pixel operations: GLSL that updates `vec3 c` (sRGB, 0 to 1). Each parameter is a uniform
	 * named `u_<id>` (a float, or a vec3 for colors). Helpers from the shader's header are in scope.
	 */
	glsl?: string;
};

export const GROUP_LABELS: Record<OperationGroup, string> = {
	geometry: 'Rotate and flip',
	light: 'Light',
	color: 'Color',
	looks: 'Looks',
	effects: 'Effects'
};

import { IDENTITY_CURVE } from './curves';

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
		id: 'focus',
		label: 'Focal point',
		group: 'geometry',
		stage: 'framing',
		params: [
			num('focusX', 'Focal point across', 0, 100, { initial: 50, step: 0.1, unit: '%', bulk: 'single' }),
			num('focusY', 'Focal point down', 0, 100, { initial: 50, step: 0.1, unit: '%', bulk: 'single' })
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
		id: 'levels',
		label: 'Whites and blacks',
		group: 'light',
		stage: 'pixel',
		params: [
			num('whites', 'Whites', -100, 100, { bulk: 'relative', tip: 'Moves the brightest point: higher makes more of the image pure white.' }),
			num('blacks', 'Blacks', -100, 100, { bulk: 'relative', tip: 'Moves the darkest point: lower makes more of the image pure black.' })
		],
		glsl: `{
  float wp = 1. - u_whites / 100. * .25, bp = -u_blacks / 100. * .2;
  c = (c - bp) / max(wp - bp, .05);
}`
	},
	{
		id: 'tones',
		label: 'Highlights and shadows',
		group: 'light',
		stage: 'pixel',
		params: [
			num('highlights', 'Highlights', -100, 100, { bulk: 'relative', tip: 'Darkens or brightens only the bright areas, such as a sky.' }),
			num('shadows', 'Shadows', -100, 100, { bulk: 'relative', tip: 'Lifts or deepens only the dark areas, such as a face in shade.' })
		],
		// Each slider moves brightness most where its range is, fading out toward middle gray.
		glsl: `{
  float y = clamp(dot(c, LUMA), 0., 1.);
  float ws = pow(1. - smoothstep(0., .6, y), 1.5), wh = pow(smoothstep(.4, 1., y), 1.5);
  float d = u_shadows / 100. * .35 * ws * (u_shadows > 0. ? 1. - y : y)
          + u_highlights / 100. * .35 * wh * (u_highlights < 0. ? y : 1. - y);
  c += d;
}`
	},
	{
		id: 'contrast',
		label: 'Contrast',
		group: 'light',
		stage: 'pixel',
		params: [num('contrast', 'Contrast', -100, 100, { bulk: 'relative' })],
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
		id: 'curves',
		label: 'Curves',
		group: 'light',
		stage: 'pixel',
		params: [
			{ kind: 'curve', id: 'curve', label: 'RGB', initial: IDENTITY_CURVE, lut: 3 },
			{ kind: 'curve', id: 'curveR', label: 'Red', initial: IDENTITY_CURVE, lut: 0 },
			{ kind: 'curve', id: 'curveG', label: 'Green', initial: IDENTITY_CURVE, lut: 1 },
			{ kind: 'curve', id: 'curveB', label: 'Blue', initial: IDENTITY_CURVE, lut: 2 }
		],
		// Each channel through its own curve, then all three through the RGB curve.
		glsl: `if (curvesOn > .5) {
  vec3 x = clamp(c, 0., 1.) * (255. / 256.) + .5 / 256.;
  c = vec3(texture(curveLut, vec2(x.r, .5)).r, texture(curveLut, vec2(x.g, .5)).g, texture(curveLut, vec2(x.b, .5)).b);
  x = clamp(c, 0., 1.) * (255. / 256.) + .5 / 256.;
  c = vec3(texture(curveLut, vec2(x.r, .5)).a, texture(curveLut, vec2(x.g, .5)).a, texture(curveLut, vec2(x.b, .5)).a);
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
		id: 'vibrance',
		label: 'Vibrance',
		group: 'color',
		stage: 'pixel',
		params: [num('vibrance', 'Vibrance', -100, 100, { bulk: 'relative', tip: 'Boosts muted colors more than strong ones, and goes easy on skin.' })],
		glsl: `{
  c = clamp(c, 0., 1.);
  float y = dot(c, LUMA), s = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  // Skin sits where red leads green, which leads blue; it gets half the boost.
  float skin = step(c.b, c.g) * step(c.g, c.r) * smoothstep(.05, .2, c.r - c.b) * .5;
  float k = u_vibrance / 100.;
  c = mix(vec3(y), c, 1. + k * (k > 0. ? (1. - s) * (1. - skin) * 1.5 : 1.));
}`
	},
	{
		id: 'saturation',
		label: 'Saturation',
		group: 'color',
		stage: 'pixel',
		params: [num('saturation', 'Saturation', -100, 100, { bulk: 'relative' })],
		glsl: `{ float y = dot(c, LUMA); c = mix(vec3(y), c, 1. + u_saturation / 100.); }`
	},
	{
		id: 'hue',
		label: 'Hue shift',
		group: 'color',
		stage: 'pixel',
		params: [num('hue', 'Hue', -180, 180, { unit: '°', bulk: 'relative', tip: 'Turns every color around the color wheel.' })],
		glsl: `{ c = hueRotate(c, radians(u_hue)); }`
	},
	{
		id: 'black-white',
		label: 'Black and white',
		group: 'looks',
		stage: 'pixel',
		enabledBy: 'bw',
		params: [
			{ kind: 'toggle', id: 'bw', label: 'Black and white', initial: false },
			num('bwReds', 'Reds', -100, 100, { tip: 'How light red and orange areas turn out, such as skin.' }),
			num('bwGreens', 'Greens', -100, 100, { tip: 'How light green and yellow areas turn out.' }),
			num('bwBlues', 'Blues', -100, 100, { tip: 'How light blue areas turn out, such as sky.' })
		],
		glsl: `if (u_bw > .5) {
  vec3 w = LUMA * (1. + vec3(u_bwReds, u_bwGreens, u_bwBlues) / 100.);
  c = vec3(dot(c, w / max(dot(w, vec3(1.)), .05)));
}`
	},
	{
		id: 'split-tone',
		label: 'Split toning',
		group: 'looks',
		stage: 'pixel',
		enabledBy: 'split',
		params: [
			{ kind: 'toggle', id: 'split', label: 'Split toning', initial: false },
			{ kind: 'color', id: 'splitShadows', label: 'Shadows', initial: '#1f5a8c' },
			{ kind: 'color', id: 'splitHighlights', label: 'Highlights', initial: '#f2a65a' },
			num('splitBalance', 'Balance', -100, 100, { tip: 'Gives more of the image to the shadow color (left) or the highlight color (right).' }),
			num('splitAmount', 'Amount', 0, 100, { initial: 50, unit: '%' })
		],
		glsl: `if (u_split > .5) {
  float y = clamp(dot(c, LUMA), 0., 1.);
  float t = smoothstep(0., 1., clamp(y - u_splitBalance / 200., 0., 1.));
  vec3 tone = mix(u_splitShadows, u_splitHighlights, t);
  c = mix(c, softLight(c, tone), u_splitAmount / 100.);
}`
	},
	{
		id: 'duotone',
		label: 'Duotone',
		group: 'looks',
		stage: 'pixel',
		enabledBy: 'duo',
		params: [
			{ kind: 'toggle', id: 'duo', label: 'Duotone', initial: false },
			{ kind: 'color', id: 'duoDark', label: 'Dark', initial: '#1c1446' },
			{ kind: 'color', id: 'duoLight', label: 'Light', initial: '#ffd27a' },
			num('duoAmount', 'Amount', 0, 100, { initial: 100, unit: '%' })
		],
		glsl: `if (u_duo > .5) {
  float y = clamp(dot(c, LUMA), 0., 1.);
  c = mix(c, mix(u_duoDark, u_duoLight, y), u_duoAmount / 100.);
}`
	},
	{
		id: 'gradient-map',
		label: 'Gradient map',
		group: 'looks',
		stage: 'pixel',
		enabledBy: 'gmap',
		params: [
			{ kind: 'toggle', id: 'gmap', label: 'Gradient map', initial: false },
			{ kind: 'color', id: 'gmapShadows', label: 'Shadows', initial: '#120a2a' },
			{ kind: 'color', id: 'gmapMidtones', label: 'Midtones', initial: '#c2366b' },
			{ kind: 'color', id: 'gmapHighlights', label: 'Highlights', initial: '#ffe9a8' },
			num('gmapAmount', 'Amount', 0, 100, { initial: 100, unit: '%' })
		],
		glsl: `if (u_gmap > .5) {
  float y = clamp(dot(c, LUMA), 0., 1.);
  vec3 g = y < .5 ? mix(u_gmapShadows, u_gmapMidtones, y * 2.) : mix(u_gmapMidtones, u_gmapHighlights, y * 2. - 1.);
  c = mix(c, g, u_gmapAmount / 100.);
}`
	},
	{
		id: 'film',
		label: 'Film look',
		group: 'looks',
		stage: 'pixel',
		enabledBy: 'film',
		params: [
			{
				kind: 'choice',
				id: 'film',
				label: 'Film look',
				initial: 'none',
				options: [
					{ value: 'none', label: 'None' },
					{ value: 'sepia', label: 'Sepia' },
					{ value: 'faded', label: 'Faded film' },
					{ value: 'cross', label: 'Cross-processed' },
					{ value: 'matte', label: 'Cool matte' },
					{ value: 'warm', label: 'Warm vintage' }
				]
			},
			num('filmAmount', 'Strength', 0, 100, { initial: 100, unit: '%' })
		],
		glsl: `if (u_film > .5) {
  vec3 f = c;
  float y = clamp(dot(c, LUMA), 0., 1.);
  if (u_film < 1.5) f = vec3(y) * vec3(1.07, .88, .66) + vec3(.06, .03, 0.);
  else if (u_film < 2.5) f = mix(vec3(.11, .1, .12), vec3(.93, .91, .86), mix(vec3(y), c, .75));
  else if (u_film < 3.5) f = vec3(smoothstep(-.05, 1.05, c.r), pow(c.g, .85), c.b * .7 + .12);
  else if (u_film < 4.5) f = mix(vec3(.12, .15, .18), vec3(.9, .94, .96), mix(vec3(y), c, .55));
  else f = mix(c, vec3(y) * vec3(1.12, .98, .74), .45) * .95 + vec3(.05, .03, 0.);
  c = mix(c, f, u_filmAmount / 100.);
}`
	},
	{
		id: 'color-overlay',
		label: 'Color overlay',
		group: 'looks',
		stage: 'pixel',
		enabledBy: 'overlay',
		params: [
			{ kind: 'toggle', id: 'overlay', label: 'Color overlay', initial: false },
			{ kind: 'color', id: 'overlayColor', label: 'Color', initial: '#ff5a36' },
			{
				kind: 'choice',
				id: 'overlayBlend',
				label: 'Blend',
				initial: 'normal',
				options: [
					{ value: 'normal', label: 'Normal' },
					{ value: 'multiply', label: 'Multiply' },
					{ value: 'screen', label: 'Screen' },
					{ value: 'overlay', label: 'Overlay' },
					{ value: 'soft-light', label: 'Soft light' },
					{ value: 'color', label: 'Color' }
				]
			},
			num('overlayOpacity', 'Opacity', 0, 100, { initial: 40, unit: '%' })
		],
		glsl: `if (u_overlay > .5) {
  vec3 o = u_overlayColor, b = clamp(c, 0., 1.), r = o;
  float m = u_overlayBlend;
  if (m > .5 && m < 1.5) r = b * o;
  else if (m < 2.5 && m > 1.5) r = 1. - (1. - b) * (1. - o);
  else if (m < 3.5 && m > 2.5) r = mix(2. * b * o, 1. - 2. * (1. - b) * (1. - o), step(.5, b));
  else if (m < 4.5 && m > 3.5) r = softLight(b, o);
  else if (m > 4.5) r = o - dot(o, LUMA) + dot(b, LUMA);
  c = mix(c, r, u_overlayOpacity / 100.);
}`
	},
	{
		id: 'posterize',
		label: 'Posterize',
		group: 'looks',
		stage: 'pixel',
		params: [num('posterize', 'Posterize', 0, 16, { tip: 'Reduces each color channel to this many levels, for a screen-print look. 0 is off.' })],
		glsl: `if (u_posterize >= 2.) { float n = u_posterize - 1.; c = floor(clamp(c, 0., 1.) * n + .5) / n; }`
	},
	{
		id: 'invert',
		label: 'Invert',
		group: 'looks',
		stage: 'pixel',
		params: [{ kind: 'toggle', id: 'invert', label: 'Invert', initial: false }],
		glsl: `if (u_invert > .5) c = 1. - clamp(c, 0., 1.);`
	},
	{
		id: 'vignette',
		label: 'Vignette',
		group: 'effects',
		stage: 'pixel',
		params: [
			num('vignette', 'Vignette', -100, 100, { tip: 'Darkens (left) or lightens (right) the edges of the image.' }),
			num('vignetteSize', 'Size', 0, 100, { initial: 50, unit: '%' }),
			num('vignetteSoftness', 'Softness', 0, 100, { initial: 50, unit: '%' })
		],
		glsl: `if (u_vignette != 0.) {
  vec2 p = (uv - .5) * 2.;
  float r = length(p * vec2(1., aspect)) / length(vec2(1., aspect));
  float inner = mix(.95, .1, u_vignetteSize / 100.), soft = mix(.05, 1.2, u_vignetteSoftness / 100.);
  float v = smoothstep(inner, inner + soft, r);
  c = u_vignette < 0. ? c * (1. + u_vignette / 100. * v) : mix(c, vec3(1.), u_vignette / 100. * v);
}`
	}
];

export const PARAMS: Param[] = OPERATIONS.flatMap((op) => op.params);
const PARAM_BY_ID = new Map(PARAMS.map((p) => [p.id, p]));
const OP_BY_PARAM = new Map(OPERATIONS.flatMap((op) => op.params.map((p) => [p.id, op] as const)));

export const bulkMode = (p: Param): BulkMode => p.bulk ?? 'same';

export const paramById = (id: string): Param | undefined => PARAM_BY_ID.get(id);
export const operationOf = (paramId: string): Operation | undefined => OP_BY_PARAM.get(paramId);
