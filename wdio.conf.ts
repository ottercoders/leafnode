import type { Options } from "@wdio/types";

export const config: Options.Testrunner = {
  runner: "local",
  tsConfigPath: "./tsconfig.json",
  specs: ["./test/e2e/**/*.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "vscode",
      browserVersion: "stable",
      "wdio:vscodeOptions": {
        extensionPath: __dirname,
        userSettings: {
          "leafnode.autoRefreshInterval": 0,
        },
      },
    } as WebdriverIO.Capabilities,
  ],
  services: ["vscode"],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
};
