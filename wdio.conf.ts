import type { Options } from "@wdio/types";
import * as fs from "fs";

const SCREENSHOTS_DIR = "./test/screenshots";

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
        workspacePath: __dirname,
        userSettings: {
          "leafnode.autoRefreshInterval": 0,
        },
        vscodeArgs: ["--disable-gpu"],
      },
    } as WebdriverIO.Capabilities,
  ],
  services: [
    [
      "vscode",
      {
        connectionTimeout: 30000,
        commandTimeout: 15000,
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
  waitforTimeout: 30000,

  before: async function () {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  },

  afterTest: async function (test, _context, { error }) {
    if (error) {
      const name = test.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await browser.saveScreenshot(`${SCREENSHOTS_DIR}/fail-${name}.png`);
    }
  },

  afterSuite: async function (suite) {
    const name = suite.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    try {
      await browser.saveScreenshot(`${SCREENSHOTS_DIR}/suite-${name}.png`);
    } catch {
      // May fail if browser already closed
    }
  },
};
