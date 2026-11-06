import type { Span } from './grid';
import type { RichText } from './captions';

type Cell = { file: unknown; span: Span; title: RichText; desc: RichText };

/**
 * Puts new images into a list of cells. The first goes into cell `start` (replacing what is there);
 * the rest fill the empty slots after it, in order, and any left over are added at the end.
 * A cell keeps its span, and an empty slot also keeps the captions written for it.
 */
export function fillSlots<T extends Cell>(cells: T[], incoming: T[], start = -1): T[] {
	const next = [...cells];
	const into = (i: number, img: T) => {
		const old = next[i];
		next[i] = old.file ? { ...img, span: { ...old.span } } : { ...img, span: { ...old.span }, title: old.title, desc: old.desc };
	};
	let rest = incoming;
	if (start >= 0 && start < next.length && rest.length) {
		into(start, rest[0]);
		rest = rest.slice(1);
	}
	for (let i = Math.max(0, start + 1); i < next.length && rest.length; i++) {
		if (next[i].file) continue;
		into(i, rest[0]);
		rest = rest.slice(1);
	}
	return [...next, ...rest];
}
