<script lang="ts">
  import CopyButton from "./CopyButton.svelte";

  interface Props {
    label: string;
    value: string;
    mono?: boolean;
    copyable?: boolean;
  }

  let { label, value, mono = false, copyable = false }: Props = $props();
</script>

<div class="kv-row">
  <dt class="kv-label">{label}</dt>
  <dd class="kv-value" class:mono>
    {value}
    {#if copyable}
      <CopyButton text={value} />
    {/if}
  </dd>
</div>

<style>
  .kv-row { display: flex; align-items: baseline; gap: var(--space-2, 8px); padding: 3px 0; }
  .kv-label { color: var(--vscode-descriptionForeground); font-size: 0.85em; min-width: 90px; flex-shrink: 0; }
  .kv-value { display: flex; align-items: center; gap: 4px; word-break: break-all; }
  .mono { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
</style>
