<!--
  Sits over one grid cell in the preview: drag to move the image inside its cell, scroll or use
  the slider to zoom, and reset to the default size and position.
-->
<script lang="ts">
	import { Slider } from '$lib/components/ui/slider/index.js';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { placeImage, ZOOM_MAX, type Rect } from '$lib/grid';
	import type { FitMode, GridImage } from '$lib/render';

	let {
		rect,
		image,
		fit,
		index,
		radius = 0
	}: { rect: Rect; image: GridImage; fit: FitMode; index: number; radius?: number } = $props();

	let dragging = $state(false);
	const place = $derived(placeImage(image.width, image.height, rect, fit, image.adjust));
	const movable = $derived(place.slackX > 0.5 || place.slackY > 0.5);
	const adjusted = $derived(image.adjust.zoom !== 1 || image.adjust.ox !== 0 || image.adjust.oy !== 0);
	const clamp = (n: number) => Math.min(1, Math.max(-1, n));

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0 || !movable) return;
		// The zoom slider and reset button handle their own pointer events.
		if ((e.target as Element).closest('[data-cell-control]')) return;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		dragging = true;
		const start = { x: e.clientX, y: e.clientY, ox: image.adjust.ox, oy: image.adjust.oy };
		const { slackX, slackY } = place;
		const move = (ev: PointerEvent) => {
			if (slackX > 0.5) image.adjust.ox = clamp(start.ox - (2 * (ev.clientX - start.x)) / slackX);
			if (slackY > 0.5) image.adjust.oy = clamp(start.oy - (2 * (ev.clientY - start.y)) / slackY);
		};
		const up = () => {
			dragging = false;
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const z = image.adjust.zoom * Math.exp(-e.deltaY * 0.002);
		image.adjust.zoom = Math.min(ZOOM_MAX, Math.max(1, z));
	}

	function reset() {
		image.adjust = { zoom: 1, ox: 0, oy: 0 };
	}

	function onKey(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.2 : 0.05;
		const d: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		const m = d[e.key];
		if (!m) return;
		e.preventDefault();
		image.adjust.ox = clamp(image.adjust.ox - m[0]);
		image.adjust.oy = clamp(image.adjust.oy - m[1]);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<div
	class="group/cell absolute touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
	class:cursor-grab={movable && !dragging}
	class:cursor-grabbing={dragging}
	style:left="{rect.x}px"
	style:top="{rect.y}px"
	style:width="{rect.w}px"
	style:height="{rect.h}px"
	role="application"
	aria-roledescription="image crop"
	tabindex="0"
	aria-label="Image {index + 1}: {image.name}. Drag or use arrow keys to move it, scroll to zoom."
	data-testid="cell"
	onpointerdown={onPointerDown}
	onwheel={onWheel}
	onkeydown={onKey}
>
	<div
		class="pointer-events-none absolute inset-0 opacity-0 ring-1 ring-white/70 ring-inset transition-opacity group-hover/cell:opacity-100"
		style:border-radius="{radius}px"
		class:opacity-100={dragging}
	></div>
	{#if rect.w >= 72 && rect.h >= 48}
		<button
			type="button"
			class="bg-background/70 text-foreground hover:bg-background/90 absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100 disabled:hidden"
			aria-label="Reset image {index + 1}"
			title="Reset"
			disabled={!adjusted}
			data-testid="cell-reset"
			data-cell-control
			onclick={reset}
		>
			<RotateCcwIcon class="size-3.5" />
		</button>
		<div
			class="bg-background/70 absolute inset-x-2 bottom-2 flex h-7 items-center rounded-full px-3 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100"
			data-cell-control
			role="presentation"
		>
			<Slider
				type="single"
				min={1}
				max={ZOOM_MAX}
				step={0.01}
				bind:value={image.adjust.zoom}
				aria-label="Zoom image {index + 1}"
				data-testid="cell-zoom"
			/>
		</div>
	{/if}
</div>
