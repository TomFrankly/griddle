/** Generated stand-ins, used when no example photos are bundled. */
const PALETTES = [
	['#ff7a59', '#ffd166'],
	['#3a86ff', '#8ecae6'],
	['#2a9d8f', '#e9c46a'],
	['#6d597a', '#e56b6f'],
	['#264653', '#f4a261'],
	['#118ab2', '#06d6a0'],
	['#ef476f', '#ffd6e0'],
	['#3d405b', '#81b29a'],
	['#bc4749', '#f2e8cf']
];
const SIZES: [number, number][] = [
	[1200, 800],
	[800, 1200],
	[1000, 1000],
	[1600, 900],
	[900, 1350],
	[1200, 900],
	[1080, 1080],
	[1400, 700],
	[1000, 1250]
];

async function placeholderFiles(n: number): Promise<File[]> {
	const out: File[] = [];
	for (let i = 0; i < n; i++) {
		const [w, h] = SIZES[i % SIZES.length];
		const [a, b] = PALETTES[i % PALETTES.length];
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d')!;
		const g = ctx.createLinearGradient(0, 0, w, h);
		g.addColorStop(0, a);
		g.addColorStop(1, b);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.beginPath();
		ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.22, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = a;
		ctx.font = `600 ${Math.round(Math.min(w, h) * 0.2)}px system-ui, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(String(i + 1), w * 0.5, h * 0.5);
		const blob = await new Promise<Blob>((r) => c.toBlob((x) => r(x!), 'image/png'));
		out.push(new File([blob], `sample-${i + 1}.png`, { type: 'image/png' }));
	}
	return out;
}

// Photos in src/assets/examples (pose-1 … pose-9, keyed out to transparency) make the grid shown
// before any upload.
const bundled = import.meta.glob('../assets/examples/*.{jpg,jpeg,png,webp}', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

export async function exampleFiles(): Promise<File[]> {
	const entries = Object.entries(bundled).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
	if (!entries.length) return placeholderFiles(9);
	return Promise.all(
		entries.map(async ([path, url]) => {
			const blob = await (await fetch(url)).blob();
			return new File([blob], path.split('/').pop() ?? 'example.webp', { type: blob.type || 'image/webp' });
		})
	);
}
