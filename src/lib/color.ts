export type Hsv = { h: number; s: number; v: number };

/** "#abc", "abc", "#AABBCC" or "aabbcc" as "#aabbcc"; null when it isn't a hex color. */
export function parseHex(input: string): string | null {
	const m = input.trim().replace(/^#/, '').toLowerCase();
	if (/^[0-9a-f]{3}$/.test(m)) return `#${[...m].map((c) => c + c).join('')}`;
	if (/^[0-9a-f]{6}$/.test(m)) return `#${m}`;
	return null;
}

export function hexToHsv(hex: string): Hsv {
	const h6 = parseHex(hex) ?? '#000000';
	const n = parseInt(h6.slice(1), 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const d = max - Math.min(r, g, b);
	let h = 0;
	if (d) {
		if (max === r) h = ((g - b) / d) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h = (h * 60 + 360) % 360;
	}
	return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
	const f = (n: number) => {
		const k = (n + h / 60) % 6;
		return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
	};
	return `#${[f(5), f(3), f(1)]
		.map((x) => Math.round(x * 255).toString(16).padStart(2, '0'))
		.join('')}`;
}
