<!--
  Swatches for choosing a background: transparent, white, black, a custom color, an uploaded image
  and the painted presets. Used for the canvas and for cell backgrounds.
-->
<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import ImageUpIcon from '@lucide/svelte/icons/image-up';
	import ColorPicker from './color-picker.svelte';
	import { PAINT_PRESETS, type PaintGroup } from '$lib/paint/presets';
	import { paintThumb } from '$lib/paint/paint-gl';

	let {
		value = $bindable(),
		customColor = $bindable(),
		image,
		onimage,
		allowNone = true,
		testid = 'bg',
		imageLabel = 'background image'
	}: {
		value: string;
		customColor: string;
		image: { url: string; name: string } | null;
		onimage: (file: File | undefined) => void;
		allowNone?: boolean;
		testid?: string;
		imageLabel?: string;
	} = $props();

	const GROUPS: PaintGroup[] = ['Solid', 'Gradients', 'Patterns'];
	const thumbs = new Map<string, string>();
	const thumbFor = (id: string) => {
		let t = thumbs.get(id);
		if (t === undefined) {
			const p = PAINT_PRESETS.find((x) => x.id === id);
			t = p ? paintThumb(p.paint, 64, 64) : '';
			thumbs.set(id, t);
		}
		return t;
	};
	let input: HTMLInputElement;
	const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
</script>

{#snippet swatch(id: string, name: string, style: string, extra?: string)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					type="button"
					class="swatch {extra ?? ''}"
					class:selected={value === id}
					{style}
					aria-label={name}
					aria-pressed={value === id}
					data-testid="{testid}-{id}"
					onclick={() => (value = id)}
				></button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{name}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<input
	bind:this={input}
	type="file"
	accept="image/*"
	class="hidden"
	data-testid="{testid}-input"
	onchange={(e) => {
		onimage(e.currentTarget.files?.[0]);
		e.currentTarget.value = '';
	}}
/>
<div class="swatches">
	{#if allowNone}{@render swatch('none', 'Transparent', '', 'checker')}{/if}
	{@render swatch('white', 'White', 'background:#fff')}
	{@render swatch('black', 'Black', 'background:#000')}
	<ColorPicker
		value={customColor}
		label="Custom color"
		onpick={(hex) => {
			customColor = hex;
			value = 'custom';
		}}
	>
		{#snippet trigger(props)}
			<button
				{...props}
				type="button"
				class="swatch spectrum"
				class:selected={value === 'custom'}
				aria-label="Custom color"
				title="Custom color"
				data-testid="{testid}-custom"
				onclick={(e) => {
					(props.onclick as ((ev: MouseEvent) => void) | undefined)?.(e);
					value = 'custom';
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
					class:selected={value === 'image'}
					style={image ? `background:center/cover url(${image.url})` : ''}
					aria-label={image ? `${cap(imageLabel)}: ${image.name}` : `Upload a ${imageLabel}`}
					data-testid="{testid}-image"
					onclick={() => (image && value !== 'image' ? (value = 'image') : input.click())}
					ondragover={(e) => e.preventDefault()}
					ondrop={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onimage(e.dataTransfer?.files?.[0]);
					}}
				>
					{#if !image}<ImageUpIcon class="text-muted-foreground size-4" />{/if}
				</button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>
			{image ? (value === 'image' ? `Replace ${imageLabel}` : cap(imageLabel)) : `Upload or drop a ${imageLabel}`}
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

<style>
	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
		gap: 6px;
	}
</style>
