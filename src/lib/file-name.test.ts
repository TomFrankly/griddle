import { describe, expect, it } from 'vitest';
import { safeFileName } from './file-name';

describe('safeFileName', () => {
	it('keeps an ordinary name', () => {
		expect(safeFileName('Summer poses 2026')).toBe('Summer poses 2026');
	});
	it('is empty for blank input so the default name is used', () => {
		expect(safeFileName('   ')).toBe('');
		expect(safeFileName('...')).toBe('');
	});
	it('drops a typed export extension', () => {
		expect(safeFileName('thumbs.PNG')).toBe('thumbs');
		expect(safeFileName('thumbs.jpeg')).toBe('thumbs');
		expect(safeFileName('v1.2 final')).toBe('v1.2 final');
	});
	it('replaces characters file systems reject', () => {
		expect(safeFileName('a/b\\c:d*e?"f"<g>|h')).toBe('a-b-c-d-e-f-g-h');
	});
	it('trims leading dots and surrounding spaces', () => {
		expect(safeFileName('  .hidden  ')).toBe('hidden');
	});
	it('caps the length', () => {
		expect(safeFileName('x'.repeat(300))).toHaveLength(120);
	});
});
