/**
 * Keeps the current grid across reloads, in this browser only: settings in localStorage and the
 * images themselves in IndexedDB. Nothing leaves the device.
 */

const SETTINGS_KEY = 'griddle:session';
const DB = 'griddle';
const STORE = 'images';

export function loadSettings<T>(): T | null {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

export function saveSettings(value: unknown) {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
	} catch {
		// Storage can be full or unavailable; the grid then lasts for this visit only.
	}
}

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
	dbPromise ??= new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
	return db().then(
		(d) =>
			new Promise((resolve, reject) => {
				const tx = d.transaction(STORE, mode);
				const req = fn(tx.objectStore(STORE));
				tx.oncomplete = () => resolve(req ? req.result : undefined);
				tx.onerror = () => reject(tx.error);
			})
	);
}

/** Stored image files by id. */
export async function loadFiles(ids: string[]): Promise<Map<string, File>> {
	const out = new Map<string, File>();
	try {
		for (const id of ids) {
			const f = await run<File>('readonly', (s) => s.get(id));
			if (f) out.set(id, f);
		}
	} catch {
		// Without IndexedDB nothing was stored.
	}
	return out;
}

const stored = new Set<string>();

export type BackgroundSlot = 'canvas' | 'cell';
const BG_KEYS: Record<BackgroundSlot, string> = { canvas: 'bg:image', cell: 'bg:cell' };
const isBgKey = (k: string) => k.startsWith('bg:');

/** An uploaded background image, if one was stored. */
export async function loadBackground(slot: BackgroundSlot = 'canvas'): Promise<File | undefined> {
	try {
		return (await run<File>('readonly', (s) => s.get(BG_KEYS[slot]))) ?? undefined;
	} catch {
		return undefined;
	}
}

const storedBg: Partial<Record<BackgroundSlot, File | null>> = {};

/** Stores a background image, or removes it when there is none. */
export async function saveBackground(file: File | null, slot: BackgroundSlot = 'canvas') {
	if (file === storedBg[slot]) return;
	try {
		await run('readwrite', (s) => {
			if (file) s.put(file, BG_KEYS[slot]);
			else s.delete(BG_KEYS[slot]);
		});
		storedBg[slot] = file;
	} catch {
		// Ignore: storage is a convenience.
	}
}

/** Stores one image file right away, so it is kept even if the tab closes soon after. */
export async function storeFile(id: string, file: File) {
	try {
		await run('readwrite', (s) => {
			s.put(file, id);
		});
		stored.add(id);
	} catch {
		// Ignore: storage is a convenience.
	}
}

/** Makes the store hold exactly these image files. */
export async function syncFiles(files: { id: string; file: File }[]) {
	try {
		const keys = ((await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) ?? []).map(String);
		keys.forEach((k) => !isBgKey(k) && stored.add(k));
		const want = new Set(files.map((f) => f.id));
		await run('readwrite', (s) => {
			for (const k of keys) if (!want.has(k) && !isBgKey(k)) s.delete(k);
			for (const f of files) if (!stored.has(f.id)) s.put(f.file, f.id);
		});
		stored.clear();
		want.forEach((k) => stored.add(k));
	} catch {
		// Ignore: storage is a convenience.
	}
}
