<!--
  @component
  The empty canvas: three ways to start. Drop or choose images, start from a grid of empty slots
  sized by hovering, or open the sample grid. The panels wrap 3 → 2 (last one centered) → 1.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
	import type { Snippet } from 'svelte';

	let {
		cols,
		rows,
		previews,
		disabled = false,
		onchoose,
		onempty,
		onsample,
		extra
	}: {
		cols: number;
		rows: number;
		/** Image URLs for the sample's little preview. */
		previews: string[];
		disabled?: boolean;
		onchoose: () => void;
		onempty: (cols: number, rows: number) => void;
		onsample: () => void;
		extra?: Snippet;
	} = $props();

	const MAX = 6;
	let hover = $state<{ c: number; r: number } | null>(null);
	const size = $derived(hover ?? { c: Math.min(cols, MAX), r: Math.min(rows, MAX) });
</script>

<div class="flex h-full w-full flex-col items-center overflow-y-auto px-4 py-8" data-testid="start-panel">
	<div class="ways my-auto">
		<div class="way">
			<div class="art">
				<div class="text-muted-foreground flex size-16 items-center justify-center border">
					<ImagePlusIcon class="size-6" />
				</div>
			</div>
			<div class="space-y-0.5">
				<div class="font-medium">Drop images</div>
				<div class="text-muted-foreground text-xs">or click to choose files</div>
			</div>
			<Button variant="outline" size="sm" onclick={onchoose} {disabled} data-testid="start-choose">Choose images</Button>
		</div>

		<div class="way">
			<div class="art">
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="picker" onpointerleave={() => (hover = null)} data-testid="size-picker">
					{#each { length: MAX } as _, r (r)}
						{#each { length: MAX } as _, c (c)}
							<button
								type="button"
								class="cell"
								class:on={c < size.c && r < size.r}
								aria-label="{c + 1} by {r + 1} grid"
								onpointerenter={() => (hover = { c: c + 1, r: r + 1 })}
								onfocus={() => (hover = { c: c + 1, r: r + 1 })}
								onblur={() => (hover = null)}
								onclick={() => onempty(c + 1, r + 1)}
								{disabled}
							></button>
						{/each}
					{/each}
				</div>
			</div>
			<div class="space-y-0.5">
				<div class="font-medium">Empty grid <span class="tabular-nums" data-testid="size-label">{size.c} × {size.r}</span></div>
				<div class="text-muted-foreground text-xs">Pick a size, fill it later</div>
			</div>
			<Button variant="outline" size="sm" onclick={() => onempty(size.c, size.r)} {disabled} data-testid="start-empty">Start empty</Button>
		</div>

		<div class="way">
			<div class="art">
				<button type="button" class="sample" onclick={onsample} {disabled} aria-label="Open the sample grid" tabindex="-1">
					{#each previews.slice(0, 9) as src (src)}
						<img {src} alt="" draggable="false" />
					{/each}
				</button>
			</div>
			<div class="space-y-0.5">
				<div class="font-medium">Try the sample</div>
				<div class="text-muted-foreground text-xs">Nine poses, ready to play with</div>
			</div>
			<Button variant="outline" size="sm" onclick={onsample} {disabled} data-testid="load-samples">Open sample</Button>
		</div>
	</div>
	{#if extra}<div class="mt-4">{@render extra()}</div>{/if}
</div>

<style>
	.ways {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		max-width: 780px;
		padding: 1px 0 0 1px;
	}
	.way {
		width: 260px;
		min-height: 290px;
		margin: -1px 0 0 -1px;
		border: 1px solid var(--border);
		background: var(--background);
		padding: 28px 24px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		text-align: center;
		font-size: 14px;
	}
	/* Two across when three don't fit; the third centers below. */
	@media (max-width: 899px) {
		.ways {
			max-width: 522px;
		}
	}
	@media (max-width: 599px) {
		.ways {
			max-width: 262px;
		}
		.way {
			min-height: 0;
		}
	}
	.art {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.picker {
		display: grid;
		grid-template-columns: repeat(6, 18px);
		gap: 4px;
	}
	.cell {
		width: 18px;
		height: 18px;
		border: 1px solid var(--border);
		border-radius: 2px;
		background: var(--background);
		cursor: pointer;
		transition:
			background 0.08s,
			border-color 0.08s;
	}
	.cell.on {
		background: var(--foreground);
		border-color: var(--foreground);
	}
	.cell:focus-visible,
	.sample:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
	.sample {
		display: grid;
		grid-template-columns: repeat(3, 40px);
		gap: 3px;
		padding: 5px;
		background: #ffffff;
		border: 1px solid var(--border);
		cursor: pointer;
		transition: transform 0.2s;
	}
	.sample:hover {
		transform: scale(1.04);
	}
	.sample img {
		width: 40px;
		height: 40px;
		object-fit: cover;
		background: #1ccd50;
		display: block;
	}
</style>
