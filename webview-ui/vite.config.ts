import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: "../dist/webview",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "message-browser": resolve(__dirname, "message-browser.html"),
        "pub-sub": resolve(__dirname, "pub-sub.html"),
        "kv-editor": resolve(__dirname, "kv-editor.html"),
      },
      output: {
        entryFileNames: "[name]/[name].js",
        chunkFileNames: "shared/[name]-[hash].js",
        assetFileNames: "[name]/[name].[ext]",
      },
    },
  },
});
