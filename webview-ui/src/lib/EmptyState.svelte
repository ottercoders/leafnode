<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    state: "loading" | "empty" | "error";
    message: string;
    action?: Snippet;
  }

  let { state, message, action }: Props = $props();

  const icons: Record<string, string> = {
    loading: "&#8987;",
    empty: "&#128193;",
    error: "&#9888;",
  };
</script>

<div class="empty-state">
  <span class="icon">{@html icons[state]}</span>
  <p>{message}</p>
  {#if action}
    {@render action()}
  {/if}
</div>
