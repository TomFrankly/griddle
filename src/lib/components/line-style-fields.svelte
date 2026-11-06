<!--
  Settings for divider lines: type, thickness, color and opacity up front; pattern, crossings,
  ornaments and effects as each becomes relevant.
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
	const markLabel = $derived(MARKS.find((m) => m.value === value.crossing)?.label ?? 'Nothing');
	const ornLabel = $derived(ORNAMENTS.find((m) => m.value === value.ornament)?.label ?? 'None');
	const hasLine = $derived(value.type !== 'none');
	const showMarkSize = $derived(value.crossing !== 'none' || (hasLine && value.ornament !== 'none'));
</script>

<div class="flex items-center justify-between">
	<span class="text-sm">Type</span>
	<Select.Root type="single" value={value.type} onValueChange={(v) => {
			if (!v) return;
			value.type = v as LineType;
			// Marks only needs a mark to show anything.
			if (v === 'none' && (value.crossing === 'none' || value.crossing === 'gap')) value.crossing = 'plus';
		}}>
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
	<div transition:slide={{ duration: 150 }}><SliderField label="Spacing" bind:value={value.spacing} min={2} max={Math.max(60, spaceMax)} /></div>
{/if}
{#if USES_AMPLITUDE.has(value.type)}
	<div transition:slide={{ duration: 150 }}><SliderField label={value.type === 'wavy' || value.type === 'zigzag' ? 'Height' : 'Roughness'} bind:value={value.amplitude} max={40} /></div>
{/if}
<div class="flex items-center justify-between">
	<span class="text-sm">Crossings</span>
	<Select.Root type="single" value={value.crossing} onValueChange={(v) => v && (value.crossing = v as Mark)}>
		<Select.Trigger size="sm" class="w-36" data-testid="line-crossing">{markLabel}</Select.Trigger>
		<Select.Content>
			{#each MARKS as m (m.value)}
				<Select.Item value={m.value} label={m.label}>{m.label}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
{#if hasLine}
	<div class="flex items-center justify-between">
		<span class="text-sm">Ornament</span>
		<Select.Root type="single" value={value.ornament} onValueChange={(v) => v && (value.ornament = v as Ornament)}>
			<Select.Trigger size="sm" class="w-36" data-testid="line-ornament">{ornLabel}</Select.Trigger>
			<Select.Content>
				{#each ORNAMENTS as m (m.value)}
					<Select.Item value={m.value} label={m.label}>{m.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{/if}
{#if showMarkSize}
	<div transition:slide={{ duration: 150 }}>
		<SliderField label={value.crossing === 'gap' && !(hasLine && value.ornament !== 'none') ? 'Gap size' : 'Mark size'} bind:value={value.markSize} min={2} max={Math.max(60, spaceMax)} />
	</div>
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
		<SliderField label="Float" bind:value={value.inset} max={Math.max(60, spaceMax)} />
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
