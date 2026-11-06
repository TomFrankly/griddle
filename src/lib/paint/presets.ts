/**
 * Background paints: a solid or gradient fill with an optional dot pattern and vignette, plus
 * the preset list. paint-gl.ts renders them.
 */

export type PaintFill = 'solid' | 'gradient';
export type PaintPattern = 'none' | 'dots';

/**
 * A background. `c` is the palette (a solid uses c[0]). `l1`, `l2` are the gradient's lights
 * from −1 to 1 across the canvas, y down. Pattern and grain sizes are measured against the
 * canvas height, so an export looks like the preview.
 */
export type BackdropPaint = {
	fill: PaintFill;
	c: [string, string, string, string];
	/** Gradient angle, degrees. */
	ang: number;
	l1: [number, number];
	l2: [number, number];
	/** Gradient lights' strength, 0–100. */
	glow: number;
	/** Gradient softness, %. */
	scale: number;
	pat: PaintPattern;
	/** The pattern's ink: derived from the fill, or `inkc`. */
	ink: 'auto' | 'custom';
	inkc: string;
	/** Pattern strength, spacing and dot size. */
	pop: number;
	psz: number;
	pw: number;
	grain: number;
	vig: number;
};

export const PAINT_PATTERNS: PaintPattern[] = ['none', 'dots'];

const BASE: BackdropPaint = {
	fill: 'gradient',
	c: ['#000000', '#000000', '#000000', '#000000'],
	ang: 45,
	l1: [0, 0],
	l2: [0, 0],
	glow: 0,
	scale: 100,
	pat: 'none',
	ink: 'auto',
	inkc: '#ffffff',
	pop: 60,
	psz: 31,
	pw: 15,
	grain: 0,
	vig: 0
};

type PaintInput = Partial<Omit<BackdropPaint, 'c'>> & { c?: string[] };
const S = (o: PaintInput): BackdropPaint => ({
	...BASE,
	...o,
	c: [...(o.c ?? BASE.c), '#000000', '#000000', '#000000'].slice(0, 4) as BackdropPaint['c']
});
const solid = (hex: string, o: PaintInput = {}) => S({ fill: 'solid', c: [hex, hex, hex, hex], ...o });

export type PaintGroup = 'Solid' | 'Gradients' | 'Patterns';

export type PaintPreset = {
	id: string;
	name: string;
	group: PaintGroup;
	paint: BackdropPaint;
};

export const PAINT_PRESETS: PaintPreset[] = (
	[
		['light', 'Light', 'Solid', solid('#eceef2')],
		['dark', 'Dark', 'Solid', solid('#1c1d21')],
		[
			'mesh',
			'Mesh',
			'Gradients',
			S({
				c: ['#4338ca', '#7e22ce', '#f0509a', '#22b5d6'],
				ang: 90,
				l1: [-0.9, -0.9],
				l2: [0.95, -0.75],
				glow: 85,
				scale: 150
			})
		],
		[
			'sunset',
			'Sunset',
			'Gradients',
			S({
				c: ['#2b1650', '#d9502f', '#ff9f43', '#b3226f'],
				ang: 90,
				l1: [0, 0.95],
				l2: [0.85, -0.6],
				glow: 70,
				scale: 140
			})
		],
		[
			'ocean',
			'Ocean',
			'Gradients',
			S({
				c: ['#031d3a', '#0b5d8f', '#1fb8c9', '#1d3fae'],
				ang: 90,
				l1: [-0.7, 0.85],
				l2: [0.85, -0.8],
				glow: 70,
				scale: 140
			})
		],
		['graphite', 'Graphite', 'Gradients', S({ c: ['#3a404a', '#16181d', '#3a404a', '#16181d'], ang: 45 })],
		[
			'dusk',
			'Dusk',
			'Gradients',
			S({ c: ['#1b1838', '#48203f', '#b0505a', '#2c3c70'], ang: 53, l1: [0.62, 0.84], l2: [-0.87, -1], glow: 55 })
		],
		[
			'paper',
			'Warm paper',
			'Gradients',
			S({
				c: ['#efe6d8', '#d6c7b1', '#f9f4ea', '#efe6d8'],
				ang: 90,
				l1: [-0.56, -1],
				l2: [1, 1],
				glow: 60,
				scale: 140,
				grain: 35
			})
		],
		[
			'dot-grid',
			'Dot grid',
			'Patterns',
			solid('#f3f3f1', { pat: 'dots', ink: 'custom', inkc: '#bcbcb6', pop: 100, vig: 15 })
		],
		[
			'dot-grid-dark',
			'Dot grid dark',
			'Patterns',
			solid('#18181b', { pat: 'dots', ink: 'custom', inkc: '#55555e', pop: 100, vig: 15 })
		]
	] as [string, string, PaintGroup, BackdropPaint][]
).map(([id, name, group, paint]) => ({ id, name, group, paint }));
