<!--
  @component
  The grid library: every grid made in this browser, newest first. Open one to bring back its
  images, edits and settings, or rename, pin, duplicate and delete them. Unpinned grids past the
  limit are dropped oldest first.
-->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { toast } from 'svelte-sonner';
	import PinIcon from '@lucide/svelte/icons/pin';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { deleteGrid, keepStorage, LIBRARY_MAX, listGrids, putGrid, updateGrid, type GridRecord } from '$lib/persist';
	import { timeAgo } from '$lib/time-ago';

	let {
		open = $bindable(false),
		currentId,
		tick = 0,
		onopen,
		onduplicate
	}: {
		open?: boolean;
		/** The grid on the canvas now. */
		currentId: string;
		/** Bumped whenever the library changes, to reload it. */
		tick?: number;
		onopen: (id: string) => void;
		onduplicate: (id: string) => Promise<void>;
	} = $props();

	type Entry = GridRecord & { url: string | null };
	let grids = $state<Entry[]>([]);
	let localTick = $state(0);

	$effect(() => {
		if (!open) return;
		void tick;
		void localTick;
		let urls: string[] = [];
		let live = true;
		listGrids().then((list) => {
			if (!live) return;
			grids = list.map((g) => {
				const url = g.thumb ? URL.createObjectURL(g.thumb) : null;
				if (url) urls.push(url);
				return { ...g, url };
			});
		});
		return () => {
			live = false;
			urls.forEach((u) => URL.revokeObjectURL(u));
			urls = [];
		};
	});

	const pinnedCount = $derived(grids.filter((g) => g.pinned).length);

	async function rename(g: Entry, name: string) {
		const n = name.trim();
		if (!n || n === g.name) return;
		await updateGrid(g.id, { name: n });
		localTick++;
	}
	async function togglePin(g: Entry) {
		if (!g.pinned) keepStorage();
		await updateGrid(g.id, { pinned: !g.pinned });
		localTick++;
	}
	async function remove(g: Entry) {
		const { url: _url, ...record } = $state.snapshot(g) as Entry;
		await deleteGrid(g.id);
		localTick++;
		toast(`Deleted ${g.name}`, {
			action: {
				label: 'Undo',
				onClick: async () => {
					await putGrid(record);
					localTick++;
				}
			}
		});
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-3xl" data-testid="grid-library">
		<Dialog.Header class="border-b p-4">
			<Dialog.Title>Your grids</Dialog.Title>
			<Dialog.Description>
				Saved in this browser as you work. The latest {LIBRARY_MAX} are kept, plus any you pin.
			</Dialog.Description>
		</Dialog.Header>
		<div class="min-h-0 flex-1 overflow-y-auto p-4">
			{#if !grids.length}
				<p class="text-muted-foreground py-10 text-center text-sm" data-testid="library-empty">
					Grids you make show up here, so you can come back to them after starting another.
				</p>
			{:else}
				<ul class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
					{#each grids as g (g.id)}
						<li class="min-w-0" data-testid="library-item">
							<button
								type="button"
								class="bg-muted group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden border outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onclick={() => {
									onopen(g.id);
									open = false;
								}}
								aria-label="Open {g.name}"
								data-testid="library-open"
							>
								{#if g.url}
									<img src={g.url} alt="" class="max-h-full max-w-full object-contain p-2 transition-transform group-hover:scale-[1.02]" />
								{/if}
								{#if g.id === currentId}
									<span class="bg-background/85 absolute top-2 left-2 px-1.5 py-0.5 text-[11px] font-medium">Open now</span>
								{/if}
							</button>
							<div class="mt-2 flex items-start gap-1">
								<div class="min-w-0 flex-1">
									<input
										class="hover:border-input focus-visible:border-input -ml-1 h-7 w-full truncate rounded-sm border border-transparent bg-transparent px-1 text-sm font-medium outline-none"
										value={g.name}
										aria-label="Name of grid"
										onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
										onblur={(e) => rename(g, e.currentTarget.value)}
										data-testid="library-name"
									/>
									<div class="text-muted-foreground text-xs tabular-nums">
										{g.count} image{g.count === 1 ? '' : 's'} · {timeAgo(g.updated)}
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon-sm"
									class={g.pinned ? 'text-foreground' : 'text-muted-foreground'}
									aria-label={g.pinned ? `Unpin ${g.name}` : `Pin ${g.name}`}
									aria-pressed={g.pinned}
									title={g.pinned ? 'Pinned: kept until you delete it' : 'Pin to keep it'}
									onclick={() => togglePin(g)}
									data-testid="library-pin"
								>
									<PinIcon class={g.pinned ? 'fill-current' : ''} />
								</Button>
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<Button {...props} variant="ghost" size="icon-sm" class="text-muted-foreground" aria-label="More for {g.name}" data-testid="library-more">
												<EllipsisIcon />
											</Button>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end" class="w-40">
										<DropdownMenu.Item
											onclick={async () => {
												await onduplicate(g.id);
												localTick++;
											}}
											data-testid="library-duplicate"><CopyIcon /> Duplicate</DropdownMenu.Item
										>
										{#if g.id !== currentId}
											<DropdownMenu.Item variant="destructive" onclick={() => remove(g)} data-testid="library-delete"
												><Trash2Icon /> Delete</DropdownMenu.Item
											>
										{/if}
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		{#if grids.length}
			<div class="text-muted-foreground border-t px-4 py-2.5 text-xs">
				{grids.length} saved{pinnedCount ? ` · ${pinnedCount} pinned` : ''} · Everything stays on this device.
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
