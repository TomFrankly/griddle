import { describe, expect, it } from 'vitest';
import { ActionRegistry, formatKey, matchesKey } from './registry';

const key = (k: string, code: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
	key: k,
	code,
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	...mods
});

describe('matchesKey', () => {
	it('treats Mod as either Command or Control', () => {
		expect(matchesKey('Mod+Z', key('z', 'KeyZ', { metaKey: true }))).toBe(true);
		expect(matchesKey('Mod+Z', key('z', 'KeyZ', { ctrlKey: true }))).toBe(true);
		expect(matchesKey('Mod+Z', key('z', 'KeyZ'))).toBe(false);
	});

	it('needs exactly the listed modifiers', () => {
		expect(matchesKey('Mod+Z', key('z', 'KeyZ', { metaKey: true, shiftKey: true }))).toBe(false);
		expect(matchesKey('Mod+Shift+Z', key('Z', 'KeyZ', { metaKey: true, shiftKey: true }))).toBe(true);
	});

	it('matches letters by physical key, so Mac Alt characters still work', () => {
		expect(matchesKey('Mod+Alt+C', key('ç', 'KeyC', { metaKey: true, altKey: true }))).toBe(true);
	});

	it('keeps Ctrl apart from Command', () => {
		expect(matchesKey('Ctrl+Y', key('y', 'KeyY', { ctrlKey: true }))).toBe(true);
		expect(matchesKey('Ctrl+Y', key('y', 'KeyY', { metaKey: true }))).toBe(false);
	});

	it('handles punctuation and the plus key', () => {
		expect(matchesKey('Mod+]', key(']', 'BracketRight', { metaKey: true }))).toBe(true);
		expect(matchesKey('Mod+Shift+=', key('+', 'Equal', { metaKey: true, shiftKey: true }))).toBe(true);
		expect(matchesKey('Escape', key('Escape', 'Escape'))).toBe(true);
	});
});

describe('formatKey', () => {
	it('writes shortcuts the way each platform does', () => {
		expect(formatKey('Mod+Alt+C', true)).toBe('⌥⌘C');
		expect(formatKey('Mod+Alt+C', false)).toBe('Ctrl+Alt+C');
		expect(formatKey('Shift+1', true)).toBe('⇧1');
	});
});

describe('ActionRegistry', () => {
	it('runs enabled actions by id or key, and skips disabled ones', () => {
		let ran = '';
		let on = false;
		const r = new ActionRegistry().register(
			{ id: 'a.one', label: 'One', group: 'view', keys: ['Mod+1'], run: () => (ran = 'one') },
			{ id: 'a.two', label: 'Two', group: 'view', keys: ['Mod+2'], enabled: () => on, run: () => (ran = 'two') }
		);
		expect(r.run('a.two')).toBe(false);
		expect(r.forKey(key('1', 'Digit1', { metaKey: true }))?.id).toBe('a.one');
		on = true;
		expect(r.run('a.two')).toBe(true);
		expect(ran).toBe('two');
		expect(r.run('missing')).toBe(false);
	});

	it('refuses the same id twice', () => {
		const a = { id: 'x.y', label: 'X', group: 'view' as const, run: () => {} };
		expect(() => new ActionRegistry().register(a, a)).toThrow();
	});
});
