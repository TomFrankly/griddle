<!--
  @component
  One image-edit parameter from the operations registry, drawn as the control its kind calls for:
  a slider for numbers, a swatch for colors, a menu for choices and a switch for toggles. Every
  control sets the same value on all selected images and shows Mixed while they differ.
-->
<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import SliderField from './slider-field.svelte';
	import ColorField from './color-field.svelte';
	import InfoTip from './info-tip.svelte';
	import { sharedEdit, valueOf, type ImageEdits, type Param, type ParamValue } from '$lib/edits';

	let {
		param: p,
		edits,
		onset
	}: {
		param: Param;
		/** The edits of each selected image. */
		edits: ImageEdits[];
		onset: (id: string, value: ParamValue) => void;
	} = $props();

	const shared = $derived(sharedEdit(edits, p.id));
	const value = $derived(shared ?? valueOf(edits[0], p.id));
	const mixed = $derived(edits.length > 1 && shared === null);
	const binding = {
		get: () => Number(value),
		set: (v: number) => onset(p.id, v)
	};
	const colorBinding = {
		get: () => String(value),
		set: (v: string) => onset(p.id, v)
	};
	const id = $derived(`edit-${p.id}`);
</script>

{#if p.kind === 'number'}
	<SliderField label={p.label} bind:value={binding.get, binding.set} min={p.min} max={p.max} step={p.step} unit={p.unit} {mixed}>
		{#snippet extra()}
			{#if p.tip}<InfoTip text={p.tip} />{:else}<span class="w-4 shrink-0"></span>{/if}
		{/snippet}
	</SliderField>
{:else if p.kind === 'color'}
	<div class:opacity-60={mixed}>
		<ColorField label={p.label} bind:value={colorBinding.get, colorBinding.set} />
	</div>
{:else if p.kind === 'choice'}
	<div class="flex min-h-8 items-center justify-between gap-2">
		<span class="text-sm">{p.label}</span>
		<Select.Root type="single" value={String(value)} onValueChange={(v) => v && onset(p.id, v)}>
			<Select.Trigger size="sm" class="w-40" data-testid={id}>{mixed ? 'Mixed' : (p.options.find((o) => o.value === value)?.label ?? '')}</Select.Trigger>
			<Select.Content>
				{#each p.options as o (o.value)}
					<Select.Item value={o.value} label={o.label}>{o.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>
{:else}
	<label class="flex min-h-8 cursor-pointer items-center justify-between" for={id}>
		<span class="text-sm">{p.label}</span>
		<Switch {id} checked={value === true} onCheckedChange={(v) => onset(p.id, v)} class={mixed ? 'opacity-60' : ''} />
	</label>
{/if}
