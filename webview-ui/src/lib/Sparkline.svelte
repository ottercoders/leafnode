<script lang="ts">
  interface Props {
    values: number[];
    width?: number;
    height?: number;
    color?: string;
    showValue?: boolean;
    fill?: boolean;
  }

  let { values, width = 120, height = 28, color = "var(--vscode-charts-blue, #3794ff)", showValue = false, fill = true }: Props = $props();

  let points = $derived.by(() => {
    if (values.length < 2) return "";
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);
    return values.map((v, i) => `${i * stepX},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  });

  let fillPoints = $derived(
    points ? `0,${height} ${points} ${width},${height}` : ""
  );

  let lastValue = $derived(values.length > 0 ? values[values.length - 1] : 0);
</script>

<span class="sparkline-wrap">
  <svg viewBox="0 0 {width} {height}" preserveAspectRatio="none" class="sparkline">
    {#if fill && fillPoints}
      <polygon points={fillPoints} fill={color} opacity="0.15" />
    {/if}
    {#if points}
      <polyline points={points} fill="none" stroke={color} stroke-width="1.5" stroke-linejoin="round" />
    {/if}
  </svg>
  {#if showValue && values.length > 0}
    <span class="spark-value" style="color: {color}">{typeof lastValue === 'number' && lastValue > 1000 ? (lastValue / 1000).toFixed(1) + 'K' : lastValue}</span>
  {/if}
</span>

<style>
  .sparkline-wrap { display: inline-flex; align-items: center; gap: 6px; }
  .sparkline { width: 100%; max-width: 120px; height: 28px; }
  .spark-value { font-size: 0.8em; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
