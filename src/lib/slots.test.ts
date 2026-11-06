import { describe, expect, it } from 'vitest';
import { fillSlots } from './slots';
import { fromPlain } from './captions';

const img = (id: string) => ({ id, file: {} as unknown, span: { w: 1, h: 1 }, title: [] as ReturnType<typeof fromPlain>, desc: [] as ReturnType<typeof fromPlain> });
const slot = (id: string, span = { w: 1, h: 1 }, title = '') => ({ ...img(id), file: null, span, title: title ? fromPlain(title) : [] });
const ids = (l: { id: string }[]) => l.map((c) => c.id);

describe('fillSlots', () => {
	it('fills empty slots in order before adding to the end', () => {
		const out = fillSlots([img('a'), slot('s1'), img('b'), slot('s2')], [img('x'), img('y'), img('z')]);
		expect(ids(out)).toEqual(['a', 'x', 'b', 'y', 'z']);
	});

	it('appends when there are no empty slots', () => {
		expect(ids(fillSlots([img('a')], [img('x')]))).toEqual(['a', 'x']);
	});

	it('keeps an empty slot’s span and captions', () => {
		const [out] = fillSlots([slot('s', { w: 2, h: 2 }, 'Hello')], [img('x')]);
		expect(out.id).toBe('x');
		expect(out.span).toEqual({ w: 2, h: 2 });
		expect(out.title).toEqual(fromPlain('Hello'));
	});

	it('replaces the target cell and sends the rest to later empty slots, not earlier ones or images', () => {
		const out = fillSlots([slot('s0'), img('a'), img('b'), slot('s3')], [img('x'), img('y'), img('z')], 1);
		expect(ids(out)).toEqual(['s0', 'x', 'b', 'y', 'z']);
	});

	it('keeps the replaced image’s span but uses the new image’s captions', () => {
		const old = { ...img('a'), span: { w: 3, h: 1 }, title: fromPlain('Old') };
		const [out] = fillSlots([old], [img('x')], 0);
		expect(out.span).toEqual({ w: 3, h: 1 });
		expect(out.title).toEqual([]);
	});
});
