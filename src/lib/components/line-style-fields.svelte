<!--
  Settings for divider lines, in three groups: the line itself, what happens where lines cross,
  and an ornament in the middle of each segment. Rarer settings sit behind "More options".
-->
<script lang="ts">
	import { slide } from 'svelte/transition';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import SliderField from './slider-field.svelte';
	import ColorField from './color-field.svelte';
	import { LINE_TYPES, MARKS, ORNAMENTS, USES_AMPLITUDE, USES_CAP, USES_SPACING, type LineStyle, type LineType, type Mark, type Ornament } from '$lib/lines';

	let { value = $bindable(), maxWidth, spaceMax }: { value: LineStyle; maxWidth: number; spaceMax: number } = $props();
	let more = $state(false);

	const typeLabel = $derived(LINE_TYPES.flatMap((g) => g.items).find((t) => t.value === value.type)?.label ?? 'Solid');
	const hasLine = $derived(value.type !== 'none');
	const hasMark = $derived(value.crossing !== 'none' && value.crossing !== 'gap');
	const sizeMax = $derived(Math.max(60, spaceMax));

	function pickType(v: string) {
		if (!v) return;
		value.type = v as LineType;
		// Marks only needs a mark to show anything.
		if (v === 'none' && !hasMark) value.crossing = 'plus';
	}
</script>

{#snippet heading(text: string)}
	<div class="text-muted-foreground pt-1 text-[11px] font-medium">{text}</div>
{/snippet}

{#snippet picker(label: string, current: string, items: { value: string; label: string }[], onpick: (v: string) => void, testid: string)}
	<div class="flex items-center justify-between">
		<span class="text-sm">{label}</span>
		<Select.Root type="single" value={current} onValueChange={(v) => v && onpick(v)}>
			<Select.Trigger size="sm" class="w-36" data-testid={testid}>{items.find((i) => i.value === current)?.label}</Select.Trigger>
			<Select.Content>
				{#each items as m (m.value)}
					<Select.Item value={m.value} label={m.label}>{m.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{/snippet}

{@render heading('Line')}
<div class="flex items-center justify-between">
	<span class="text-sm">Type</span>
	<Select.Root type="single" value={value.type} onValueChange={pickType}>
		<Select.Trigger size="sm" class="w-36" data-testid="line-type">{typeLabel}</Select.Trigger>
		<Select.Content>
			{#each LINE_TYPES as g, gi (g.group)}
				{#if gi}<Select.Separator />{/if}
				<Select.Group>
					<Select.GroupHeading>{g.group}</Select.GroupHeading>
					{#each g.items as t (t.value)}
						<Select.Item value={t.value} label={t.label}>{t.label}</Select.Item>
					{/each}
				</Select.Group>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
<SliderField label="Thickness" bind:value={value.width} min={1} max={maxWidth} />
<ColorField label="Color" bind:value={value.color} />
<SliderField label="Opacity" bind:value={value.opacity} unit="%" />
{#if USES_SPACING.has(value.type)}
	<div transition:slide={{ duration: 150 }}><SliderField label="Spacing" bind:value={value.spacing} min={2} max={sizeMax} /></div>
{/if}
{#if USES_AMPLITUDE.has(value.type)}
	<div transition:slide={{ duration: 150 }}>
		<SliderField label={value.type === 'wavy' || value.type === 'zigzag' ? 'Height' : 'Roughness'} bind:value={value.amplitude} max={40} />
	</div>
{/if}

{@render heading('Crossings')}
{@render picker('Mark', value.crossing === 'gap' ? 'none' : value.crossing, MARKS, (v) => (value.crossing = v as Mark), 'line-crossing')}
{#if hasMark}
	<div transition:slide={{ duration: 150 }}><SliderField label="Mark size" bind:value={value.markSize} min={2} max={sizeMax} /></div>
{/if}
{#if hasLine}
	<SliderField label="Float" bind:value={value.inset} max={sizeMax} />
{/if}

{#if hasLine}
	{@render heading('Ornament')}
	{@render picker('Shape', value.ornament, ORNAMENTS, (v) => (value.ornament = v as Ornament), 'line-ornament')}
	{#if value.ornament !== 'none'}
		<div class="space-y-4" transition:slide={{ duration: 150 }}>
			<SliderField label="Size" bind:value={value.ornamentSize} min={2} max={sizeMax} />
			<SliderField label="Float" bind:value={value.ornamentFloat} max={sizeMax} />
		</div>
	{/if}
{/if}

<button
	type="button"
	class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
	aria-expanded={more}
	onclick={() => (more = !more)}
>
	<ChevronRightIcon class="size-3.5 transition-transform {more ? 'rotate-90' : ''}" />
	{more ? 'Fewer options' : 'More options'}
</button>
{#if more}
	<div class="space-y-4" transition:slide={{ duration: 150 }}>
		{#if USES_CAP.has(value.type)}
			<div class="flex items-center justify-between">
				<span class="text-sm">Ends</span>
				<ToggleGroup.Root type="single" variant="outline" size="sm" value={value.cap} onValueChange={(v) => v && (value.cap = v as LineStyle['cap'])}>
					<ToggleGroup.Item value="round" class="px-3">Round</ToggleGroup.Item>
					<ToggleGroup.Item value="square" class="px-3">Square</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>
		{/if}
		<label class="flex cursor-pointer items-center justify-between" for="lines-fade">
			<span class="text-sm">Fade at edges</span>
			<Switch id="lines-fade" bind:checked={value.fade} size="sm" />
		</label>
		<label class="flex cursor-pointer items-center justify-between" for="lines-gradient">
			<span class="text-sm">Gradient</span>
			<Switch id="lines-gradient" bind:checked={value.gradient} size="sm" />
		</label>
		{#if value.gradient}
			<div transition:slide={{ duration: 150 }}><ColorField label="Second color" bind:value={value.color2} /></div>
		{/if}
	</div>
{/if}
