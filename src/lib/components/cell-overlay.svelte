<!--
  Sits over one grid cell in the preview: drag to move the image inside its cell, scroll or use
  the slider to zoom, and reset to the default size and position. Dropping image files on it
  replaces the image. Hover controls also set how many cells the image spans and edit its caption.
-->
<script lang="ts">
	import { Slider } from '$lib/components/ui/slider/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import TypeIcon from '@lucide/svelte/icons/type';
	import GripIcon from '@lucide/svelte/icons/grip';
	import Stepper from './stepper.svelte';
	import RichText from './rich-text.svelte';
	import { placeImage, ZOOM_MAX, type Rect } from '$lib/grid';
	import type { FitMode, GridImage } from '$lib/render';
	import type { CaptionStyle } from '$lib/captions';

	let {
		rect,
		image,
		fit,
		index,
		radius = 0,
		onfiles,
		cols = 1,
		rows = 1,
		captions,
		onreorder,
		lifted = false
	}: {
		rect: Rect;
		image: GridImage;
		fit: FitMode;
		index: number;
		radius?: number;
		onfiles?: (files: FileList) => void;
		cols?: number;
		rows?: number;
		captions?: CaptionStyle;
		/** Starts moving this image to another cell. */
		onreorder?: (e: PointerEvent) => void;
		/** True while this image is being moved. */
		lifted?: boolean;
	} = $props();

	let spanOpen = $state(false);
	let textOpen = $state(false);
	const menuOpen = $derived(spanOpen || textOpen);
	const pill =
		'bg-background/70 text-foreground hover:bg-background/90 flex h-7 items-center justify-center gap-1 rounded-full shadow-sm backdrop-blur-sm';

	let dragging = $state(false);
	let fileOver = $state(0);
	const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

	function onDragEnter(e: DragEvent) {
		if (!onfiles || !hasFiles(e)) return;
		e.preventDefault();
		fileOver++;
	}
	function onDragOver(e: DragEvent) {
		if (!onfiles || !hasFiles(e)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}
	function onDragLeave(e: DragEvent) {
		if (hasFiles(e)) fileOver = Math.max(0, fileOver - 1);
	}
	function onDrop(e: DragEvent) {
		fileOver = 0;
		if (!onfiles || !hasFiles(e) || !e.dataTransfer?.files.length) return;
		e.preventDefault();
		e.stopPropagation();
		onfiles(e.dataTransfer.files);
	}
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
	data-index={index}
	onpointerdown={onPointerDown}
	onwheel={onWheel}
	onkeydown={onKey}
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	{#if lifted}
		<div class="bg-background/60 pointer-events-none absolute inset-0" style:border-radius="{radius}px"></div>
	{/if}
	{#if fileOver > 0}
		<div
			class="bg-primary/25 ring-primary pointer-events-none absolute inset-0 z-10 flex items-center justify-center ring-2 ring-inset"
			style:border-radius="{radius}px"
			data-testid="cell-drop"
		>
			<span class="bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">Replace</span>
		</div>
	{/if}
	<div
		class="pointer-events-none absolute inset-0 opacity-0 ring-1 ring-white/70 ring-inset transition-opacity group-hover/cell:opacity-100"
		style:border-radius="{radius}px"
		class:opacity-100={dragging}
	></div>
	{#if rect.w >= 72 && rect.h >= 48}
		<div
			class="absolute top-1.5 left-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100"
			class:opacity-100={menuOpen}
			data-cell-control
			role="presentation"
		>
			{#if onreorder}
				<button
					type="button"
					class="{pill} size-7 cursor-grab touch-none active:cursor-grabbing"
					aria-label="Move image {index + 1}"
					title="Drag to move"
					data-testid="cell-move"
					onpointerdown={(e) => {
						if (e.button !== 0) return;
						e.preventDefault();
						onreorder(e);
					}}
				>
					<GripIcon class="size-3.5" />
				</button>
			{/if}
			<Popover.Root bind:open={spanOpen}>
				<Popover.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							class="{pill} px-2 text-xs tabular-nums"
							aria-label="Cells image {index + 1} spans: {image.span.w} across, {image.span.h} down"
							data-testid="cell-span"
						>
							<LayoutGridIcon class="size-3.5" />
							{image.span.w}×{image.span.h}
						</button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-56 space-y-3 p-3" align="start">
					<div class="text-muted-foreground text-xs">Cells this image covers</div>
					<div class="flex items-center justify-between">
						<span class="text-sm">Across</span>
						<Stepper bind:value={image.span.w} min={1} max={Math.max(1, cols)} label="Cells across" />
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm">Down</span>
						<Stepper bind:value={image.span.h} min={1} max={Math.max(1, rows)} label="Cells down" />
					</div>
				</Popover.Content>
			</Popover.Root>
			{#if captions?.on && (captions.title.on || captions.desc.on)}
				<Popover.Root bind:open={textOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<button {...props} type="button" class="{pill} size-7" aria-label="Caption for image {index + 1}" data-testid="cell-caption">
								<TypeIcon class="size-3.5" />
							</button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="w-72 space-y-3 p-3" align="start">
						{#if captions.title.on}
							<div class="space-y-1.5">
								<div class="text-muted-foreground text-xs">Title</div>
								<RichText bind:value={image.title} label="Title for image {index + 1}" placeholder="Add a title" testid="caption-title" />
							</div>
						{/if}
						{#if captions.desc.on}
							<div class="space-y-1.5">
								<div class="text-muted-foreground text-xs">Description</div>
								<RichText bind:value={image.desc} label="Description for image {index + 1}" placeholder="Add a description" testid="caption-desc" />
							</div>
						{/if}
						<div class="text-muted-foreground text-[11px]">Select text to format it.</div>
					</Popover.Content>
				</Popover.Root>
			{/if}
		</div>
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
			class:opacity-100={menuOpen}
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
