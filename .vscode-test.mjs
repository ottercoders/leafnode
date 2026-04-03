import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "dist/test/e2e/**/*.test.js",
  mocha: {
    timeout: 30000,
  },
});
