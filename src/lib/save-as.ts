/**
 * "Save as" through the File System Access API, which opens the system save
 * window so people pick the folder and name. Chromium browsers have it;
 * Safari and Firefox do not.
 */
type SaveType = { description: string; accept: Record<string, string[]> };
type Picker = (options: { suggestedName: string; types?: SaveType[] }) => Promise<FileSystemFileHandle>;

export const canSaveAs = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

const TYPES: Record<string, SaveType> = {
	png: { description: 'PNG image', accept: { 'image/png': ['.png'] } },
	jpg: { description: 'JPG image', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } },
	webp: { description: 'WebP image', accept: { 'image/webp': ['.webp'] } },
	psd: { description: 'Photoshop document', accept: { 'image/vnd.adobe.photoshop': ['.psd'] } }
};

/**
 * Opens the save window. Call it straight from the click, before any slow work,
 * because browsers only allow it right after a user action. Returns null when
 * the person cancels.
 */
export async function pickSaveFile(name: string, ext: string): Promise<FileSystemFileHandle | null> {
	const picker = (window as unknown as { showSaveFilePicker: Picker }).showSaveFilePicker;
	try {
		return await picker({ suggestedName: name, types: TYPES[ext] ? [TYPES[ext]] : undefined });
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') return null;
		throw e;
	}
}

export async function writeFile(handle: FileSystemFileHandle, blob: Blob) {
	const w = await (handle as unknown as { createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }).createWritable();
	await w.write(blob);
	await w.close();
}
