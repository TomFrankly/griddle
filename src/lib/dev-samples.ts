/**
 * Development-only test images: random Pokémon artwork from PokeAPI, fetched at runtime. These
 * are transparent PNGs, handy for checking cell backgrounds. Not shown in production builds.
 */
const MAX_ID = 1025;

function randomIds(count: number): number[] {
	const ids = new Set<number>();
	while (ids.size < count) ids.add(1 + Math.floor(Math.random() * MAX_ID));
	return [...ids];
}

async function one(id: number): Promise<File | null> {
	try {
		const info = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`).then((r) => r.json());
		const url: string | undefined = info?.sprites?.other?.['official-artwork']?.front_default;
		if (!url) return null;
		const blob = await fetch(url).then((r) => r.blob());
		const name = String(info.name ?? id).replace(/(^|-)\w/g, (m) => m.toUpperCase());
		return new File([blob], `${name}.png`, { type: 'image/png' });
	} catch {
		return null;
	}
}

export async function pokemonFiles(count = 25): Promise<File[]> {
	const files = await Promise.all(randomIds(count).map(one));
	return files.filter((f): f is File => !!f);
}
