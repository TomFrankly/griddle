<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { slide } from 'svelte/transition';

	let { title, on = $bindable(false), children }: { title: string; on: boolean; children: Snippet } = $props();
	const id = $derived(`section-${title.toLowerCase().replace(/\W+/g, '-')}`);
</script>

<section class="pane-section-line">
	<label class="flex cursor-pointer items-center justify-between py-3" for={id}>
		<span class="pane-title">{title}</span>
		<Switch {id} bind:checked={on} />
	</label>
	{#if on}
		<div class="space-y-3 pb-4" transition:slide={{ duration: 150 }}>
			{@render children()}
		</div>
	{/if}
</section>
