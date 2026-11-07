<!--
  @component
  The Image tab: edits the selected cells together. Framing comes from CELL_SETTINGS and image
  edits from the operations registry; each slider sets the same value on every selected image and
  shows Mixed while they differ. Rotate and flip buttons turn each image from where it is.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ClipboardPasteIcon from '@lucide/svelte/icons/clipboard-paste';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw-square';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw-square';
	import FlipHorizontalIcon from '@lucide/svelte/icons/flip-vertical-2';
	import FlipVerticalIcon from '@lucide/svelte/icons/flip-horizontal-2';
	import SliderField from './slider-field.svelte';
	import InfoTip from './info-tip.svelte';
	import EditParam from './edit-param.svelte';
	import { slide } from 'svelte/transition';
	import { CELL_SETTINGS, RESET_FRAMING, sharedValue, type CellChange, type CellSetting } from '$lib/cell-edits';
	import type { Adjust } from '$lib/grid';
	import {
		GROUP_LABELS,
		OPERATIONS,
		resetGroups,
		sharedEdit,
		valueOf,
		paramById,
		type ImageEdits,
		type NumberParam,
		type OperationGroup,
		type ParamValue
	} from '$lib/edits';

	let {
		adjusts,
		edits,
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
		/** The edits of each selected image, in the same order. */
		edits: ImageEdits[];
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
	const hasFocus = $derived(edits.some((e) => e.focusX !== undefined || e.focusY !== undefined));
	type Side = -1 | 0 | 1;
	const ALIGN: [Side, [Side, string][]][] = [
		[-1, [[-1, 'top left'], [0, 'top'], [1, 'top right']]],
		[0, [[-1, 'left'], [0, 'center'], [1, 'right']]],
		[1, [[-1, 'bottom left'], [0, 'bottom'], [1, 'bottom right']]]
	];

	// Image edits, one section per registry group. Geometry has its own buttons; other groups
	// show a control for each parameter, and operations with an on switch show the rest of their
	// parameters only while it is on.
	const EDIT_GROUPS: OperationGroup[] = ['light', 'color', 'looks', 'effects'];
	const set = (id: string, value: ParamValue) => onedit({ kind: 'edit', values: { [id]: value } });
	const angle = paramById('angle') as NumberParam;
	const angleBinding = editBinding(angle);
	function editBinding(p: NumberParam) {
		return {
			get: () => Number(sharedEdit(edits, p.id) ?? valueOf(edits[0], p.id)),
			set: (v: number) => onedit({ kind: 'edit', values: { [p.id]: v } })
		};
	}
	const groupParams = (g: OperationGroup) => OPERATIONS.filter((op) => op.group === g).flatMap((op) => op.params);
	const groupChanged = (g: OperationGroup) => edits.some((e) => groupParams(g).some((p) => e[p.id] !== undefined));
	const resetGroup = (g: OperationGroup) => onedit({ kind: 'edit', values: resetGroups([g]) });
	const mixedEdit = (id: string) => count > 1 && sharedEdit(edits, id) === null;
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
				<Button variant="ghost" size="sm" class="h-7 px-2" disabled={!changed} onclick={() => onedit({ kind: 'set', values: RESET_FRAMING })} data-testid="bulk-reset">Reset</Button>
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
			>
				{#snippet extra()}<span class="w-4 shrink-0"></span>{/snippet}
			</SliderField>
		{/each}
		<div class="flex min-h-8 items-start gap-2.5">
			<span class="w-[6.5rem] shrink-0 pt-1 text-sm">Align</span>
			<div class="grid grid-cols-3 border" role="group" aria-label="Align in cell" data-testid="align">
				{#each ALIGN as [y, row] (y)}
					{#each row as [x, name] (x)}
						<button
							type="button"
							class="hover:bg-muted flex size-6 items-center justify-center"
							title="Align {name}"
							aria-label="Align {name}"
							onclick={() => onedit({ kind: 'align', x, y })}
						>
							<span class="bg-foreground/70 size-1.5 rounded-full"></span>
						</button>
					{/each}
				{/each}
			</div>
		</div>
		<div class="flex min-h-8 items-center gap-2.5">
			<span class="w-[6.5rem] shrink-0 text-sm">Focal point</span>
			<span class="text-muted-foreground flex-1 text-sm">{hasFocus ? (count > 1 ? 'Set on some' : 'Set') : 'None'}</span>
			<Button variant="ghost" size="sm" class="h-7 px-2" disabled={!hasFocus} onclick={() => onedit({ kind: 'edit', values: { focusX: 50, focusY: 50 } })} data-testid="clear-focus">Clear</Button>
			<InfoTip text="Alt-click an image to set the spot that stays in view as you zoom or reshape its cell." />
		</div>
	</section>

	<section class="pane-section space-y-2" data-testid="edit-geometry">
		<div class="flex items-center justify-between">
			<h2 class="pane-title">{GROUP_LABELS.geometry}</h2>
			<Button variant="ghost" size="sm" class="h-7 px-2" disabled={!groupChanged('geometry')} onclick={() => resetGroup('geometry')}>Reset</Button>
		</div>
		<div class="flex items-center gap-1">
			<Button variant="outline" size="icon" class="size-8" title="Rotate left" aria-label="Rotate left" onclick={() => onedit({ kind: 'shift', id: 'turn', by: -90 })} data-testid="rotate-left">
				<RotateCcwIcon />
			</Button>
			<Button variant="outline" size="icon" class="size-8" title="Rotate right" aria-label="Rotate right" onclick={() => onedit({ kind: 'shift', id: 'turn', by: 90 })} data-testid="rotate-right">
				<RotateCwIcon />
			</Button>
			<Button variant="outline" size="icon" class="size-8" title="Flip horizontal" aria-label="Flip horizontal" onclick={() => onedit({ kind: 'shift', id: 'flipH', by: 1 })} data-testid="flip-h">
				<FlipHorizontalIcon />
			</Button>
			<Button variant="outline" size="icon" class="size-8" title="Flip vertical" aria-label="Flip vertical" onclick={() => onedit({ kind: 'shift', id: 'flipV', by: 1 })} data-testid="flip-v">
				<FlipVerticalIcon />
			</Button>
		</div>
		<SliderField label={angle.label} bind:value={angleBinding.get, angleBinding.set} min={angle.min} max={angle.max} step={angle.step} unit={angle.unit} mixed={mixedEdit(angle.id)}>
			{#snippet extra()}<InfoTip text={angle.tip ?? ''} />{/snippet}
		</SliderField>
	</section>

	{#each EDIT_GROUPS as g (g)}
		<section class="pane-section space-y-2" data-testid="edit-{g}">
			<div class="flex items-center justify-between">
				<h2 class="pane-title">{GROUP_LABELS[g]}</h2>
				<Button variant="ghost" size="sm" class="h-7 px-2" disabled={!groupChanged(g)} onclick={() => resetGroup(g)}>Reset</Button>
			</div>
			{#each OPERATIONS.filter((op) => op.group === g) as op (op.id)}
				{#if op.enabledBy}
					{@const toggle = op.params.find((p) => p.id === op.enabledBy)!}
					<EditParam param={toggle} {edits} onset={set} />
					{#if edits.some((e) => valueOf(e, toggle.id) !== toggle.initial)}
						<div class="space-y-2 border-l pl-3" transition:slide={{ duration: 150 }}>
							{#each op.params.filter((p) => p !== toggle) as p (p.id)}
								<EditParam param={p} {edits} onset={set} />
							{/each}
						</div>
					{/if}
				{:else}
					{#each op.params as p (p.id)}
						<EditParam param={p} {edits} onset={set} />
					{/each}
				{/if}
			{/each}
		</section>
	{/each}

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
