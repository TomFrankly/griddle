const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 3600e3],
	['month', 30 * 24 * 3600e3],
	['week', 7 * 24 * 3600e3],
	['day', 24 * 3600e3],
	['hour', 3600e3],
	['minute', 60e3]
];

/** "3 hours ago", "yesterday", or "just now" for under a minute. */
export function timeAgo(then: number, now = Date.now()): string {
	const diff = now - then;
	if (diff < 60e3) return 'just now';
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	for (const [unit, ms] of UNITS) if (diff >= ms) return rtf.format(-Math.floor(diff / ms), unit);
	return 'just now';
}
