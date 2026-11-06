<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { exampleFiles } from '$lib/examples';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { ModeWatcher, setMode, userPrefersMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import InfoTip from '$lib/components/info-tip.svelte';
	import Stepper from '$lib/components/stepper.svelte';
	import ColorPicker from '$lib/components/color-picker.svelte';
	import CellOverlay from '$lib/components/cell-overlay.svelte';
	import ToggleSection from '$lib/components/toggle-section.svelte';
	import SliderField from '$lib/components/slider-field.svelte';
	import ColorField from '$lib/components/color-field.svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
	import ImageUpIcon from '@lucide/svelte/icons/image-up';
	import ShuffleIcon from '@lucide/svelte/icons/shuffle';
	import ArrowDownAZIcon from '@lucide/svelte/icons/arrow-down-a-z';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import WandIcon from '@lucide/svelte/icons/wand-sparkles';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { computeLayout } from '$lib/grid';
	import {
		canvasToBlob,
		decode,
		downscale,
		drawGrid,
		loadImage,
		renderFull,
		DEFAULT_STYLE,
		type Background,
		type CellStyle,
		type ExportFormat,
		type FitMode,
		type GridImage
	} from '$lib/render';
	import { PAINT_PRESETS, type PaintGroup } from '$lib/paint/presets';
	import { paintThumb } from '$lib/paint/paint-gl';

	const ASPECTS = [
		{ value: '1:1', label: 'Square', ratio: 1 },
		{ value: '4:3', label: '4:3', ratio: 4 / 3 },
		{ value: '3:4', label: '3:4', ratio: 3 / 4 },
		{ value: '3:2', label: '3:2', ratio: 3 / 2 },
		{ value: '2:3', label: '2:3', ratio: 2 / 3 },
		{ value: '16:9', label: '16:9', ratio: 16 / 9 },
		{ value: '9:16', label: '9:16', ratio: 9 / 16 },
		{ value: '5:4', label: '5:4', ratio: 5 / 4 },
		{ value: '4:5', label: '4:5', ratio: 4 / 5 },
		{ value: '21:9', label: '21:9', ratio: 21 / 9 }
	];

	const SIZES = [
		{ value: '1080', label: '1080 px' },
		{ value: '1600', label: '1600 px' },
		{ value: '1920', label: '1920 px' },
		{ value: '2560', label: '2560 px' },
		{ value: '3840', label: '3840 px (4K)' },
		{ value: '5120', label: '5120 px (5K)' },
		{ value: 'custom', label: 'Custom' }
	];

	const GROUPS: PaintGroup[] = ['Solid', 'Gradients', 'Patterns'];

	let images = $state<GridImage[]>([]);
	let cols = $state(3);
	let rows = $state(3);
	let aspect = $state('1:1');
	let fit = $state<FitMode>('fill');
	let gap = $state(8);
	let padding = $state(8);
	let bgId = $state('white');
	let customColor = $state('#f4f1ea');
	let bgImage = $state<{ bitmap: ImageBitmap; url: string; name: string } | null>(null);
	let style = $state<CellStyle>(structuredClone(DEFAULT_STYLE));
	let size = $state('1920');
	let customSize = $state(3000);

	let loading = $state(0);
	let busy = $state(false);
	let dragDepth = $state(0);
	let fileInput: HTMLInputElement;
	let bgInput: HTMLInputElement;
	let canvas = $state<HTMLCanvasElement>();
	let stageW = $state(0);
	let stageH = $state(0);

	const ratio = $derived(ASPECTS.find((a) => a.value === aspect)?.ratio ?? 1);
	const longEdge = $derived(size === 'custom' ? customSize : Number(size));
	const spaceMax = $derived(Math.max(40, Math.round(longEdge / 10)));
	const background = $derived.by((): Background => {
		if (bgId === 'none') return { kind: 'none' };
		if (bgId === 'white') return { kind: 'color', color: '#ffffff' };
		if (bgId === 'black') return { kind: 'color', color: '#000000' };
		if (bgId === 'custom') return { kind: 'color', color: customColor };
		if (bgId === 'image' && bgImage) return { kind: 'image', image: bgImage.bitmap };
		const preset = PAINT_PRESETS.find((p) => `paint:${p.id}` === bgId);
		if (preset) return { kind: 'paint', id: preset.id, paint: preset.paint };
		return { kind: 'color', color: '#ffffff' };
	});
	const layout = $derived(
		computeLayout({ count: Math.max(images.length, 1), cols, rows, aspect: ratio, longEdge, gutter: gap, padding })
	);
	const capacity = $derived(cols * rows);
	const unused = $derived(Math.max(0, images.length - capacity));

	const preview = $derived.by(() => {
		const pad = stageW < 640 ? 12 : 32;
		const availW = Math.max(50, stageW - pad * 2);
		const availH = Math.max(50, stageH - pad * 2);
		const k = Math.min(1, availW / layout.width, availH / layout.height);
		return { w: Math.max(1, Math.floor(layout.width * k)), h: Math.max(1, Math.floor(layout.height * k)), k };
	});
	const k = $derived(preview.w / layout.width);
	const displayCells = $derived(
		layout.cells.map((c) => ({ x: c.x * k, y: c.y * k, w: c.w * k, h: c.h * k }))
	);

	$effect(() => {
		if (!canvas || images.length === 0) return;
		const dpr = window.devicePixelRatio || 1;
		const w = Math.round(preview.w * dpr);
		const h = Math.round(preview.h * dpr);
		if (canvas.width !== w) canvas.width = w;
		if (canvas.height !== h) canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const imgs = images;
		drawGrid(
			ctx,
			layout,
			(i) => {
				const img = imgs[i];
				if (!img) return null;
				// Read each field so changes to it redraw the preview.
				const adjust = { zoom: img.adjust.zoom, ox: img.adjust.ox, oy: img.adjust.oy };
				return { source: img.thumb, width: img.width, height: img.height, adjust };
			},
			{ background, fit, style, scale: w / layout.width }
		);
	});

	let showingExamples = $state(false);

	async function addFiles(list: FileList | File[] | null | undefined, examples = false) {
		const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
		if (!files.length) return;
		// The first real upload replaces the example grid.
		if (!examples && showingExamples) {
			clearAll();
			showingExamples = false;
		}
		loading += files.length;
		const results = await Promise.allSettled(files.map(loadImage));
		loading -= files.length;
		const ok: GridImage[] = [];
		let failed = 0;
		for (const r of results) {
			if (r.status === 'fulfilled') ok.push(r.value);
			else failed++;
		}
		images = [...images, ...ok];
		if (examples) showingExamples = ok.length > 0;
		if (failed) toast.error(`${failed} file${failed > 1 ? 's' : ''} couldn't be read`);
	}

	async function setBackgroundImage(file: File | undefined) {
		if (!file || !file.type.startsWith('image/')) return;
		try {
			const bitmap = await downscale(await decode(file), 8192);
			if (bgImage) {
				bgImage.bitmap.close();
				URL.revokeObjectURL(bgImage.url);
			}
			bgImage = { bitmap, url: URL.createObjectURL(file), name: file.name };
			bgId = 'image';
		} catch {
			toast.error("That background image couldn't be read");
		}
	}

	function release(img: GridImage) {
		img.thumb.close();
		URL.revokeObjectURL(img.thumbUrl);
	}
	function remove(id: string) {
		const img = images.find((i) => i.id === id);
		if (img) release(img);
		images = images.filter((i) => i.id !== id);
	}
	function clearAll() {
		images.forEach(release);
		images = [];
		showingExamples = false;
	}
	function shuffle() {
		const next = [...images];
		for (let i = next.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[next[i], next[j]] = [next[j], next[i]];
		}
		images = next;
	}
	function sortByName() {
		images = [...images].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
	}
	function resetAll() {
		for (const img of images) img.adjust = { zoom: 1, ox: 0, oy: 0 };
	}
	function fitRows() {
		rows = Math.max(1, Math.ceil(images.length / cols));
	}

	const fileName = (ext: string) => `griddle-${layout.cols}x${layout.rows}-${layout.width}x${layout.height}.${ext}`;

	async function download(format: ExportFormat) {
		if (!images.length || busy) return;
		busy = true;
		try {
			const full = await renderFull(layout, images, { background, fit, style: $state.snapshot(style), opaque: format === 'jpeg' });
			const blob = await canvasToBlob(full, format);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName(format === 'jpeg' ? 'jpg' : 'png');
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Export failed');
		} finally {
			busy = false;
		}
	}

	async function copy() {
		if (!images.length || busy) return;
		if (!('ClipboardItem' in window) || !navigator.clipboard?.write) {
			toast.error("This browser can't copy images. Download instead.");
			return;
		}
		busy = true;
		try {
			// Hand the clipboard a promise so Safari keeps the click's permission while we render.
			const blob = renderFull(layout, images, { background, fit, style: $state.snapshot(style) }).then((c) => canvasToBlob(c, 'png'));
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			toast.success('Copied to clipboard');
		} catch (e) {
			toast.error(e instanceof Error && e.message ? e.message : "Couldn't copy the image");
		} finally {
			busy = false;
		}
	}

	// Reordering thumbnails
	let dragId = $state<string | null>(null);
	let overId = $state<string | null>(null);
	function onThumbDrop(targetId: string) {
		if (!dragId || dragId === targetId) return;
		const from = images.findIndex((i) => i.id === dragId);
		const to = images.findIndex((i) => i.id === targetId);
		const next = [...images];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		images = next;
	}

	// Window-level file drop
	const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
	function onDragEnter(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		dragDepth++;
	}
	function onDragLeave(e: DragEvent) {
		if (hasFiles(e)) dragDepth = Math.max(0, dragDepth - 1);
	}
	function onDragOver(e: DragEvent) {
		if (hasFiles(e)) e.preventDefault();
	}
	function onDrop(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		dragDepth = 0;
		addFiles(e.dataTransfer?.files);
	}
	function onPaste(e: ClipboardEvent) {
		const files = Array.from(e.clipboardData?.files ?? []);
		if (files.length) addFiles(files);
	}

	onDestroy(() => images.forEach(release));

	onMount(async () => {
		if (!images.length) addFiles(await exampleFiles(), true);
	});

	const labelOf = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
	const thumbFor = (id: string) => {
		const p = PAINT_PRESETS.find((x) => x.id === id);
		return p ? paintThumb(p.paint, 64, 64) : '';
	};
</script>

<svelte:window ondragenter={onDragEnter} ondragleave={onDragLeave} ondragover={onDragOver} ondrop={onDrop} onpaste={onPaste} />

<ModeWatcher />
<Toaster position="bottom-center" />

{#snippet swatch(id: string, name: string, style: string, extra?: string)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					type="button"
					class="swatch {extra ?? ''}"
					class:selected={bgId === id}
					{style}
					aria-label={name}
					aria-pressed={bgId === id}
					data-testid="bg-{id}"
					onclick={() => (bgId = id)}
				></button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{name}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

{#snippet iconAction(label: string, Icon: typeof CopyIcon, fn: () => void, disabled = false)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon-sm" aria-label={label} {disabled} onclick={fn}>
					<Icon />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{label}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<Tooltip.Provider delayDuration={300}>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		multiple
		class="hidden"
		data-testid="file-input"
		onchange={(e) => {
			addFiles(e.currentTarget.files);
			e.currentTarget.value = '';
		}}
	/>
	<input
		bind:this={bgInput}
		type="file"
		accept="image/*"
		class="hidden"
		data-testid="bg-input"
		onchange={(e) => {
			setBackgroundImage(e.currentTarget.files?.[0]);
			e.currentTarget.value = '';
		}}
	/>

	<div class="flex min-h-dvh flex-col md:h-dvh">
		<header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
			<div class="flex items-center gap-2">
				<svg viewBox="0 0 16 16" class="size-4" aria-hidden="true">
					<rect x="1" y="1" width="6" height="6" fill="currentColor" />
					<rect x="9" y="1" width="6" height="6" fill="currentColor" />
					<rect x="1" y="9" width="6" height="6" fill="currentColor" />
					<rect x="9" y="9" width="6" height="6" fill="currentColor" opacity=".35" />
				</svg>
				<span class="font-logo text-[22px] leading-none italic">Griddle</span>
			</div>
			<div class="ml-auto flex items-center gap-1.5">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon-sm" aria-label="Theme" data-testid="theme">
								<SunIcon class="dark:hidden" />
								<MoonIcon class="hidden dark:block" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-36">
						<DropdownMenu.RadioGroup
							value={userPrefersMode.current}
							onValueChange={(v) => setMode(v as 'light' | 'dark' | 'system')}
						>
							<DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
							<DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
							<DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
						</DropdownMenu.RadioGroup>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
				<Button variant="ghost" size="sm" onclick={() => fileInput.click()}>
					<ImagePlusIcon />
					<span class="hidden sm:inline">Add images</span>
				</Button>
				<Button variant="outline" size="sm" onclick={copy} disabled={!images.length || busy} data-testid="copy">
					<CopyIcon />
					<span class="hidden sm:inline">Copy</span>
				</Button>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger disabled={!images.length || busy}>
						{#snippet child({ props })}
							<Button {...props} size="sm" data-testid="download">
								{#if busy}<LoaderIcon class="animate-spin" />{:else}<DownloadIcon />{/if}
								Download
								<ChevronDownIcon class="opacity-70" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-40">
						<DropdownMenu.Item onclick={() => download('png')} data-testid="download-png">PNG</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => download('jpeg')} data-testid="download-jpg">JPG</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</header>

		<div class="flex flex-col-reverse md:min-h-0 md:flex-1 md:flex-row">
			<aside class="shrink-0 border-t md:w-80 md:overflow-y-auto md:border-t-0 md:border-r">
				<section class="space-y-3 border-b p-4">
					<h2 class="text-muted-foreground text-xs font-medium">Grid</h2>
					<div class="flex items-center justify-between">
						<span class="text-sm">Columns</span>
						<Stepper bind:value={cols} label="Columns" />
					</div>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-sm">
							Rows
							<InfoTip text="Rows without images are left out. A partly filled last row is centered." />
						</span>
						<div class="flex items-center gap-1">
							{@render iconAction('Fit rows to images', WandIcon, fitRows, !images.length)}
							<Stepper bind:value={rows} label="Rows" />
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm">Cell shape</span>
						<Select.Root type="single" bind:value={aspect}>
							<Select.Trigger size="sm" class="w-32" data-testid="aspect">{labelOf(ASPECTS, aspect)}</Select.Trigger>
							<Select.Content>
								{#each ASPECTS as a (a.value)}
									<Select.Item value={a.value} label={a.label}>{a.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-sm">
							Images
							<InfoTip text="Fill crops each image to its cell. Fit shows the whole image. Drag an image in the preview to move it, and hover for zoom." />
						</span>
						<ToggleGroup.Root
							type="single"
							variant="outline"
							size="sm"
							value={fit}
							onValueChange={(v) => v && (fit = v as FitMode)}
						>
							<ToggleGroup.Item value="fill" class="px-3">Fill</ToggleGroup.Item>
							<ToggleGroup.Item value="fit" class="px-3">Fit</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>
				</section>

				<section class="space-y-4 border-b p-4">
					<h2 class="text-muted-foreground text-xs font-medium">Spacing</h2>
					<div class="space-y-2.5">
						<div class="flex items-center justify-between">
							<span class="text-sm">Gap</span>
							<span class="text-muted-foreground text-sm tabular-nums">{gap} px</span>
						</div>
						<Slider type="single" bind:value={gap} min={0} max={spaceMax} step={1} aria-label="Gap" />
					</div>
					<div class="space-y-2.5">
						<div class="flex items-center justify-between">
							<span class="text-sm">Edge padding</span>
							<span class="text-muted-foreground text-sm tabular-nums">{padding} px</span>
						</div>
						<Slider type="single" bind:value={padding} min={0} max={spaceMax * 2} step={1} aria-label="Edge padding" />
					</div>
				</section>

				<ToggleSection title="Rounded corners" bind:on={style.corners.on}>
					<SliderField label="Radius" bind:value={style.corners.radius} unit="%" />
				</ToggleSection>
				<ToggleSection title="Border" bind:on={style.border.on}>
					<SliderField label="Width" bind:value={style.border.width} min={1} max={Math.max(20, Math.round(longEdge / 40))} />
					<ColorField label="Color" bind:value={style.border.color} />
					<SliderField label="Opacity" bind:value={style.border.opacity} unit="%" />
				</ToggleSection>
				<ToggleSection title="Drop shadow" bind:on={style.shadow.on}>
					<SliderField label="Strength" bind:value={style.shadow.strength} unit="%" />
					<SliderField label="Distance" bind:value={style.shadow.distance} max={spaceMax} />
					<SliderField label="Softness" bind:value={style.shadow.softness} max={spaceMax * 2} />
				</ToggleSection>
				<ToggleSection title="Divider lines" bind:on={style.lines.on}>
					<SliderField label="Thickness" bind:value={style.lines.width} min={1} max={Math.max(20, Math.round(longEdge / 60))} />
					<ColorField label="Color" bind:value={style.lines.color} />
					<SliderField label="Opacity" bind:value={style.lines.opacity} unit="%" />
				</ToggleSection>

				<section class="space-y-3 border-b p-4">
					<h2 class="text-muted-foreground text-xs font-medium">Background</h2>
					<div class="swatches">
						{@render swatch('none', 'Transparent', '', 'checker')}
						{@render swatch('white', 'White', 'background:#fff')}
						{@render swatch('black', 'Black', 'background:#000')}
						<ColorPicker
							value={customColor}
							label="Custom color"
							onpick={(hex) => {
								customColor = hex;
								bgId = 'custom';
							}}
						>
							{#snippet trigger(props)}
								<button
									{...props}
									type="button"
									class="swatch spectrum"
									class:selected={bgId === 'custom'}
									aria-label="Custom color"
									title="Custom color"
									data-testid="bg-custom"
									onclick={(e) => {
										(props.onclick as ((ev: MouseEvent) => void) | undefined)?.(e);
										bgId = 'custom';
									}}
								>
									<span style:background={customColor}></span>
								</button>
							{/snippet}
						</ColorPicker>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<button
										{...props}
										type="button"
										class="swatch grid place-items-center"
										class:selected={bgId === 'image'}
										style={bgImage ? `background:center/cover url(${bgImage.url})` : ''}
										aria-label={bgImage ? `Background image: ${bgImage.name}` : 'Upload a background image'}
										data-testid="bg-image"
										onclick={() => (bgImage && bgId !== 'image' ? (bgId = 'image') : bgInput.click())}
										ondragover={(e) => e.preventDefault()}
										ondrop={(e) => {
											e.preventDefault();
											e.stopPropagation();
											dragDepth = 0;
											setBackgroundImage(e.dataTransfer?.files?.[0]);
										}}
									>
										{#if !bgImage}<ImageUpIcon class="text-muted-foreground size-4" />{/if}
									</button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content>
								{bgImage ? (bgId === 'image' ? 'Replace background image' : 'Background image') : 'Upload or drop a background image'}
							</Tooltip.Content>
						</Tooltip.Root>
					</div>
					{#each GROUPS as group (group)}
						<div class="space-y-1.5">
							<div class="text-muted-foreground text-[11px]">{group}</div>
							<div class="swatches">
								{#each PAINT_PRESETS.filter((p) => p.group === group) as p (p.id)}
									{@render swatch(`paint:${p.id}`, p.name, `background:center/cover url(${thumbFor(p.id)})`)}
								{/each}
							</div>
						</div>
					{/each}
				</section>

				<section class="space-y-3 p-4">
					<h2 class="text-muted-foreground text-xs font-medium">Output</h2>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-sm">
							Size
							<InfoTip text="Length of the longer side. The other side follows from the grid and cell shape." />
						</span>
						<Select.Root type="single" bind:value={size}>
							<Select.Trigger size="sm" class="w-32" data-testid="size">{labelOf(SIZES, size)}</Select.Trigger>
							<Select.Content>
								{#each SIZES as s (s.value)}
									<Select.Item value={s.value} label={s.label}>{s.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					{#if size === 'custom'}
						<div class="space-y-2.5">
							<div class="flex items-center justify-between">
								<span class="text-sm">Long edge</span>
								<span class="text-muted-foreground text-sm tabular-nums">{customSize} px</span>
							</div>
							<Slider type="single" bind:value={customSize} min={480} max={8000} step={20} aria-label="Long edge" />
						</div>
					{/if}
					<div class="text-muted-foreground flex items-center justify-between pt-1 text-sm tabular-nums" data-testid="dims">
						<span>{layout.width} × {layout.height} px</span>
						<span>{Math.min(images.length, capacity)} / {capacity}</span>
					</div>
				</section>
			</aside>

			<main class="flex min-w-0 flex-col md:min-h-0 md:flex-1">
				<div
					bind:clientWidth={stageW}
					bind:clientHeight={stageH}
					class="bg-muted/40 relative flex h-[62svh] items-center justify-center overflow-hidden md:h-auto md:min-h-72 md:flex-1"
				>
					{#if images.length}
						<div class="relative shadow-sm" style="width:{preview.w}px;height:{preview.h}px">
							<canvas bind:this={canvas} class="checker absolute inset-0 size-full" data-testid="preview"></canvas>
							{#each displayCells as rect, i (images[i]?.id ?? i)}
								{#if images[i]}
									<CellOverlay
										{rect}
										image={images[i]}
										{fit}
										index={i}
										radius={style.corners.on ? (style.corners.radius / 100) * (Math.min(rect.w, rect.h) / 2) : 0}
									/>
								{/if}
							{/each}
						</div>
					{:else}
						<button
							type="button"
							class="hover:bg-background/60 flex flex-col items-center gap-3 border px-16 py-14 text-center transition-colors"
							onclick={() => fileInput.click()}
						>
							<ImagePlusIcon class="text-muted-foreground size-6" />
							<span class="text-sm font-medium">Drop images here</span>
							<span class="text-muted-foreground text-xs">or click to choose</span>
						</button>
					{/if}
					{#if loading}
						<div class="bg-background absolute top-3 right-3 flex items-center gap-2 border px-2.5 py-1 text-xs">
							<LoaderIcon class="size-3.5 animate-spin" /> Loading {loading}
						</div>
					{/if}
					{#if dragDepth > 0}
						<div class="bg-background/80 border-primary pointer-events-none absolute inset-2 flex items-center justify-center border-2">
							<span class="text-sm font-medium">Drop to add</span>
						</div>
					{/if}
				</div>

				{#if images.length}
					<div class="shrink-0 border-t">
						<div class="flex h-9 items-center gap-1 border-b px-3">
							<span class="text-muted-foreground text-xs tabular-nums">
								{#if showingExamples}Example images ·
									<button type="button" class="text-foreground underline-offset-2 hover:underline" onclick={() => fileInput.click()}>Add your own</button>
								{:else}{images.length} image{images.length === 1 ? '' : 's'}{/if}{#if unused && !showingExamples}<span> · {unused} not used</span>{/if}
							</span>
							<div class="ml-auto flex items-center">
								{@render iconAction('Reset all crops', RotateCcwIcon, resetAll)}
								{@render iconAction('Sort by name', ArrowDownAZIcon, sortByName)}
								{@render iconAction('Shuffle', ShuffleIcon, shuffle)}
								{@render iconAction('Remove all', Trash2Icon, clearAll)}
							</div>
						</div>
						<ol class="flex gap-2 overflow-x-auto p-3" data-testid="thumbs">
							{#each images as img, i (img.id)}
								<li
									class="group relative size-16 shrink-0 cursor-grab border transition-opacity active:cursor-grabbing"
									class:opacity-35={i >= capacity}
									class:border-primary={overId === img.id && dragId !== img.id}
									draggable="true"
									title={img.name}
									ondragstart={(e) => {
										dragId = img.id;
										e.dataTransfer?.setData('text/plain', img.id);
										if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
									}}
									ondragover={(e) => {
										if (!dragId) return;
										e.preventDefault();
										overId = img.id;
									}}
									ondragleave={() => overId === img.id && (overId = null)}
									ondrop={(e) => {
										if (!dragId) return;
										e.preventDefault();
										e.stopPropagation();
										onThumbDrop(img.id);
										dragId = overId = null;
									}}
									ondragend={() => (dragId = overId = null)}
								>
									<img src={img.thumbUrl} alt={img.name} class="size-full object-cover" draggable="false" />
									<span class="bg-background/90 absolute bottom-0 left-0 px-1 text-[10px] tabular-nums">{i + 1}</span>
									<button
										type="button"
										class="bg-background/90 absolute top-0 right-0 hidden size-5 items-center justify-center group-hover:flex focus-visible:flex"
										aria-label="Remove {img.name}"
										onclick={() => remove(img.id)}
									>
										<XIcon class="size-3" />
									</button>
								</li>
							{/each}
						</ol>
					</div>
				{/if}
			</main>
		</div>
	</div>
</Tooltip.Provider>

<style>
	:global(.checker) {
		background-color: #fff;
		background-image:
			linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
			linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
			linear-gradient(-45deg, transparent 75%, #e5e5e5 75%);
		background-size: 12px 12px;
		background-position:
			0 0,
			0 6px,
			6px -6px,
			-6px 0;
	}
	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
		gap: 6px;
	}
	:global(.swatch) {
		aspect-ratio: 1;
		width: 100%;
		border: 1px solid var(--border);
		cursor: pointer;
		outline-offset: 2px;
	}
	:global(.swatch:hover) {
		border-color: color-mix(in srgb, var(--foreground) 40%, transparent);
	}
	:global(.swatch.selected) {
		outline: 2px solid var(--foreground);
	}
	:global(.swatch:focus-visible) {
		outline: 2px solid var(--ring);
	}
	:global(.swatch.spectrum) {
		background: conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
		padding: 5px;
	}
	:global(.swatch.spectrum span) {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid rgb(255 255 255 / 70%);
	}
</style>
