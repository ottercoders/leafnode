<script lang="ts">
  interface Props {
    status: "success" | "warning" | "error" | "info";
    label: string;
  }

  let { status, label }: Props = $props();
</script>

<span class="badge {status}">{label}</span>
