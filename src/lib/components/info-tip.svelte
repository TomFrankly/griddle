<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import InfoIcon from '@lucide/svelte/icons/info';

	let { text }: { text: string } = $props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger
		class="text-muted-foreground hover:text-foreground inline-flex size-4 items-center justify-center"
		aria-label={text}
	>
		<InfoIcon class="size-3.5" />
	</Tooltip.Trigger>
	<Tooltip.Content>{text}</Tooltip.Content>
</Tooltip.Root>
