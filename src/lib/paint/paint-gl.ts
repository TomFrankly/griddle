/**
 * Draws a paint (presets.ts) with WebGL 2 into a 2D canvas. Without WebGL 2 a paint falls back
 * to a 2D gradient of its first two colours.
 */
import { PAINT_PATTERNS, type BackdropPaint } from './presets'

// uv is 0–1 with y down; p is centred, y down, height 1 (x runs about ±0.8).
const HEAD = `#version 300 es
precision highp float;
uniform vec2 R, L1, L2; uniform float T, G, V, GS, SC, ANG, PK, PA, PO, PZ, PW;
uniform vec3 A, B, C, D, PI;
out vec4 o;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float glow(vec2 p, vec2 c, float r) { vec2 d = p - c; return exp(-dot(d, d) / (r * r)); }
`
// The pattern sits on the fill, before grain and vignette. PZ: cell size in 1/1000 of the height.
const MAIN = `
float band(float d, float w) { return 1. - smoothstep(w, w + 1., d); }
vec3 pattern(vec3 c) {
  if (PK < .5) return c;
  float u = R.y / 1000., cs = PZ * u, w = PW * u;
  vec2 g = gl_FragCoord.xy / cs;
  float m = band(length((fract(g) - .5) * cs), w + .3);
  float l = dot(c, vec3(.299, .587, .114));
  vec3 ink = PA > .5 ? (l > .5 ? c * .64 : mix(c, vec3(1), .42)) : PI;
  return mix(c, ink, m * PO);
}
void main() {
  vec2 uv = vec2(gl_FragCoord.x / R.x, 1. - gl_FragCoord.y / R.y);
  vec2 p = (uv - .5) * vec2(R.x / R.y, 1.);
  vec3 c = pattern(bg(uv, p, T));
  c *= mix(1., 1. - smoothstep(.3, 1., length(p)) * .7, V);
  float cell = max(1., R.y / 700.);
  c += (h21(floor(gl_FragCoord.xy / cell) + 7.) - .5) * G * .2;
  c += (h21(gl_FragCoord.xy * 1.37 + 3.1) - .5) / 255.;
  o = vec4(clamp(c, 0., 1.), 1.);
}`
const body = (code: string) => `vec3 bg(vec2 uv, vec2 p, float t) {\n${code}\n}`

const GRADIENT = `
  vec2 dir = vec2(cos(ANG), sin(ANG));
  vec3 c = mix(A, B, smoothstep(0., 1., dot(p, dir) / 1.9 + .5));
  c = mix(c, C, glow(p, L1, .5 * SC) * GS);
  return mix(c, D, glow(p, L2, .6 * SC) * GS * .85);`

const NAMES = [
	'R',
	'L1',
	'L2',
	'T',
	'G',
	'V',
	'GS',
	'SC',
	'ANG',
	'PK',
	'PA',
	'PO',
	'PZ',
	'PW',
	'A',
	'B',
	'C',
	'D',
	'PI',
] as const
type Program = { p: WebGLProgram } & Record<
	(typeof NAMES)[number],
	WebGLUniformLocation | null
>

const hex3 = (h: string): [number, number, number] =>
	[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
		number,
		number,
		number,
	]
/** A light's position in the shader's p space. */
const at = ([x, y]: [number, number]): [number, number] => [x * 0.8, y * 0.5]

let gl: WebGL2RenderingContext | null | undefined
let glCanvas: HTMLCanvasElement | OffscreenCanvas
const programs = new Map<string, Program>()

function context(): WebGL2RenderingContext | null {
	// Chrome can drop the context (too many in the process, shared with every extension frame)
	// before its lost event arrives: a fresh one then, or the 2D gradient.
	if (gl?.isContextLost()) {
		gl = undefined
		programs.clear()
	}
	if (gl !== undefined) return gl
	glCanvas = document.createElement('canvas')
	try {
		gl = glCanvas.getContext('webgl2', {
			preserveDrawingBuffer: true,
			antialias: false,
		})
	} catch {
		gl = null
	}
	if (gl) {
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 3, -1, -1, 3]),
			gl.STATIC_DRAW,
		)
		;(glCanvas as HTMLCanvasElement).addEventListener(
			'webglcontextlost',
			() => {
				gl = undefined
				programs.clear()
			},
		)
	}
	return gl
}

function program(
	g: WebGL2RenderingContext,
	
): Program {
	const key = 'gradient'
	const have = programs.get(key)
	if (have) return have
	// A lost context hands out null objects: throw, and drawPaint falls back to the gradient.
	const shader = (type: number, src: string) => {
		const s = g.createShader(type)
		if (!s) throw new Error('paintGL: context lost')
		g.shaderSource(s, src)
		g.compileShader(s)
		return s
	}
	const p = g.createProgram()
	if (!p) throw new Error('paintGL: context lost')
	g.attachShader(
		p,
		shader(
			g.VERTEX_SHADER,
			'#version 300 es\nin vec2 a; void main() { gl_Position = vec4(a, 0., 1.); }',
		),
	)
	g.attachShader(p, shader(g.FRAGMENT_SHADER, HEAD + body(GRADIENT) + MAIN))
	g.bindAttribLocation(p, 0, 'a')
	g.linkProgram(p)
	const u = { p } as Program
	for (const n of NAMES)
		(u as Record<string, unknown>)[n] = g.getUniformLocation(p, n)
	programs.set(key, u)
	return u
}

/** The largest side the shared context draws; bigger paints are drawn at this and stretched. */
export function maxPaintSide(): number {
	const g = context()
	return g ?
			Math.min(4096, (g.getParameter(g.MAX_RENDERBUFFER_SIZE) as number | null) || 4096)
		:	4096
}

/** Draws `paint` into `target` (its whole size). */
export function drawPaint(
	paint: BackdropPaint,
	target: HTMLCanvasElement,
): void {
	const w = target.width
	const h = target.height
	const ctx = target.getContext('2d')
	if (!ctx) return
	const g = context()
	if (!g || !drawWithGL(g, paint, ctx, w, h)) {
		const grad = ctx.createLinearGradient(0, 0, w, h)
		grad.addColorStop(0, paint.c[0])
		grad.addColorStop(1, paint.fill === 'solid' ? paint.c[0] : paint.c[1])
		ctx.fillStyle = grad
		ctx.fillRect(0, 0, w, h)
	}
}

/**
 * The shader's paint into `ctx`; false when the context is lost (before or while drawing), so
 * the caller draws the plain gradient instead of a blank or a throw.
 */
function drawWithGL(
	g: WebGL2RenderingContext,
	paint: BackdropPaint,
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
): boolean {
	try {
		paintWithGL(g, paint, ctx, w, h)
		return !g.isContextLost()
	} catch {
		gl = undefined
		programs.clear()
		return false
	}
}

function paintWithGL(
	g: WebGL2RenderingContext,
	paint: BackdropPaint,
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
): void {
	const cv = glCanvas as HTMLCanvasElement
	if (cv.width < w || cv.height < h) {
		cv.width = Math.max(cv.width, w)
		cv.height = Math.max(cv.height, h)
	}
	const solid = paint.fill === 'solid'
	const U = program(g)
	const c = solid ? [paint.c[0], paint.c[0], paint.c[0], paint.c[0]] : paint.c
	g.viewport(0, 0, w, h)
	g.useProgram(U.p)
	g.uniform2f(U.R, w, h)
	g.uniform2f(U.L1, ...at(paint.l1))
	g.uniform2f(U.L2, ...at(paint.l2))
	g.uniform1f(U.T, 0)
	g.uniform1f(U.G, paint.grain / 100)
	g.uniform1f(U.V, paint.vig / 100)
	g.uniform1f(U.GS, solid ? 0 : paint.glow / 100)
	g.uniform1f(U.SC, paint.scale / 100)
	g.uniform1f(U.ANG, (paint.ang * Math.PI) / 180)
	g.uniform1f(U.PK, PAINT_PATTERNS.indexOf(paint.pat))
	g.uniform1f(U.PA, paint.ink === 'auto' ? 1 : 0)
	g.uniform1f(U.PO, paint.pop / 100)
	g.uniform1f(U.PZ, paint.psz)
	g.uniform1f(U.PW, paint.pw / 10)
	;(['A', 'B', 'C', 'D'] as const).forEach((k, i) =>
		g.uniform3f(U[k], ...hex3(c[i])),
	)
	g.uniform3f(U.PI, ...hex3(paint.inkc))
	g.enableVertexAttribArray(0)
	g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
	g.drawArrays(g.TRIANGLES, 0, 3)
	if (g.isContextLost()) return
	ctx.clearRect(0, 0, w, h)
	ctx.drawImage(cv, 0, cv.height - h, w, h, 0, 0, w, h)
}

/** A new canvas of `paint`, `width` × `height` px. */
export function paintCanvas(
	paint: BackdropPaint,
	width: number,
	height: number,
): HTMLCanvasElement {
	const c = document.createElement('canvas')
	c.width = Math.max(1, Math.round(width))
	c.height = Math.max(1, Math.round(height))
	drawPaint(paint, c)
	return c
}

const thumbs = new Map<string, string>()
/** A small picture of `paint` as a data URL (swatches and look tiles), cached. */
export function paintThumb(
	paint: BackdropPaint,
	width = 96,
	height = 60,
): string {
	const key = `${width}x${height}:${JSON.stringify(paint)}`
	let url = thumbs.get(key)
	if (!url) {
		url = paintCanvas(paint, width, height).toDataURL()
		if (thumbs.size > 300) thumbs.clear()
		thumbs.set(key, url)
	}
	return url
}
