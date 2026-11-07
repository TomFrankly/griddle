<!--
  @component
  The Image tab: edits the selected cells together. Each setting from CELL_SETTINGS gets a slider
  that sets the same value on every selected cell, and shows Mixed while they differ.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ClipboardPasteIcon from '@lucide/svelte/icons/clipboard-paste';
	import SliderField from './slider-field.svelte';
	import { CELL_SETTINGS, RESET_SETTINGS, sharedValue, type CellChange, type CellSetting } from '$lib/cell-edits';
	import type { Adjust } from '$lib/grid';

	let {
		adjusts,
		total,
		mod,
		onedit,
		onselectall,
		onclear,
		oncopy,
		onpaste
	}: {
		/** The framing of each selected image. */
		adjusts: Adjust[];
		/** How many images could be selected. */
		total: number;
		/** The shortcut modifier, such as ⌘ or Ctrl+. */
		mod: string;
		onedit: (change: CellChange) => void;
		onselectall: () => void;
		onclear: () => void;
		oncopy: () => void;
		/** Missing while nothing has been copied. */
		onpaste?: () => void;
	} = $props();

	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
	const keys = (k: string) => (isMac ? `⌥⌘${k}` : `Ctrl+Alt+${k}`);
	const count = $derived(adjusts.length);
	const framing = CELL_SETTINGS.filter((s) => s.group === 'framing');

	function binding(s: CellSetting) {
		return {
			get: () => {
				const v = sharedValue(adjusts, s.key);
				return s.toUi(v ?? adjusts[0]?.[s.key] ?? s.initial);
			},
			set: (ui: number) => onedit({ kind: 'set', values: { [s.key]: s.fromUi(ui) } })
		};
	}
	const bindings = framing.map((s) => ({ s, b: binding(s) }));
	const changed = $derived(adjusts.some((a) => framing.some((s) => Math.abs(a[s.key] - s.initial) > 1e-6)));
	const offCenter = $derived(adjusts.some((a) => a.ox !== 0 || a.oy !== 0));
</script>

<section class="pane-section space-y-3" data-testid="image-pane">
	<div class="flex items-center justify-between gap-2">
		<h2 class="pane-title" data-testid="selection-count">
			{count ? `${count} selected` : 'Nothing selected'}
		</h2>
		<div class="flex items-center gap-1">
			{#if count}
				<Button variant="ghost" size="sm" class="h-7 px-2" onclick={onclear} data-testid="select-none">Clear</Button>
			{/if}
			{#if count < total}
				<Button variant="ghost" size="sm" class="h-7 px-2" onclick={onselectall} data-testid="select-all">Select all</Button>
			{/if}
		</div>
	</div>
	{#if !count}
		<p class="text-muted-foreground text-sm">
			Click an image to edit it here. Shift-click to add more, drag across the grid from outside it to pick several, or press {mod}A for all.
		</p>
	{/if}
</section>

{#if count}
	<section class="pane-section space-y-2">
		<div class="flex items-center justify-between">
			<h2 class="pane-title">Framing</h2>
			<div class="flex items-center gap-1">
				<Button variant="ghost" size="sm" class="h-7 px-2" disabled={!offCenter} onclick={() => onedit({ kind: 'set', values: { ox: 0, oy: 0 } })} data-testid="bulk-center">Center</Button>
				<Button variant="ghost" size="sm" class="h-7 px-2" disabled={!changed} onclick={() => onedit({ kind: 'set', values: RESET_SETTINGS })} data-testid="bulk-reset">Reset</Button>
			</div>
		</div>
		{#each bindings as { s, b } (s.key)}
			<SliderField
				label={s.label}
				bind:value={b.get, b.set}
				min={s.uiMin}
				max={s.uiMax}
				step={s.uiStep}
				unit={s.unit}
				mixed={count > 1 && sharedValue(adjusts, s.key) === null}
			/>
		{/each}
	</section>

	<section class="pane-section space-y-2">
		<h2 class="pane-title">Copy and paste</h2>
		<p class="text-muted-foreground text-sm">Copy one image's settings and paste them onto the selection.</p>
		<div class="grid grid-cols-2 gap-2">
			<Button variant="outline" size="sm" onclick={oncopy} data-testid="copy-settings" title="Copy settings ({keys('C')})">
				<CopyIcon /> Copy
			</Button>
			<Button variant="outline" size="sm" disabled={!onpaste} onclick={() => onpaste?.()} data-testid="paste-settings" title="Paste settings ({keys('V')})">
				<ClipboardPasteIcon /> Paste
			</Button>
		</div>
	</section>
{/if}
