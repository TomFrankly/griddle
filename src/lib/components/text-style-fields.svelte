<!--
  Settings for one caption line (title or description): font and size up front, the rest behind
  "More".
-->
<script lang="ts">
	import { slide } from 'svelte/transition';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FontPicker from './font-picker.svelte';
	import SliderField from './slider-field.svelte';
	import ColorField from './color-field.svelte';
	import Stepper from './stepper.svelte';
	import type { TextStyle } from '$lib/captions';

	let { title, value = $bindable(), maxSize }: { title: string; value: TextStyle; maxSize: number } = $props();
	let more = $state(false);
	const id = $derived(`caption-${title.toLowerCase()}`);
</script>

<div class="space-y-3">
	<label class="flex cursor-pointer items-center justify-between" for={id}>
		<span class="text-sm font-medium">{title}</span>
		<Switch {id} bind:checked={value.on} size="sm" />
	</label>
	{#if value.on}
		<div class="space-y-3 border-l pl-3" transition:slide={{ duration: 150 }}>
			<div class="flex items-center justify-between">
				<span class="text-sm">Font</span>
				<FontPicker bind:value={value.font} label="{title} font" />
			</div>
			<SliderField label="Size" bind:value={value.size} min={8} max={maxSize} />
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
				<div class="space-y-3" transition:slide={{ duration: 150 }}>
					<ColorField label="Color" bind:value={value.color} />
					<div class="flex items-center justify-between">
						<span class="text-sm">Position</span>
						<ToggleGroup.Root
							type="single"
							variant="outline"
							size="sm"
							value={value.position}
							onValueChange={(v) => v && (value.position = v as TextStyle['position'])}
						>
							<ToggleGroup.Item value="above" class="px-3">Above</ToggleGroup.Item>
							<ToggleGroup.Item value="below" class="px-3">Below</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>
					<SliderField label="Offset" bind:value={value.offset} max={Math.max(40, maxSize)} />
					<div class="flex items-center justify-between">
						<span class="text-sm">Max lines</span>
						<Stepper bind:value={value.lines} min={1} max={6} label="{title} max lines" />
					</div>
					<label class="flex cursor-pointer items-center justify-between" for="{id}-shadow">
						<span class="text-sm">Shadow</span>
						<Switch id="{id}-shadow" bind:checked={value.shadow.on} size="sm" />
					</label>
					{#if value.shadow.on}
						<div class="space-y-3" transition:slide={{ duration: 150 }}>
							<ColorField label="Shadow color" bind:value={value.shadow.color} />
							<SliderField label="Strength" bind:value={value.shadow.strength} unit="%" />
							<SliderField label="Distance" bind:value={value.shadow.distance} max={40} />
							<SliderField label="Softness" bind:value={value.shadow.softness} max={60} />
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
