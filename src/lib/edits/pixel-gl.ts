/**
 * Runs every pixel operation from the registry in one WebGL 2 pass. The shader is built once from
 * the operations' GLSL, in registry order; an operation at its initial values leaves pixels as
 * they are, and the pass is skipped entirely when no pixel operation is in use.
 */
import { OPERATIONS, type Param } from './registry';
import { valueOf, stageActive, type ImageEdits } from './edits';

const PIXEL_OPS = OPERATIONS.filter((op) => op.stage === 'pixel' && op.glsl);
const UNIFORMS: Param[] = PIXEL_OPS.flatMap((op) => op.params);

const uniformType = (p: Param) => (p.kind === 'color' ? 'vec3' : 'float');

const VERT = `#version 300 es
in vec2 a;
out vec2 uv;
void main() { uv = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;

export const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D img;
${UNIFORMS.map((p) => `uniform ${uniformType(p)} u_${p.id};`).join('\n')}
out vec4 o;
const vec3 LUMA = vec3(.2126, .7152, .0722);
vec3 toLinear(vec3 c) { c = max(c, 0.); return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
void main() {
  vec4 px = texture(img, uv);
  vec3 c = px.rgb;
${PIXEL_OPS.map((op) => `  // ${op.label}\n  ${op.glsl!.replace(/\n/g, '\n  ')}`).join('\n')}
  o = vec4(clamp(c, 0., 1.), px.a);
}`;

type Gl = {
	gl: WebGL2RenderingContext;
	canvas: HTMLCanvasElement;
	loc: Map<string, WebGLUniformLocation | null>;
	tex: WebGLTexture;
	maxSize: number;
};
let state: Gl | null | undefined;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
	const s = gl.createShader(type)!;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'Shader error');
	return s;
}

function setup(): Gl | null {
	if (state !== undefined) return state;
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
		if (!gl) return (state = null);
		const prog = gl.createProgram()!;
		gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'Link error');
		gl.useProgram(prog);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
		const a = gl.getAttribLocation(prog, 'a');
		gl.enableVertexAttribArray(a);
		gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
		const tex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0);
		const loc = new Map(UNIFORMS.map((p) => [p.id, gl.getUniformLocation(prog, `u_${p.id}`)]));
		const maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, ...(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array));
		canvas.addEventListener('webglcontextlost', () => (state = undefined));
		return (state = { gl, canvas, loc, tex, maxSize });
	} catch (e) {
		console.warn('Image edits could not start WebGL:', e);
		return (state = null);
	}
}

/** False when this browser can't run color edits. */
export const pixelEditsAvailable = () => !!setup();

const hex3 = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];

/**
 * Draws `source` with its pixel edits onto a new 2D canvas, or returns null when there are none
 * to apply (or WebGL is unavailable, in which case the image is drawn unedited). Images larger
 * than the GPU allows are processed at the largest size it can take.
 */
export function applyPixels(
	source: TexImageSource & { width: number; height: number },
	edits: ImageEdits | undefined
): HTMLCanvasElement | null {
	if (!stageActive(edits, 'pixel')) return null;
	const g = setup();
	if (!g) return null;
	const { gl } = g;
	const k = Math.min(1, g.maxSize / Math.max(source.width, source.height));
	const w = Math.max(1, Math.round(source.width * k));
	const h = Math.max(1, Math.round(source.height * k));
	let input: TexImageSource = source;
	if (k < 1) {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		c.getContext('2d')?.drawImage(source as CanvasImageSource, 0, 0, w, h);
		input = c;
	}
	g.canvas.width = w;
	g.canvas.height = h;
	gl.viewport(0, 0, w, h);
	gl.bindTexture(gl.TEXTURE_2D, g.tex);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
	for (const p of UNIFORMS) {
		const l = g.loc.get(p.id);
		if (!l) continue;
		const v = valueOf(edits, p.id);
		if (p.kind === 'color') gl.uniform3fv(l, hex3(String(v)));
		else if (p.kind === 'choice') gl.uniform1f(l, Math.max(0, p.options.findIndex((o) => o.value === v)));
		else gl.uniform1f(l, typeof v === 'boolean' ? (v ? 1 : 0) : Number(v));
	}
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	const out = document.createElement('canvas');
	out.width = w;
	out.height = h;
	out.getContext('2d')?.drawImage(g.canvas, 0, 0);
	return out;
}
