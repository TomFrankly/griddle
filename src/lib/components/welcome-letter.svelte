<!--
  @component
  A short letter from the maker, shown once on the first visit and again from the info menu.
  On wide screens a carousel of sample grids plays beside it.
-->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { TOUR_VIDEO_URL } from '$lib/site';
	import portrait from '../../assets/welcome/thomas.webp';
	import signature from '../../assets/welcome/signature.svg?raw';

	let { open = $bindable(false) }: { open: boolean } = $props();

	const files = import.meta.glob('../../assets/showcase/*.webp', {
		eager: true,
		query: '?url',
		import: 'default'
	}) as Record<string, string>;
	const NAMES: Record<string, string> = {
		poses: 'Simple grid',
		bento: 'Bento',
		polaroid: 'Captions',
		proof: 'Proof sheet'
	};
	const slides = Object.entries(files)
		.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
		.map(([path, src]) => {
			const key = path.split('/').pop()!.replace(/^\d+-|\.webp$/g, '');
			return { src, name: NAMES[key] ?? key };
		});

	const INTERVAL = 3800;
	let index = $state(0);
	let paused = $state(false);
	let startButton = $state<HTMLElement | null>(null);
	const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		if (!open || paused || reduceMotion || slides.length < 2) return;
		void index;
		const t = setTimeout(() => (index = (index + 1) % slides.length), INTERVAL);
		return () => clearTimeout(t);
	});
	$effect(() => {
		if (open) index = 0;
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="welcome gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl sm:max-w-md md:grid md:max-w-[880px] md:grid-cols-[1fr_1fr] data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-bottom-6 data-[state=open]:duration-500 data-[state=open]:ease-[cubic-bezier(.2,.8,.2,1)]"
		data-testid="welcome-letter"
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			startButton?.focus();
		}}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-muted relative hidden flex-col md:flex"
			onpointerenter={() => (paused = true)}
			onpointerleave={() => (paused = false)}
			data-testid="welcome-carousel"
		>
			<div class="relative min-h-0 flex-1 overflow-hidden">
				<div class="track flex h-full" style:transform="translateX(-{index * 100}%)">
					{#each slides as s, i (s.src)}
						<div class="flex h-full w-full shrink-0 items-center justify-center p-8" aria-hidden={i !== index}>
							<img src={s.src} alt="{s.name} example" class="max-h-full max-w-full object-contain shadow-md" draggable="false" />
						</div>
					{/each}
				</div>
			</div>
			<div class="flex items-center justify-between gap-3 px-6 pb-5">
				<span class="text-muted-foreground text-xs" aria-live="polite">{slides[index]?.name}</span>
				<div class="flex gap-1.5">
					{#each slides as s, i (s.src)}
						<button
							type="button"
							class="dot"
							class:on={i === index}
							aria-label="Show {s.name}"
							aria-current={i === index}
							onclick={() => (index = i)}
						></button>
					{/each}
				</div>
			</div>
		</div>

		<div class="flex flex-col justify-between gap-6 p-8 md:p-10">
			<div class="letter">
				<Dialog.Title class="font-letter text-[30px] leading-tight font-medium tracking-tight">Hi, I'm Thomas.</Dialog.Title>
				<p>I made Griddle to turn a pile of images into one clean grid. Drop them in, pick a layout, and download.</p>
				<p>It all runs in your browser, so your images never leave your computer.</p>
				<p>I hope it saves you some time. Have fun with it.</p>
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
		font-size: 17px;
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
	.track {
		transition: transform 0.8s cubic-bezier(0.65, 0, 0.35, 1);
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--foreground) 22%, transparent);
		transition:
			background 0.2s,
			width 0.3s;
	}
	.dot.on {
		width: 18px;
		border-radius: 4px;
		background: var(--foreground);
	}
	.dot:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
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
		.track {
			transition: none;
		}
		:global(.welcome[data-state='open']) .letter > :global(*),
		:global(.welcome[data-state='open']) .actions,
		:global(.welcome[data-state='open']) .signature {
			animation: none;
		}
	}
</style>
