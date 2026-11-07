/**
 * Turns an image and its edits into something to draw: geometry first, then the pixel pass.
 * Results for on-screen previews are cached per source image, so redrawing the grid only redoes
 * the images whose edits changed.
 */
import { editsKey, stageActive, type ImageEdits } from './edits';
import { applyGeometry } from './geometry';
import { applyPixels } from './pixel-gl';

type Sized = CanvasImageSource & TexImageSource & { width: number; height: number };

/** The edited image, or the source itself when it has no edits. */
export function applyEdits(source: Sized, edits: ImageEdits | undefined): Sized {
	if (!stageActive(edits, 'geometry') && !stageActive(edits, 'pixel')) return source;
	const turned = applyGeometry(source, edits) ?? source;
	return applyPixels(turned, edits) ?? turned;
}

const cache = new WeakMap<object, { key: string; out: Sized }>();

/** Like applyEdits, remembering the last result for each source. */
export function editedPreview(source: Sized, edits: ImageEdits | undefined): Sized {
	const key = editsKey(edits);
	if (!key) return source;
	const hit = cache.get(source);
	if (hit?.key === key) return hit.out;
	const out = applyEdits(source, edits);
	cache.set(source, { key, out });
	return out;
}
