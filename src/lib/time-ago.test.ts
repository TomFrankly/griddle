import { describe, expect, it } from 'vitest';
import { timeAgo } from './time-ago';

describe('timeAgo', () => {
	const now = Date.UTC(2026, 10, 7, 12);
	it('says just now under a minute', () => expect(timeAgo(now - 30e3, now)).toBe('just now'));
	it('uses the largest whole unit', () => {
		expect(timeAgo(now - 5 * 60e3, now)).toMatch(/5 minutes ago/);
		expect(timeAgo(now - 3 * 3600e3, now)).toMatch(/3 hours ago/);
	});
});
