<!--
  @component
  The latest few grids from the library, shown under the start panel's ways to begin.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { listGrids, type GridRecord } from '$lib/persist';
	import { timeAgo } from '$lib/time-ago';

	let { tick = 0, onopen, onall }: { tick?: number; onopen: (id: string) => void; onall: () => void } = $props();

	const SHOWN = 4;
	let grids = $state<(GridRecord & { url: string | null })[]>([]);
	let total = $state(0);

	$effect(() => {
		void tick;
		let urls: string[] = [];
		let live = true;
		listGrids().then((list) => {
			if (!live) return;
			total = list.length;
			grids = list.slice(0, SHOWN).map((g) => {
				const url = g.thumb ? URL.createObjectURL(g.thumb) : null;
				if (url) urls.push(url);
				return { ...g, url };
			});
		});
		return () => {
			live = false;
			urls.forEach((u) => URL.revokeObjectURL(u));
		};
	});
</script>

{#if grids.length}
	<section class="w-full max-w-[52rem] border-t pt-5" data-testid="recent-grids">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="text-sm font-medium">Pick up where you left off</h2>
			<Button variant="ghost" size="sm" class="h-7 px-2" onclick={onall} data-testid="recent-all">
				{total > SHOWN ? `All ${total} grids` : 'All grids'}
			</Button>
		</div>
		<ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each grids as g (g.id)}
				<li class="min-w-0">
					<button type="button" class="group w-full text-left outline-none" onclick={() => onopen(g.id)} data-testid="recent-open">
						<span class="bg-muted group-focus-visible:ring-ring flex aspect-[4/3] items-center justify-center overflow-hidden border group-focus-visible:ring-2">
							{#if g.url}<img src={g.url} alt="" class="max-h-full max-w-full object-contain p-1.5 transition-transform group-hover:scale-[1.03]" />{/if}
						</span>
						<span class="mt-1.5 block truncate text-sm">{g.name}</span>
						<span class="text-muted-foreground block text-xs">{g.count} image{g.count === 1 ? '' : 's'} · {timeAgo(g.updated)}</span>
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
