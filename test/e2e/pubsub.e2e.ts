import { openLeafnodeSidebar } from "./setup.e2e";

const SCREENSHOTS = "./test/screenshots";

describe("Pub/Sub Panel", () => {
  before(async () => {
    await openLeafnodeSidebar();
  });

  it("should have the openPubSub command registered", async () => {
    const exists = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) => cmds.includes("leafnode.openPubSub"));
    });
    expect(exists).toBe(true);
  });

  it("should have all pub/sub related commands", async () => {
    const commands = await browser.executeWorkbench((vscode) => {
      return vscode.commands.getCommands(true).then((cmds: string[]) =>
        cmds.filter((c: string) => c.startsWith("leafnode.")),
      );
    });
    expect(commands).toContain("leafnode.openPubSub");
  });
});
