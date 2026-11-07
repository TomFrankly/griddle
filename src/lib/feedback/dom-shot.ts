/**
 * A PNG of part of the page drawn from its DOM, for feedback's "Point to it", with no
 * screen-capture permission. The element is cloned with every computed style written inline
 * (only where it differs from the tag's default, to keep it small), pseudo-elements as rules,
 * the fonts in use embedded, canvases as their pixels, and drawn through an SVG
 * <foreignObject>. Close to the real pixels, not identical: scrollbars, backdrop filters and
 * CSS background images are left out.
 */
export type Rect = { left: number; top: number; right: number; bottom: number };

const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE']);
const MAX_FONT_BYTES = 6_000_000;

let defaultsFrame: HTMLIFrameElement | null = null;
const defaults = new Map<string, Map<string, string>>();

/** Computed style of a bare `tag` in an empty document, cached per tag. */
function defaultStyle(tag: string): Map<string, string> {
	const cached = defaults.get(tag);
	if (cached) return cached;
	if (!defaultsFrame) {
		defaultsFrame = document.createElement('iframe');
		defaultsFrame.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;visibility:hidden';
		defaultsFrame.setAttribute('aria-hidden', 'true');
		document.body.append(defaultsFrame);
	}
	const doc = defaultsFrame.contentDocument!;
	const el = doc.createElement(tag);
	doc.body.append(el);
	const style = defaultsFrame.contentWindow!.getComputedStyle(el);
	const map = new Map<string, string>();
	for (let i = 0; i < style.length; i++) map.set(style[i], style.getPropertyValue(style[i]));
	el.remove();
	defaults.set(tag, map);
	return map;
}

const INHERITED = new Set([
	'color', 'cursor', 'direction', 'visibility', 'white-space', 'word-spacing', 'letter-spacing', 'line-height',
	'quotes', 'tab-size', 'caret-color', 'fill', 'stroke', 'hyphens', 'word-break', 'overflow-wrap', 'writing-mode',
	'border-collapse', 'border-spacing', 'color-scheme', 'orphans', 'widows', 'text-align', 'text-indent',
	'text-transform', 'text-shadow', 'text-rendering', 'text-wrap', 'list-style-type', 'list-style-position',
	'list-style-image', '-webkit-font-smoothing', '-webkit-text-fill-color', '-webkit-text-stroke-color'
]);
// A computed border width reads 0px when the style is none, but its initial value is medium: with
// Tailwind's `border: 0 solid` reset, skipping "0px" would draw 3px borders everywhere.
const ALWAYS = /^(border-(top|right|bottom|left|block-start|block-end|inline-start|inline-end)-width|outline-width|column-rule-width)$/;
const inherited = (name: string) => INHERITED.has(name) || name.startsWith('font') || name.startsWith('--');

/**
 * Computed properties as inline CSS: an inherited one when it differs from the parent's (the
 * clone's parent carries that), any other when it differs from the tag's default.
 */
function styleText(style: CSSStyleDeclaration, base: Map<string, string> | null, parent: CSSStyleDeclaration | null): string {
	let out = '';
	for (let i = 0; i < style.length; i++) {
		const name = style[i];
		const value = style.getPropertyValue(name);
		if (ALWAYS.test(name)) {
			out += `${name}:${value};`;
			continue;
		}
		if (inherited(name) ? parent && parent.getPropertyValue(name) === value : base && base.get(name) === value) continue;
		out += `${name}:${value};`;
	}
	return out;
}

type Ctx = { pseudo: string[]; families: Set<string>; images: Promise<void>[]; n: number };

function cloneStyled(src: Node, ctx: Ctx, parent: CSSStyleDeclaration | null): Node | null {
	if (src.nodeType === Node.TEXT_NODE) return src.cloneNode(false);
	if (!(src instanceof Element) || SKIP.has(src.tagName)) return null;
	const style = getComputedStyle(src);
	if (style.display === 'none') return null;
	// SVG (icons): keep the markup, fix its box and color.
	if (src instanceof SVGElement) {
		const svg = src.cloneNode(true) as SVGElement;
		const r = src.getBoundingClientRect();
		svg.setAttribute('width', String(r.width));
		svg.setAttribute('height', String(r.height));
		svg.setAttribute('style', `color:${style.color};fill:${style.fill};stroke:${style.stroke};vertical-align:${style.verticalAlign};display:${style.display};flex-shrink:0`);
		return svg;
	}
	const tag = src.tagName.toLowerCase();
	let clone: HTMLElement;
	if (src instanceof HTMLCanvasElement) {
		clone = document.createElement('img');
		try {
			(clone as HTMLImageElement).src = src.toDataURL();
		} catch {
			// A tainted canvas stays blank.
		}
	} else {
		clone = src.cloneNode(false) as HTMLElement;
	}
	clone.removeAttribute('id');
	clone.setAttribute('style', styleText(style, defaultStyle(src instanceof HTMLCanvasElement ? 'img' : tag), parent));
	for (const family of style.fontFamily.split(',')) ctx.families.add(family.trim().replace(/^["']|["']$/g, '').toLowerCase());
	for (const which of ['::before', '::after'] as const) {
		const ps = getComputedStyle(src, which);
		if (!ps.content || ps.content === 'none' || ps.content === 'normal') continue;
		const cls = `griddle-shot-${ctx.n++}`;
		clone.classList.add(cls);
		ctx.pseudo.push(`.${cls}${which}{${styleText(ps, null, style)}}`);
	}
	if (src instanceof HTMLInputElement) clone.setAttribute('value', src.value);
	if (src instanceof HTMLTextAreaElement) clone.textContent = src.value;
	if (src instanceof HTMLImageElement && src.currentSrc && !src.currentSrc.startsWith('data:')) {
		ctx.images.push(
			toDataUrl(src.currentSrc).then((url) => {
				if (url) clone.setAttribute('src', url);
			})
		);
		clone.removeAttribute('srcset');
	}
	if (!(src instanceof HTMLCanvasElement)) {
		for (const child of src.childNodes) {
			const next = cloneStyled(child, ctx, style);
			if (next) clone.append(next);
		}
	}
	if (src instanceof HTMLSelectElement) {
		// Keep the shown option.
		[...clone.querySelectorAll('option')].forEach((o, i) => (o.selected = i === src.selectedIndex));
	}
	return clone;
}

async function toDataUrl(url: string): Promise<string> {
	try {
		const blob = await (await fetch(url)).blob();
		return await new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => resolve('');
			reader.readAsDataURL(blob);
		});
	} catch {
		return '';
	}
}

/** @font-face rules for the families in use, with their files inlined (the SVG can't load them). */
async function fontCss(families: Set<string>): Promise<string> {
	const rules: CSSFontFaceRule[] = [];
	const walk = (list: CSSRuleList) => {
		for (const rule of list) {
			if (rule instanceof CSSFontFaceRule) {
				const family = rule.style.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, '').toLowerCase();
				if (families.has(family)) rules.push(rule);
			} else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
		}
	};
	for (const sheet of document.styleSheets) {
		try {
			walk(sheet.cssRules);
		} catch {
			// A cross-origin sheet: its fonts fall back.
		}
	}
	let bytes = 0;
	const out: string[] = [];
	for (const rule of rules) {
		let css = rule.cssText;
		for (const match of [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)]) {
			if (match[1].startsWith('data:') || bytes > MAX_FONT_BYTES) continue;
			const url = await toDataUrl(new URL(match[1], rule.parentStyleSheet?.href ?? location.href).href);
			if (!url) continue;
			bytes += url.length;
			css = css.replace(match[0], `url("${url}")`);
		}
		out.push(css);
	}
	return out.join('\n');
}

/**
 * Draws `el` and returns the part inside `visible` (viewport CSS pixels) as a PNG data URL, at
 * the screen's devicePixelRatio. `background` fills behind it.
 */
export async function renderElement(el: HTMLElement, visible: Rect, background: string): Promise<string> {
	const full = el.getBoundingClientRect();
	const ctx: Ctx = { pseudo: [], families: new Set(), images: [], n: 0 };
	const clone = cloneStyled(el, ctx, null) as HTMLElement | null;
	if (!clone) throw new Error('nothing to draw');
	// The box keeps its size wherever it sits; inherited text styles come with its computed style.
	clone.style.margin = '0';
	clone.style.width = `${full.width}px`;
	clone.style.height = `${full.height}px`;
	clone.style.boxSizing = 'border-box';
	await Promise.all(ctx.images);
	const fonts = await fontCss(ctx.families);
	const wrapper = document.createElement('div');
	wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
	wrapper.setAttribute('style', `width:${full.width}px;height:${full.height}px;background:${background}`);
	const style = document.createElement('style');
	style.textContent = `${fonts}\n${ctx.pseudo.join('\n')}`;
	wrapper.append(style, clone);
	const xhtml = new XMLSerializer().serializeToString(wrapper);
	const w = Math.ceil(full.width);
	const h = Math.ceil(full.height);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${full.width}" height="${full.height}">${xhtml}</foreignObject></svg>`;
	const image = new Image();
	image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	await image.decode();
	const dpr = Math.max(1, devicePixelRatio || 1);
	const vw = visible.right - visible.left;
	const vh = visible.bottom - visible.top;
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(vw * dpr);
	canvas.height = Math.round(vh * dpr);
	const g = canvas.getContext('2d')!;
	g.scale(dpr, dpr);
	g.fillStyle = background;
	g.fillRect(0, 0, vw, vh);
	g.drawImage(image, full.left - visible.left, full.top - visible.top, w, h);
	return canvas.toDataURL('image/png');
}
