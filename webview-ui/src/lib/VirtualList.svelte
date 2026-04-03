<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    items: unknown[];
    itemHeight: number;
    children: Snippet<[{ item: unknown; index: number }]>;
    totalLabel?: string;
  }

  let { items, itemHeight, children, totalLabel }: Props = $props();

  let container: HTMLDivElement | undefined = $state();
  let scrollTop = $state(0);
  let containerHeight = $state(400);

  let totalHeight = $derived(items.length * itemHeight);
  let startIndex = $derived(Math.floor(scrollTop / itemHeight));
  let visibleCount = $derived(Math.ceil(containerHeight / itemHeight) + 1);
  let endIndex = $derived(Math.min(startIndex + visibleCount, items.length));
  let offsetY = $derived(startIndex * itemHeight);
  let visibleItems = $derived(items.slice(startIndex, endIndex));

  function onScroll() {
    if (container) {
      scrollTop = container.scrollTop;
    }
  }

  $effect(() => {
    if (container) {
      const observer = new ResizeObserver((entries) => {
        containerHeight = entries[0].contentRect.height;
      });
      observer.observe(container);
      return () => observer.disconnect();
    }
  });
</script>

<div class="virtual-list" bind:this={container} onscroll={onScroll}>
  <div class="virtual-list-spacer" style="height: {totalHeight}px">
    <div class="virtual-list-content" style="transform: translateY({offsetY}px)">
      {#each visibleItems as item, i}
        <div class="virtual-list-item" style="height: {itemHeight}px">
          {@render children({ item, index: startIndex + i })}
        </div>
      {/each}
    </div>
  </div>
</div>
{#if totalLabel && items.length > 0}
  <div class="vl-count">{items.length} {totalLabel}</div>
{/if}

<style>
  .virtual-list {
    overflow: auto;
    flex: 1;
    min-height: 0;
  }
  .virtual-list-spacer {
    position: relative;
  }
  .virtual-list-content {
    position: absolute;
    width: 100%;
    left: 0;
    top: 0;
  }
  .virtual-list-item {
    overflow: hidden;
  }
  .vl-count { padding: 4px 8px; font-size: 0.8em; color: var(--vscode-descriptionForeground); text-align: right; flex-shrink: 0; }
</style>
