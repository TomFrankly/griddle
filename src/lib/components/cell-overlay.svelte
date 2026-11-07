<!--
  Sits over one grid cell in the preview: drag to move the image inside its cell, scroll or use
  the slider to zoom, and reset to the default size and position. Dropping image files on it
  replaces the image. Hover controls also set how many cells the image spans and edit its caption.
  On small cells the controls fold into one button that drags to move and opens a menu with
  everything; right-clicking any cell opens the same menu. An empty slot shows a placeholder
  instead: click it or drop images on it to fill it.
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
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
	import ImageOffIcon from '@lucide/svelte/icons/image-off';
	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
	import Stepper from './stepper.svelte';
	import RichText from './rich-text.svelte';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import ClipboardPasteIcon from '@lucide/svelte/icons/clipboard-paste';
	import { minZoom, ZOOM_MAX, type Rect } from '$lib/grid';
	import { applyChange, focusOf, framePlace, RESET_FRAMING, type CellChange } from '$lib/cell-edits';
	import type { FitMode, GridImage } from '$lib/render';
	import { editedSize } from '$lib/edits';
	import type { CaptionStyle } from '$lib/captions';

	let {
		rect,
		area,
		image,
		fit,
		index,
		radius = 0,
		free = false,
		onselect,
		onfiles,
		cols = 1,
		rows = 1,
		spannable = true,
		captions,
		onreorder,
		onremove,
		onclear,
		onaddslot,
		lifted = false,
		selected = false,
		onedit,
		oncopysettings,
		onpastesettings,
		onfocus,
		onopeneditor
	}: {
		rect: Rect;
		/** Where the image may sit inside the cell, when that is smaller than the cell. */
		area?: Rect;
		image: GridImage;
		fit: FitMode;
		index: number;
		radius?: number;
		/** The cell has its own background, so the image may slide off its edges. */
		free?: boolean;
		/** A plain click on the cell, not a drag. */
		onselect?: (e: MouseEvent) => void;
		/** Part of the selection: shows a ring, and edits here apply to every selected cell. */
		selected?: boolean;
		/** Handles a framing change; without it the change applies to this cell only. */
		onedit?: (change: CellChange) => void;
		oncopysettings?: () => void;
		/** Missing while nothing has been copied. */
		onpastesettings?: () => void;
		/** Alt-click sets the image's focal point: x and y from 0 to 1 across the image. */
		onfocus?: (x: number, y: number) => void;
		/** Opens this image in the frame editor. */
		onopeneditor?: () => void;
		onfiles?: (files: FileList) => void;
		cols?: number;
		rows?: number;
		/** False when the layout gives each image its own shape, so it can't span cells. */
		spannable?: boolean;
		captions?: CaptionStyle;
		/** Starts moving this image to another cell. */
		onreorder?: (e: PointerEvent) => void;
		/** True while this image is being moved. */
		lifted?: boolean;
		onremove?: () => void;
		/** Takes the image out but keeps the cell. */
		onclear?: () => void;
		/** Adds an empty slot after this cell. */
		onaddslot?: () => void;
	} = $props();

	const empty = $derived(!image.file);
	const label = $derived(empty ? 'slot' : 'image');

	let spanOpen = $state(false);
	let textOpen = $state(false);
	let allOpen = $state(false);
	const menuOpen = $derived(spanOpen || textOpen || allOpen);
	/** Below this size the hover controls don't fit, so they fold into one button. */
	const compact = $derived(rect.w < 190 || rect.h < 130);
	let root = $state<HTMLElement>();
	let fileInput = $state<HTMLInputElement>();
	const hasCaptions = $derived(!!captions?.on && (captions.title.on || captions.desc.on));

	/** The menu opens beside the cell so the image stays in view while it's edited. */
	function openAll() {
		allOpen = true;
	}
	function onContextMenu(e: MouseEvent) {
		e.preventDefault();
		openAll();
	}
	/** Drag the folded button to move the image; a click without moving opens the menu. */
	function onGripDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		const start = { x: e.clientX, y: e.clientY };
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
				openAll();
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
	const box = $derived(area ?? rect);
	const NO_PLACE = { x: 0, y: 0, w: 0, h: 0, slackX: 1, slackY: 1, limitX: 0, limitY: 0 };
	const size = $derived(editedSize(image.width, image.height, image.edits));
	const focus = $derived(focusOf(image.edits));
	const place = $derived(empty ? NO_PLACE : framePlace(size.width, size.height, box, fit, image.adjust, free, focus));
	const zoomMin = $derived(empty ? 1 : Math.floor(minZoom(size.width, size.height, box, fit) * 100) / 100);
	const movable = $derived(place.limitX > 0.001 || place.limitY > 0.001);
	const adjusted = $derived(image.adjust.zoom !== 1 || image.adjust.ox !== 0 || image.adjust.oy !== 0);
	// Hover controls are 28 px round; this keeps them inside the cell's rounded corners.
	const controlInset = $derived(Math.max(6, Math.round((Math.min(radius, Math.min(rect.w, rect.h) / 2) - 14) * (1 - Math.SQRT1_2))));
	function edit(change: CellChange) {
		if (onedit) onedit(change);
		else image.adjust = applyChange({ ...image, ...size, area: box, focus }, change, { fit, free });
	}
	const zoomBinding = {
		get: () => image.adjust.zoom,
		set: (v: number) => edit({ kind: 'set', values: { zoom: v } })
	};

	let pressAt: { x: number; y: number } | null = null;
	function onClick(e: MouseEvent) {
		const at = pressAt;
		pressAt = null;
		if ((e.target as Element).closest('[data-cell-control]')) return;
		if (at && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 4) return;
		if (e.altKey && onfocus && !empty) {
			const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
			const x = (e.clientX - r.left + rect.x - place.x) / place.w;
			const y = (e.clientY - r.top + rect.y - place.y) / place.h;
			if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onfocus(x, y);
			return;
		}
		onselect?.(e);
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button === 0) pressAt = { x: e.clientX, y: e.clientY };
		if (e.button !== 0 || !movable) return;
		// The zoom slider and reset button handle their own pointer events.
		if ((e.target as Element).closest('[data-cell-control]')) return;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		dragging = true;
		let last = { x: e.clientX, y: e.clientY };
		const move = (ev: PointerEvent) => {
			const dx = ev.clientX - last.x;
			const dy = ev.clientY - last.y;
			last = { x: ev.clientX, y: ev.clientY };
			if (dx || dy) edit({ kind: 'pan', dx, dy });
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
		if (e.ctrlKey || e.metaKey || empty) return;
		e.preventDefault();
		// Zoom around the pointer, as a share of the cell, so other selected cells zoom around the same spot.
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const at = { u: (e.clientX - r.left - (box.x - rect.x)) / box.w, v: (e.clientY - r.top - (box.y - rect.y)) / box.h };
		edit({ kind: 'zoom', factor: Math.exp(-e.deltaY * 0.002), at });
	}

	function recenter(e: MouseEvent) {
		if ((e.target as Element).closest('[data-cell-control]')) return;
		edit({ kind: 'set', values: { ox: 0, oy: 0 } });
	}

	function reset() {
		edit({ kind: 'set', values: RESET_FRAMING });
	}

	function onKey(e: KeyboardEvent) {
		if (empty) {
			if (e.key === 'Enter' && e.target === e.currentTarget) {
				e.preventDefault();
				fileInput?.click();
			}
			return;
		}
		const step = e.shiftKey ? 40 : 8;
		const d: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		const m = d[e.key];
		if (!m) return;
		e.preventDefault();
		edit({ kind: 'pan', dx: m[0], dy: m[1] });
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<div
	bind:this={root}
	class="group/cell absolute touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
	class:cursor-grab={movable && !dragging}
	class:cursor-grabbing={dragging}
	style:left="{rect.x}px"
	style:top="{rect.y}px"
	style:width="{rect.w}px"
	style:height="{rect.h}px"
	style:--ci="{controlInset}px"
	role="application"
	aria-roledescription={empty ? 'empty slot' : 'image crop'}
	tabindex="0"
	aria-label={empty
		? `Empty slot ${index + 1}. Drop images here or press Enter to choose one.`
		: `Image ${index + 1}: ${image.name}. Drag or use arrow keys to move it, double-click to center it, scroll to zoom.`}
	data-testid="cell"
	data-empty={empty || undefined}
	data-index={index}
	data-selected={selected || undefined}
	onpointerdown={onPointerDown}
	onwheel={onWheel}
	onkeydown={onKey}
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	oncontextmenu={onContextMenu}
	ondblclick={recenter}
	onclick={onClick}
>
	{#if empty}
		<button
			type="button"
			class="group/empty ring-foreground/15 hover:bg-foreground/[0.04] absolute inset-0 flex items-center justify-center ring-1 ring-inset transition-colors"
			style:border-radius="{radius}px"
			tabindex="-1"
			aria-label="Add an image to slot {index + 1}"
			data-testid="cell-empty"
			onclick={() => fileInput?.click()}
		>
			<!-- A pill like the hover controls, so it reads on any cell background. -->
			<span class="{pill} text-muted-foreground group-hover/empty:text-foreground {rect.w >= 110 && rect.h >= 60 ? 'px-3 text-xs font-medium' : 'size-7'}">
				<ImagePlusIcon class="size-3.5" />
				{#if rect.w >= 110 && rect.h >= 60}Add image{/if}
			</span>
		</button>
	{/if}
	{#if lifted}
		<div class="bg-background/60 pointer-events-none absolute inset-0" style:border-radius="{radius}px"></div>
	{/if}
	{#if fileOver > 0}
		<div
			class="bg-primary/25 ring-primary pointer-events-none absolute inset-0 z-10 flex items-center justify-center ring-2 ring-inset"
			style:border-radius="{radius}px"
			data-testid="cell-drop"
		>
			<span class="bg-primary text-primary-foreground px-2 py-0.5 text-xs font-medium">{empty ? 'Add' : 'Replace'}</span>
		</div>
	{/if}
	<div
		class="pointer-events-none absolute inset-0 opacity-0 ring-1 ring-white/70 ring-inset transition-opacity group-hover/cell:opacity-100"
		style:border-radius="{radius}px"
		class:opacity-100={dragging || allOpen}
	></div>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		multiple={empty}
		class="hidden"
		onchange={(e) => {
			if (e.currentTarget.files?.length) onfiles?.(e.currentTarget.files);
			e.currentTarget.value = '';
		}}
	/>
	<Popover.Root bind:open={allOpen}>
		<Popover.Content class="w-64 gap-0 p-0" customAnchor={root} side="right" sideOffset={8} align="start" collisionPadding={8} data-testid="cell-menu">
			<div class="space-y-3 p-3">
				{#if spannable}
					<div class="flex items-center justify-between">
						<span class="text-sm">Across</span>
						<Stepper bind:value={image.span.w} min={1} max={Math.max(1, cols)} label="Cells across" />
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm">Down</span>
						<Stepper bind:value={image.span.h} min={1} max={Math.max(1, rows)} label="Cells down" />
					</div>
				{/if}
				{#if !empty}
					<div class="space-y-2">
						<div class="flex items-center justify-between text-sm">
							<span>Zoom</span>
							<button type="button" class="text-muted-foreground hover:text-foreground text-xs disabled:opacity-40" disabled={!adjusted} onclick={reset}>Reset</button>
						</div>
						<Slider type="single" min={zoomMin} max={ZOOM_MAX} step={0.01} bind:value={zoomBinding.get, zoomBinding.set} aria-label="Zoom image {index + 1}" />
					</div>
				{/if}
				{#if hasCaptions && captions}
					{#if captions.title.on}
						<RichText bind:value={image.title} label="Title for {label} {index + 1}" placeholder="Title" testid="menu-title" />
					{/if}
					{#if captions.desc.on}
						<RichText bind:value={image.desc} label="Description for {label} {index + 1}" placeholder="Description" testid="menu-desc" />
					{/if}
				{/if}
			</div>
			<div class="border-t p-1">
				<button type="button" class="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm" onclick={() => fileInput?.click()} data-testid="cell-pick">
					{#if empty}<ImagePlusIcon class="size-4" /> Add image{:else}<ImageUpIcon class="size-4" /> Replace image{/if}
				</button>
				{#if !empty && oncopysettings}
					<button
						type="button"
						class="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
						onclick={() => {
							allOpen = false;
							oncopysettings();
						}}
						data-testid="cell-copy-settings"
					>
						<CopyIcon class="size-4" /> Copy settings
					</button>
				{/if}
				{#if !empty && onopeneditor}
					<button
						type="button"
						class="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
						onclick={() => {
							allOpen = false;
							onopeneditor();
						}}
						data-testid="cell-open-editor"
					>
						<Maximize2Icon class="size-4" /> Open in editor
					</button>
				{/if}
				{#if !empty && onpastesettings}
					<button
						type="button"
						class="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
						onclick={() => {
							allOpen = false;
							onpastesettings();
						}}
						data-testid="cell-paste-settings"
					>
						<ClipboardPasteIcon class="size-4" /> Paste settings{selected ? ' to selected' : ''}
					</button>
				{/if}
				{#if onclear && !empty}
					<button
						type="button"
						class="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
						onclick={() => {
							allOpen = false;
							onclear();
						}}
						data-testid="cell-clear"
					>
						<ImageOffIcon class="size-4" /> Empty this cell
					</button>
				{/if}
				{#if onaddslot}
					<button
						type="button"
						class="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
						onclick={() => {
							allOpen = false;
							onaddslot();
						}}
						data-testid="cell-add-slot"
					>
						<SquarePlusIcon class="size-4" /> Add empty slot after
					</button>
				{/if}
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
						<Trash2Icon class="size-4" /> {empty ? 'Remove slot' : 'Remove'}
					</button>
				{/if}
			</div>
		</Popover.Content>
	</Popover.Root>
	{#if compact && rect.w >= 30 && rect.h >= 30}
		<button
			type="button"
			class="{pill} absolute top-[var(--ci)] left-[var(--ci)] size-7 cursor-grab opacity-0 transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100 active:cursor-grabbing"
			class:opacity-100={menuOpen}
			aria-label="Options for {label} {index + 1}"
			title="Drag to move, click for options"
			data-testid="cell-more"
			data-cell-control
			onpointerdown={onGripDown}
			onkeydown={(e) => {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				e.preventDefault();
				openAll();
			}}
		>
			<GripIcon class="size-3.5" />
		</button>
	{:else if !compact}
		<div
			class="absolute top-[var(--ci)] left-[var(--ci)] flex gap-1 opacity-0 transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100"
			class:opacity-100={menuOpen}
			data-cell-control
			role="presentation"
		>
			{#if onreorder}
				<button
					type="button"
					class="{pill} size-7 cursor-grab touch-none active:cursor-grabbing"
					aria-label="Move {label} {index + 1}"
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
			{#if spannable}
				<Popover.Root bind:open={spanOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								class="{pill} px-2 text-xs tabular-nums"
								aria-label="Cells {label} {index + 1} spans: {image.span.w} across, {image.span.h} down"
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
			{/if}
			{#if captions?.on && (captions.title.on || captions.desc.on)}
				<Popover.Root bind:open={textOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<button {...props} type="button" class="{pill} size-7" aria-label="Caption for {label} {index + 1}" data-testid="cell-caption">
								<TypeIcon class="size-3.5" />
							</button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="w-72 space-y-3 p-3" align="start">
						{#if captions.title.on}
							<div class="space-y-1.5">
								<div class="text-muted-foreground text-xs">Title</div>
								<RichText bind:value={image.title} label="Title for {label} {index + 1}" placeholder="Add a title" testid="caption-title" />
							</div>
						{/if}
						{#if captions.desc.on}
							<div class="space-y-1.5">
								<div class="text-muted-foreground text-xs">Description</div>
								<RichText bind:value={image.desc} label="Description for {label} {index + 1}" placeholder="Add a description" testid="caption-desc" />
							</div>
						{/if}
						<div class="text-muted-foreground text-[11px]">Select text to format it.</div>
					</Popover.Content>
				</Popover.Root>
			{/if}
		</div>
		<button
			type="button"
			class="bg-background/70 text-foreground hover:bg-background/90 absolute top-[var(--ci)] right-[var(--ci)] flex size-7 items-center justify-center rounded-full opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100 disabled:hidden"
			aria-label="Reset image {index + 1}"
			title="Reset"
			disabled={!adjusted || empty}
			data-testid="cell-reset"
			data-cell-control
			onclick={reset}
		>
			<RotateCcwIcon class="size-3.5" />
		</button>
		{#if !empty}
		<div
			class="bg-background/70 absolute inset-x-[var(--ci)] bottom-[var(--ci)] flex h-7 items-center rounded-full px-3 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-focus-within/cell:opacity-100 group-hover/cell:opacity-100"
			class:opacity-100={menuOpen}
			data-cell-control
			role="presentation"
		>
			<Slider
				type="single"
				min={zoomMin}
				max={ZOOM_MAX}
				step={0.01}
				bind:value={zoomBinding.get, zoomBinding.set}
				aria-label="Zoom image {index + 1}"
				data-testid="cell-zoom"
			/>
		</div>
		{/if}
	{/if}
	{#if focus && !empty}
		<!-- The focal point, shown while the cell is hovered or selected. -->
		<div
			class="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.5)] transition-opacity group-hover/cell:opacity-100"
			class:opacity-100={selected}
			style:left="{place.x - rect.x + focus.x * place.w}px"
			style:top="{place.y - rect.y + focus.y * place.h}px"
			data-testid="cell-focus"
		></div>
	{/if}
	{#if selected}
		<!-- Two rings, dark then light, so the selection reads on any image. -->
		<div
			class="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_var(--primary),inset_0_0_0_4px_var(--background)]"
			style:border-radius="{radius}px"
			data-testid="cell-selected"
		></div>
	{/if}
</div>
