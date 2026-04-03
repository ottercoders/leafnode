import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "dist/test/e2e/**/*.test.js",
  mocha: {
    timeout: 30000,
    reporter: "mocha-junit-reporter",
    reporterOptions: {
      mochaFile: "./test-results/e2e.xml",
    },
  },
});
