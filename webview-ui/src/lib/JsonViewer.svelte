<script lang="ts">
  interface Props {
    data: unknown;
    expanded?: boolean;
    depth?: number;
    maxDepth?: number;
  }

  let { data, expanded = true, depth = 0, maxDepth = 6 }: Props = $props();
  let isExpanded = $state(expanded && depth < 2);

  let isObject = $derived(data !== null && typeof data === "object" && !Array.isArray(data));
  let isArray = $derived(Array.isArray(data));
  let entries = $derived(
    isObject ? Object.entries(data as Record<string, unknown>) :
    isArray ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown]) :
    []
  );
  let preview = $derived(
    isObject ? `{${entries.length}}` :
    isArray ? `[${entries.length}]` :
    ""
  );

  function toggle() { isExpanded = !isExpanded; }

  function typeClass(val: unknown): string {
    if (val === null) return "null";
    if (typeof val === "string") return "string";
    if (typeof val === "number") return "number";
    if (typeof val === "boolean") return "boolean";
    return "";
  }

  function formatValue(val: unknown): string {
    if (val === null) return "null";
    if (typeof val === "string") return `"${val}"`;
    return String(val);
  }
</script>

{#if isObject || isArray}
  {#if depth < maxDepth}
    <span class="toggle" onclick={toggle} role="button" tabindex="0" onkeydown={(e) => e.key === "Enter" && toggle()}>
      <span class="arrow" class:open={isExpanded}>&#9656;</span>
      <span class="preview">{isArray ? "Array" : "Object"} {preview}</span>
    </span>
    {#if isExpanded}
      <div class="entries" style="padding-left: {depth > 0 ? 16 : 0}px">
        {#each entries as [key, val]}
          <div class="entry">
            <span class="key">{key}:</span>
            {#if val !== null && typeof val === "object"}
              <svelte:self data={val} depth={depth + 1} {maxDepth} />
            {:else}
              <span class="value {typeClass(val)}">{formatValue(val)}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <span class="preview">{JSON.stringify(data)}</span>
  {/if}
{:else}
  <span class="value {typeClass(data)}">{formatValue(data)}</span>
{/if}

<style>
  .toggle { cursor: pointer; user-select: none; display: inline-flex; align-items: center; gap: 4px; }
  .arrow { display: inline-block; transition: transform 0.15s; font-size: 0.8em; }
  .arrow.open { transform: rotate(90deg); }
  .preview { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
  .entries { border-left: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2)); margin-left: 4px; }
  .entry { padding: 1px 0; font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  .key { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); margin-right: 4px; }
  .value.string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
  .value.number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
  .value.boolean { color: var(--vscode-debugTokenExpression-boolean, #569cd6); }
  .value.null { color: var(--vscode-descriptionForeground); font-style: italic; }
</style>
