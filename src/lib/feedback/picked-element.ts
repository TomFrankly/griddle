/**
 * What "Point to it" says about the part it pictured, so the feedback names the element
 * and not only shows it: its tag, text and label, and where it sits in the page.
 * No markup is copied: only what's shown here goes.
 */

/** The element in one line: <tag> · "its text" · label "…" · data-testid=…. */
export function describeElement(el: Element): string {
	const tag = el.tagName.toLowerCase();
	const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
	const bits = [`<${tag}>`];
	if (text) bits.push(`"${text.length > 90 ? text.slice(0, 90) + '…' : text}"`);
	const aria = el.getAttribute('aria-label') || el.getAttribute('title');
	if (aria) bits.push(`label "${aria}"`);
	const testid = el.closest('[data-testid]')?.getAttribute('data-testid');
	if (testid) bits.push(`data-testid=${testid}`);
	return bits.join(' · ');
}

/** One step of the path: tag, id, up to two readable classes and a data-* marker. */
function step(el: Element): string {
	let out = el.tagName.toLowerCase();
	if (el.id && !/\d{3,}/.test(el.id)) out += `#${el.id}`;
	const classes = [...el.classList].filter((c) => !c.startsWith('svelte-') && !/[:[\]/]/.test(c)).slice(0, 2);
	if (classes.length) out += '.' + classes.join('.');
	const marker = [...el.attributes].find((a) => a.name.startsWith('data-'));
	if (marker) out += `[${marker.name}]`;
	return out;
}

/** Where the element is, from inside root down to it, at most five steps. */
export function elementPath(el: Element, root: Element): string {
	const steps: string[] = [];
	for (let n: Element | null = el; n && n !== root && steps.length < 5; n = n.parentElement) steps.unshift(step(n));
	return steps.join(' > ');
}

/** The lines that go under the picture in the message. */
export function pickedElementText(el: Element, root: Element, view: string): string {
	const r = el.getBoundingClientRect();
	return [`Picked: ${describeElement(el)}`, `Path: ${elementPath(el, root)}`, `View: ${view} · ${Math.round(r.width)}×${Math.round(r.height)}`].join('\n');
}
