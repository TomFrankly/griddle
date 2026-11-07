<!--
  The Help and Privacy dialogs, opened from the info menu in the header.
-->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	let { open = $bindable(null) }: { open: 'help' | 'privacy' | null } = $props();
	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
	const mod = isMac ? '⌘' : 'Ctrl';
</script>

{#snippet keys(list: string[])}
	{#each list as k, i (i)}<kbd class="bg-muted rounded-sm border px-1.5 py-0.5 font-sans text-[11px]">{k}</kbd>{#if i < list.length - 1}<span class="text-muted-foreground"> + </span>{/if}{/each}
{/snippet}

<Dialog.Root open={open === 'help'} onOpenChange={(o) => !o && (open = null)}>
	<Dialog.Content class="max-h-[85svh] overflow-y-auto sm:max-w-lg" data-testid="help-dialog">
		<Dialog.Header>
			<Dialog.Title>How Griddle works</Dialog.Title>
			<Dialog.Description>Griddle turns a set of images into one clean grid, right in your browser.</Dialog.Description>
		</Dialog.Header>
		<ol class="space-y-3 text-sm">
			<li>
				<span class="font-medium">1. Add images.</span>
				Drop them anywhere on the page or use Add images. Drop a file on a cell to replace it, or into the image list to insert it. To plan the layout first, start with empty slots or add one from the image list, then drop images into them.
			</li>
			<li>
				<span class="font-medium">2. Arrange them.</span>
				Set columns and rows, or leave Auto on. Drag a cell's grip to move it: drop between cells to push the others along, or on the middle of a cell to swap. The size button on each cell makes it span more cells, and Random mixes sizes for you.
			</li>
			<li>
				<span class="font-medium">3. Frame each image.</span>
				Drag an image to reposition it, scroll over it to zoom, and double-click to center it again. Right-click a cell for all of its options. To frame several at once, Shift-click them or drag across the grid from outside it, then zoom or move any of them, or use the Image tab.
			</li>
			<li>
				<span class="font-medium">4. Style the grid.</span>
				Try a look from Looks, then adjust spacing, corners, cell backgrounds, borders, shadows, divider lines and captions. The panel button above the image list edits every caption side by side.
			</li>
			<li>
				<span class="font-medium">5. Export.</span>
				Download a PNG, JPG, WebP or layered PSD, save each cell as its own PNG, or copy the grid to paste anywhere. Every grid is saved in this browser as you work, so Grids in the top bar can bring back an earlier one.
			</li>
		</ol>
		<div class="space-y-1.5 border-t pt-3 text-sm">
			<div class="text-muted-foreground text-xs font-medium">Shortcuts</div>
			<div class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
				<span>{@render keys([mod, 'Z'])}</span><span>Undo</span>
				<span>{@render keys([mod, 'Shift', 'Z'])}</span><span>Redo</span>
				<span>{@render keys([mod, 'scroll'])}</span><span>Zoom the view</span>
				<span>{@render keys([mod, '0'])}</span><span>Fit the view</span>
				<span>{@render keys(['Space', 'drag'])}</span><span>Pan the view</span>
				<span>{@render keys(['Shift', '1'])}</span><span>Fit and center</span>
				<span>{@render keys(['Shift', 'click'])}</span><span>Add an image to the selection</span>
				<span>{@render keys([mod, 'A'])}</span><span>Select every image</span>
				<span>{@render keys(['Esc'])}</span><span>Clear the selection</span>
				<span>{@render keys(isMac ? ['⌥', mod, 'C'] : [mod, 'Alt', 'C'])}</span><span>Copy an image's settings</span>
				<span>{@render keys(isMac ? ['⌥', mod, 'V'] : [mod, 'Alt', 'V'])}</span><span>Paste them onto the selection</span>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={open === 'privacy'} onOpenChange={(o) => !o && (open = null)}>
	<Dialog.Content class="max-h-[85svh] overflow-y-auto sm:max-w-lg" data-testid="privacy-dialog">
		<Dialog.Header>
			<Dialog.Title>Privacy</Dialog.Title>
			<Dialog.Description>Your images never leave your device.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-3 text-sm">
			<p>
				Griddle runs entirely in your browser. Your images, captions and settings are never uploaded. They're kept in this
				browser's own storage, so your grid is still here after a refresh and earlier grids can be opened again from Grids.
				Deleting a grid there, or clearing this site's data, removes them. Exports are made on your device.
			</p>
			<p>There are no accounts, no ads and no tracking cookies. A few things do use the network:</p>
			<ul class="list-disc space-y-2 pl-5">
				<li>
					<span class="font-medium">Hosting.</span>
					Griddle is served by Cloudflare. Cloudflare Web Analytics counts visits with anonymous page-load statistics, such as
					the page address, load times and browser type. It uses no cookies and never sees your images or text.
				</li>
				<li>
					<span class="font-medium">Fonts.</span>
					Caption fonts other than the built-in Inter are downloaded from Google Fonts when you use or browse them. Google
					sees your IP address and the font's name, nothing else.
				</li>
				<li>
					<span class="font-medium">Feedback.</span>
					Only when you send feedback: your message, the screenshots you add and, if you leave it on, diagnostic info (Griddle's
					version, your browser, window size and grid settings) are saved in the maker's Notion workspace. Nothing else from
					Griddle is sent, and never your grid's images unless you add them as screenshots.
				</li>
				<li>
					<span class="font-medium">Updates.</span>
					Griddle checks for a newer version now and then, so it can offer a reload.
				</li>
			</ul>
			<p class="text-muted-foreground">
				Griddle is open source:
				<a class="text-foreground underline underline-offset-2" href="https://github.com/TomFrankly/griddle" target="_blank" rel="noreferrer">github.com/TomFrankly/griddle</a>
			</p>
		</div>
	</Dialog.Content>
</Dialog.Root>
