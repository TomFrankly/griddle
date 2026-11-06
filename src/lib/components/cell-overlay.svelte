<!--
  Sits over one grid cell in the preview: drag to move the image inside its cell, scroll or use
  the slider to zoom, and reset to the default size and position. Dropping image files on it
  replaces the image. Hover controls also set how many cells the image spans and edit its caption.
  On small cells the controls fold into one button that drags to move and opens a menu with
  everything; right-clicking any cell opens the same menu.
-->
<script lang="ts">
	import { Slider } from '$lib/components/ui/slider/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import TypeIcon from '@lucide/svelte/icons/type';
	import GripIcon from '@lucide/svelte/icons/grip';
	import ImageUpIcon from '@lucide/svelte/icons/image-up';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import Stepper from './stepper.svelte';
	import RichText from './rich-text.svelte';
	import { minZoom, placeImage, ZOOM_MAX, type Rect } from '$lib/grid';
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
		onremove,
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
		onremove?: () => void;
	} = $props();

	let spanOpen = $state(false);
	let textOpen = $state(false);
	let allOpen = $state(false);
	const menuOpen = $derived(spanOpen || textOpen || allOpen);
	/** Below this size the hover controls don't fit, so they fold into one button. */
	const compact = $derived(rect.w < 190 || rect.h < 130);
	let anchor = $state({ x: 0, y: 0 });
	const virtualAnchor = { getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0) };
	let fileInput = $state<HTMLInputElement>();
	const hasCaptions = $derived(!!captions?.on && (captions.title.on || captions.desc.on));

	function openAll(x: number, y: number) {
		anchor = { x, y };
		allOpen = true;
	}
	function onContextMenu(e: MouseEvent) {
		e.preventDefault();
		openAll(e.clientX, e.clientY);
	}
	/** Drag the folded button to move the image; a click without moving opens the menu. */
	function onGripDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		const start = { x: e.clientX, y: e.clientY };
		const btn = e.currentTarget as HTMLElement;
		let moved = false;
		const move = (ev: PointerEvent) => {
			if (moved || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
			moved = true;
			done();
			onreorder?.(ev);
		};
		const up = () => {
			done();
			if (!moved) {
				const r = btn.getBoundingClientRect();
				openAll(r.left, r.bottom + 4);
			}
		};
		const done = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}
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
	const zoomMin = $derived(Math.floor(minZoom(image.width, image.height, rect, fit) * 100) / 100);
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
		// With Ctrl or Cmd held, scrolling zooms the whole view instead.
		if (e.ctrlKey || e.metaKey) return;
		e.preventDefault();
		const z = image.adjust.zoom * Math.exp(-e.deltaY * 0.002);
		image.adjust.zoom = Math.min(ZOOM_MAX, Math.max(zoomMin, z));
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
	oncontextmenu={onContextMenu}
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
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={(e) => {
			if (e.currentTarget.files?.length) onfiles?.(e.currentTarget.files);
			e.currentTarget.value = '';
		}}
	/>
	<Popover.Root bind:open={allOpen}>
		<Popover.Content class="w-64 gap-0 p-0" customAnchor={virtualAnchor} align="start" data-testid="cell-menu">
			<div class="space-y-3 p-3">
				<div class="flex items-center justify-between">
					<span class="text-sm">Across</span>
					<Stepper bind:value={image.span.w} min={1} max={Math.max(1, cols)} label="Cells across" />
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm">Down</span>
					<Stepper bind:value={image.span.h} min={1} max={Math.max(1, rows)} label="Cells down" />
				</div>
				<div class="space-y-2">
					<div class="flex items-center justify-between text-sm">
						<span>Zoom</span>
						<button type="button" class="text-muted-foreground hover:text-foreground text-xs disabled:opacity-40" disabled={!adjusted} onclick={reset}>Reset</button>
					</div>
					<Slider type="single" min={zoomMin} max={ZOOM_MAX} step={0.01} bind:value={image.adjust.zoom} aria-label="Zoom image {index + 1}" />
				</div>
				{#if hasCaptions && captions}
					{#if captions.title.on}
						<RichText bind:value={image.title} label="Title for image {index + 1}" placeholder="Title" testid="menu-title" />
					{/if}
					{#if captions.desc.on}
						<RichText bind:value={image.desc} label="Description for image {index + 1}" placeholder="Description" testid="menu-desc" />
					{/if}
				{/if}
			</div>
			<div class="border-t p-1">
				<button type="button" class="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm" onclick={() => fileInput?.click()}>
					<ImageUpIcon class="size-4" /> Replace image
				</button>
				{#if onremove}
					<button
						type="button"
						class="hover:bg-accent text-destructive flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
						onclick={() => {
							allOpen = false;
							onremove();
						}}
						data-testid="cell-remove"
					>
						<Trash2Icon class="size-4" /> Remove
					</button>
				{/if}
			</div>
		</Popover.Content>
	</Popover.Root>
	{#if compact && rect.w >= 30 && rect.h >= 30}
		<button
			type="button"
			class="{pill} absolute top-1 left-1 size-7 cursor-grab opacity-0 transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100 active:cursor-grabbing"
			class:opacity-100={menuOpen}
			aria-label="Options for image {index + 1}"
			title="Drag to move, click for options"
			data-testid="cell-more"
			data-cell-control
			onpointerdown={onGripDown}
			onkeydown={(e) => {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				e.preventDefault();
				const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
				openAll(r.left, r.bottom + 4);
			}}
		>
			<GripIcon class="size-3.5" />
		</button>
	{:else if !compact}
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
				min={zoomMin}
				max={ZOOM_MAX}
				step={0.01}
				bind:value={image.adjust.zoom}
				aria-label="Zoom image {index + 1}"
				data-testid="cell-zoom"
			/>
		</div>
	{/if}
</div>
