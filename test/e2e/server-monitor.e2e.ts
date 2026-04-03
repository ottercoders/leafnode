import { executeCommand, openWebview } from "./setup.e2e";

const SCREENSHOTS = "./test/screenshots";

describe("Server Monitor Panel", () => {
  it("should have the openServerMonitor command registered", async () => {
    // Verify the command exists without executing it
    // (executing it without a connection causes a warning dialog that blocks)
    const exists = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) => cmds.includes("leafnode.openServerMonitor"));
    });
    expect(exists).toBe(true);
  });
});
