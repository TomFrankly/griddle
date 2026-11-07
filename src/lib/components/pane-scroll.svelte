<!--
  A scrolling pane: a thin thumb in a reserved gutter on both sides (so section lines can stop
  short of it), and soft fades at the top and bottom while there's more to scroll.
  On narrow screens the pane is part of the page and doesn't scroll on its own.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children, testid }: { children: Snippet; testid?: string } = $props();

	let el = $state<HTMLDivElement>();
	let inner = $state<HTMLDivElement>();
	let above = $state(false);
	let below = $state(false);

	function update() {
		if (!el) return;
		above = el.scrollTop > 1;
		below = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
	}

	$effect(() => {
		if (!el || !inner) return;
		const ro = new ResizeObserver(update);
		ro.observe(el);
		ro.observe(inner);
		update();
		return () => ro.disconnect();
	});
</script>

<div class="relative md:min-h-0 md:flex-1">
	<div bind:this={el} class="pane-scroll md:absolute md:inset-0 md:overflow-y-auto" onscroll={update} data-testid={testid}>
		<!-- Room at the end so the help button in the corner never covers the last controls. -->
		<div bind:this={inner} class="pb-20">{@render children()}</div>
	</div>
	<div class="pane-fade top hidden md:block" class:on={above} aria-hidden="true"></div>
	<div class="pane-fade bottom hidden md:block" class:on={below} aria-hidden="true"></div>
</div>

<style>
	.pane-fade {
		position: absolute;
		left: 0;
		right: 0;
		height: 2rem;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.2s;
	}
	.pane-fade.on {
		opacity: 1;
	}
	.top {
		top: 0;
		background: linear-gradient(to bottom, var(--background), transparent);
	}
	.bottom {
		bottom: 0;
		background: linear-gradient(to top, var(--background), transparent);
	}
</style>
