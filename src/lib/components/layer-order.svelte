<!--
  The stacking order of a cell's image, caption fade and text, shown top first like a layers
  panel. Arrow buttons move a layer up or down.
-->
<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import type { Layer } from '$lib/captions';

	let { value = $bindable(), fade }: { value: Layer[]; fade: boolean } = $props();
	const NAMES: Record<Layer, string> = { image: 'Image', fade: 'Fade', text: 'Text' };
	const top = $derived([...value].reverse());

	function move(layer: Layer, dir: 1 | -1) {
		const i = value.indexOf(layer);
		const j = i + dir;
		if (i < 0 || j < 0 || j >= value.length) return;
		const next = [...value];
		[next[i], next[j]] = [next[j], next[i]];
		value = next;
	}
</script>

<div class="divide-y border" role="list" aria-label="Layer order, top first" data-testid="layer-order">
	{#each top as l, i (l)}
		<div class="flex h-8 items-center justify-between pr-1 pl-2.5 text-sm" class:text-muted-foreground={l === 'fade' && !fade} role="listitem" data-layer={l}>
			<span>{NAMES[l]}</span>
			<span class="flex">
				<button type="button" class="hover:bg-accent flex size-6 items-center justify-center rounded-sm disabled:opacity-30" aria-label="Move {NAMES[l]} up" disabled={i === 0} onclick={() => move(l, 1)}>
					<ArrowUpIcon class="size-3.5" />
				</button>
				<button type="button" class="hover:bg-accent flex size-6 items-center justify-center rounded-sm disabled:opacity-30" aria-label="Move {NAMES[l]} down" disabled={i === top.length - 1} onclick={() => move(l, -1)}>
					<ArrowDownIcon class="size-3.5" />
				</button>
			</span>
		</div>
	{/each}
</div>
