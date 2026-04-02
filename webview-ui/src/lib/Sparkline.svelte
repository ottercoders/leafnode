<script lang="ts">
  let {
    values,
    width = 100,
    height = 20,
    color = "var(--vscode-charts-blue)",
  }: {
    values: number[];
    width?: number;
    height?: number;
    color?: string;
  } = $props();

  let points = $derived.by(() => {
    if (values.length === 0) return "";
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    return values
      .map((v, i) => {
        const x = (i / Math.max(values.length - 1, 1)) * width;
        const y = height - ((v - min) / range) * (height - 2) - 1;
        return `${x},${y}`;
      })
      .join(" ");
  });
</script>

<svg {width} {height}>
  <polyline {points} fill="none" stroke={color} stroke-width="1.5" />
</svg>
