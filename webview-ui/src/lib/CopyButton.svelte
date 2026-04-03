<script lang="ts">
  interface Props {
    text: string;
    label?: string;
  }

  let { text, label = "Copy" }: Props = $props();
  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }
</script>

<button class="copy-btn icon-btn" onclick={copy} title={label}>
  {#if copied}
    <span class="check">&#10003;</span>
  {:else}
    <span class="icon">&#128203;</span>
  {/if}
</button>

<style>
  .copy-btn { font-size: 0.85em; }
  .check { color: var(--vscode-testing-iconPassed, #73c991); }
</style>
