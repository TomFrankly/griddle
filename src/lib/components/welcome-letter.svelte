<!--
  @component
  A short letter from the maker, shown once on the first visit and again from the info menu.
  On wide screens an animation of Griddle at work plays beside it.
-->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PlayIcon from '@lucide/svelte/icons/play';
	import ShowcaseStory from './showcase-story.svelte';
	import { TOUR_VIDEO_URL } from '$lib/site';
	import portrait from '../../assets/welcome/thomas.webp';
	import signature from '../../assets/welcome/signature.svg?raw';

	let { open = $bindable(false) }: { open: boolean } = $props();
	let startButton = $state<HTMLElement | null>(null);
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="welcome gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl sm:max-w-md md:grid md:max-w-[900px] md:grid-cols-[1fr_1fr] data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-bottom-6 data-[state=open]:duration-500 data-[state=open]:ease-[cubic-bezier(.2,.8,.2,1)]"
		data-testid="welcome-letter"
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			startButton?.focus();
		}}
	>
		<div class="bg-muted hidden items-center justify-center p-6 md:flex">
			{#if open}<ShowcaseStory />{/if}
		</div>

		<div class="flex flex-col justify-between gap-6 p-8 md:p-10">
			<div class="letter">
				<Dialog.Title class="font-letter text-[28px] leading-tight font-medium tracking-tight">Build Image Grids Without the Fuss.</Dialog.Title>
				<p>Hi there! My name’s Thomas Frank, and this is Griddle—a tool for quickly building image grids (and even funky bento grids).</p>
				<p>
					Drag in a bunch of images to create a grid automatically, or start with a blank one and add images one by one. When you’re done, you
					can export to a variety of formats.
				</p>
				<p>I built this for my wife so she wouldn’t have to build grids in Photoshop anymore. You get to use it for free, and you don’t even have to marry me.</p>
				<div class="flex items-center gap-3 pt-1">
					<img src={portrait} alt="Thomas Frank" class="size-14 shrink-0 rounded-full object-cover" />
					<span class="signature" role="img" aria-label="Thomas">{@html signature}</span>
				</div>
			</div>
			<div class="actions flex items-center justify-end gap-2">
				{#if TOUR_VIDEO_URL}
					<Button variant="ghost" href={TOUR_VIDEO_URL} target="_blank" rel="noopener" data-testid="welcome-tour">
						<PlayIcon />Show me around
					</Button>
				{/if}
				<Button bind:ref={startButton} onclick={() => (open = false)} data-testid="welcome-start">Make a grid</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.letter {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		font-family: var(--font-letter);
		font-size: 16.5px;
		line-height: 1.55;
	}
	.signature {
		display: block;
		width: 190px;
		color: color-mix(in srgb, var(--foreground) 82%, #1b3a8a);
	}
	.signature :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}

	/* The letter fades up line by line after the card rises, then the signature writes itself. */
	:global(.welcome[data-state='open']) .letter > :global(*),
	:global(.welcome[data-state='open']) .actions {
		animation: rise 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	:global(.welcome[data-state='open']) .letter > :global(*:nth-child(1)) {
		animation-delay: 0.25s;
	}
	:global(.welcome[data-state='open']) .letter > :global(*:nth-child(2)) {
		animation-delay: 0.33s;
	}
	:global(.welcome[data-state='open']) .letter > :global(*:nth-child(3)) {
		animation-delay: 0.41s;
	}
	:global(.welcome[data-state='open']) .letter > :global(*:nth-child(4)) {
		animation-delay: 0.49s;
	}
	:global(.welcome[data-state='open']) .letter > :global(*:nth-child(5)) {
		animation-delay: 0.57s;
	}
	:global(.welcome[data-state='open']) .actions {
		animation-delay: 1.3s;
	}
	:global(.welcome[data-state='open']) .signature {
		animation: write 1.4s cubic-bezier(0.45, 0.05, 0.4, 1) 0.8s both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}
	@keyframes write {
		from {
			clip-path: inset(0 100% 0 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.welcome[data-state='open']) .letter > :global(*),
		:global(.welcome[data-state='open']) .actions,
		:global(.welcome[data-state='open']) .signature {
			animation: none;
		}
	}
</style>
