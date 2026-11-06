/**
 * Notices when a newer build has been deployed, by comparing this build's id with the one in
 * /version.json. Checks when the tab comes back into view and every 15 minutes while open.
 */
export function watchForUpdates(onUpdate: () => void): () => void {
	const current = import.meta.env.VITE_BUILD_ID as string | undefined;
	if (import.meta.env.DEV || !current || location.protocol === 'file:') return () => {};
	let found = false;
	let last = 0;
	const check = async () => {
		if (found || Date.now() - last < 60_000) return;
		last = Date.now();
		try {
			const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
			if (!res.ok) return;
			const { build } = (await res.json()) as { build?: string };
			if (build && build !== current) {
				found = true;
				onUpdate();
			}
		} catch {
			// Offline or blocked: try again later.
		}
	};
	const onVisible = () => document.visibilityState === 'visible' && check();
	document.addEventListener('visibilitychange', onVisible);
	const timer = setInterval(check, 15 * 60_000);
	const first = setTimeout(check, 10_000);
	return () => {
		document.removeEventListener('visibilitychange', onVisible);
		clearInterval(timer);
		clearTimeout(first);
	};
}
