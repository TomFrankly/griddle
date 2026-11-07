<!--
  @component
  Opens one frame as its own editor over the stage. The frame grows out of its cell into the whole
  image, so you see everything the cell crops away, with the cell's crop marked on top. Drag the
  crop to move the image in its cell and scroll to zoom it; the Image tab beside it edits the
  image itself. Done (or Escape) shrinks it back into its cell.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { editedPreview, editedSize } from '$lib/edits';
	import { focusOf, framePlace, type CellChange } from '$lib/cell-edits';
	import type { Rect } from '$lib/grid';
	import type { FitMode, GridImage } from '$lib/render';

	let {
		image,
		area,
		cellRect,
		fit,
		free,
		onedit,
		onclose
	}: {
		image: GridImage;
		/** The area the image sits in within its cell, in preview pixels. */
		area: Rect;
		/** The cell's box on screen, which the editor opens from and closes into. */
		cellRect: () => DOMRect | null;
		fit: FitMode;
		free: boolean;
		/** Applies a framing change to this image only. */
		onedit: (change: CellChange) => void;
		onclose: () => void;
	} = $props();

	let root: HTMLDivElement | undefined = $state();
	let frame: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let W = $state(0);
	let H = $state(0);
	let ready = $state(false);
	const HEADER = 48;
	const PAD = 32;

	const size = $derived(editedSize(image.width, image.height, image.edits));
	/** Where the whole image shows in the editor. */
	const shown = $derived.by(() => {
		const aw = Math.max(1, W - PAD * 2);
		const ah = Math.max(1, H - HEADER - PAD * 2);
		const k = Math.min(aw / size.width, ah / size.height);
		const w = size.width * k;
		const h = size.height * k;
		return { x: (W - w) / 2, y: HEADER + PAD + (ah - h) / 2, w, h };
	});
	const place = $derived(framePlace(size.width, size.height, area, fit, image.adjust, free, focusOf(image.edits)));
	/** The part of the image the cell shows, in the editor's pixels relative to the image. */
	const crop = $derived.by(() => {
		const x0 = Math.max(area.x, place.x);
		const y0 = Math.max(area.y, place.y);
		const x1 = Math.min(area.x + area.w, place.x + place.w);
		const y1 = Math.min(area.y + area.h, place.y + place.h);
		const k = shown.w / place.w;
		return { x: (x0 - place.x) * k, y: (y0 - place.y) * k, w: Math.max(0, x1 - x0) * k, h: Math.max(0, y1 - y0) * k };
	});

	$effect(() => {
		const c = canvas;
		const src = image.thumb;
		if (!c || !src) return;
		const edits = $state.snapshot(image.edits);
		const dpr = window.devicePixelRatio || 1;
		c.width = Math.max(1, Math.round(shown.w * dpr));
		c.height = Math.max(1, Math.round(shown.h * dpr));
		const ctx = c.getContext('2d');
		if (!ctx) return;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(editedPreview(src, edits), 0, 0, c.width, c.height);
	});

	const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const EASE = 'cubic-bezier(.2, .8, .2, 1)';

	/** The keyframe that puts just the cropped part of the image exactly over its cell. */
	function inCell(): Keyframe | null {
		const from = cellRect();
		if (!from || !root || !crop.w || !crop.h) return null;
		const box = root.getBoundingClientRect();
		const k = from.width / crop.w;
		const tx = from.left - box.left - shown.x - crop.x * k;
		const ty = from.top - box.top - shown.y - crop.y * k;
		const inset = `inset(${crop.y}px ${shown.w - crop.x - crop.w}px ${shown.h - crop.y - crop.h}px ${crop.x}px)`;
		return { transform: `translate(${tx}px, ${ty}px) scale(${k})`, clipPath: inset };
	}
	const open: Keyframe = { transform: 'translate(0, 0) scale(1)', clipPath: 'inset(0px 0px 0px 0px)' };

	onMount(async () => {
		await tick();
		const start = inCell();
		if (frame && start && !reduced()) {
			root?.animate([{ backgroundColor: 'transparent' }, {}], { duration: 320, easing: EASE });
			await frame.animate([start, open], { duration: 380, easing: EASE }).finished.catch(() => {});
		}
		ready = true;
	});

	let closing = false;
	export async function close() {
		if (closing) return;
		closing = true;
		ready = false;
		const end = inCell();
		if (frame && end && !reduced()) {
			root?.animate([{}, { backgroundColor: 'transparent' }], { duration: 300, easing: EASE, fill: 'forwards' });
			await frame.animate([open, end], { duration: 320, easing: EASE, fill: 'forwards' }).finished.catch(() => {});
		}
		onclose();
	}

	function dragCrop(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		let last = { x: e.clientX, y: e.clientY };
		const move = (ev: PointerEvent) => {
			// Moving the crop one way moves the image the other way in its cell.
			const k = place.w / shown.w;
			onedit({ kind: 'pan', dx: -(ev.clientX - last.x) * k, dy: -(ev.clientY - last.y) * k });
			last = { x: ev.clientX, y: ev.clientY };
		};
		const up = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	}

	function onWheel(e: WheelEvent) {
		if (!frame || e.ctrlKey || e.metaKey) return;
		e.preventDefault();
		// Zoom around the image point under the pointer, given as a spot in the cell.
		const r = frame.getBoundingClientRect();
		const fx = (e.clientX - r.left) / r.width;
		const fy = (e.clientY - r.top) / r.height;
		const at = { u: (place.x + fx * place.w - area.x) / area.w, v: (place.y + fy * place.h - area.y) / area.h };
		onedit({ kind: 'zoom', factor: Math.exp(-e.deltaY * 0.002), at });
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={root}
	bind:clientWidth={W}
	bind:clientHeight={H}
	class="bg-accent absolute inset-0 z-20 overflow-hidden"
	data-testid="frame-editor"
	onwheel={onWheel}
>
	<div class="absolute inset-x-0 top-0 flex h-12 items-center justify-between border-b px-4 transition-opacity duration-200" class:opacity-0={!ready}>
		<span class="truncate text-sm font-medium">{image.name}</span>
		<Button size="sm" onclick={close} data-testid="frame-editor-done">Done</Button>
	</div>
	<div
		bind:this={frame}
		class="absolute origin-top-left overflow-hidden"
		style:left="{shown.x}px"
		style:top="{shown.y}px"
		style:width="{shown.w}px"
		style:height="{shown.h}px"
	>
		<canvas bind:this={canvas} class="block size-full"></canvas>
		<!-- The cell's crop: everything outside it is dimmed. -->
		<div
			class="absolute cursor-move border border-white transition-opacity duration-200"
			class:opacity-0={!ready}
			style:left="{crop.x}px"
			style:top="{crop.y}px"
			style:width="{crop.w}px"
			style:height="{crop.h}px"
			style:box-shadow="0 0 0 9999px rgb(0 0 0 / 0.45)"
			onpointerdown={dragCrop}
			title="Drag to move the image in its cell. Scroll to zoom."
			data-testid="frame-crop"
		></div>
	</div>
</div>
