<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { slide } from 'svelte/transition';

	let { title, on = $bindable(false), children }: { title: string; on: boolean; children: Snippet } = $props();
	const id = $derived(`section-${title.toLowerCase().replace(/\W+/g, '-')}`);
</script>

<section class="border-b">
	<label class="flex cursor-pointer items-center justify-between px-4 py-3" for={id}>
		<span class="text-sm">{title}</span>
		<Switch {id} bind:checked={on} />
	</label>
	{#if on}
		<div class="space-y-4 px-4 pb-4" transition:slide={{ duration: 150 }}>
			{@render children()}
		</div>
	{/if}
</section>
