/**
 * Leafnode E2E tests — all in one file so only one VS Code instance starts.
 * Each describe block tests a different area.
 */

const SCREENSHOTS = "./test/screenshots";

describe("Leafnode Extension", () => {
  describe("Activation", () => {
    it("should register all leafnode commands", async () => {
      const commands: string[] = await browser.executeWorkbench(
        (vscode) => {
          return vscode.commands
            .getCommands(true)
            .then((cmds: string[]) =>
              cmds.filter((c: string) => c.startsWith("leafnode.")),
            );
        },
      );

      expect(commands.length).toBeGreaterThan(20);
      await browser.saveScreenshot(`${SCREENSHOTS}/activation.png`);
    });

    it("should show Leafnode in command palette", async () => {
      const workbench = await browser.getWorkbench();
      const prompt = await workbench.openCommandPrompt();
      await prompt.setText(">Leafnode");
      await browser.pause(1000);

      const picks = await prompt.getQuickPicks();
      expect(picks.length).toBeGreaterThan(0);

      await browser.saveScreenshot(`${SCREENSHOTS}/command-palette.png`);
      await browser.keys("Escape");
    });
  });

  describe("Connection Commands", () => {
    it("should have connection commands", async () => {
      const commands: string[] = await browser.executeWorkbench(
        (vscode) => {
          return vscode.commands
            .getCommands(true)
            .then((cmds: string[]) =>
              cmds.filter((c: string) => c.startsWith("leafnode.")),
            );
        },
      );

      expect(commands).toContain("leafnode.addConnection");
      expect(commands).toContain("leafnode.editConnection");
      expect(commands).toContain("leafnode.connect");
      expect(commands).toContain("leafnode.disconnect");
      expect(commands).toContain("leafnode.removeConnection");
      expect(commands).toContain("leafnode.importNatsContext");
    });
  });

  describe("Stream Commands", () => {
    it("should have stream and consumer commands", async () => {
      const commands: string[] = await browser.executeWorkbench(
        (vscode) => {
          return vscode.commands
            .getCommands(true)
            .then((cmds: string[]) =>
              cmds.filter((c: string) =>
                c.startsWith("leafnode.streams.") ||
                c.startsWith("leafnode.consumers."),
              ),
            );
        },
      );

      expect(commands).toContain("leafnode.streams.refresh");
      expect(commands).toContain("leafnode.streams.browseMessages");
      expect(commands).toContain("leafnode.streams.create");
      expect(commands).toContain("leafnode.streams.edit");
      expect(commands).toContain("leafnode.streams.purge");
      expect(commands).toContain("leafnode.streams.delete");
      expect(commands).toContain("leafnode.streams.seal");
      expect(commands).toContain("leafnode.consumers.create");
      expect(commands).toContain("leafnode.consumers.delete");
      expect(commands).toContain("leafnode.consumers.pause");
      expect(commands).toContain("leafnode.consumers.resume");
    });
  });

  describe("KV Commands", () => {
    it("should have KV commands", async () => {
      const commands: string[] = await browser.executeWorkbench(
        (vscode) => {
          return vscode.commands
            .getCommands(true)
            .then((cmds: string[]) =>
              cmds.filter((c: string) => c.startsWith("leafnode.kv.")),
            );
        },
      );

      expect(commands).toContain("leafnode.kv.refresh");
      expect(commands).toContain("leafnode.kv.viewEntry");
      expect(commands).toContain("leafnode.kv.deleteKey");
      expect(commands).toContain("leafnode.kv.createBucket");
      expect(commands).toContain("leafnode.kv.deleteBucket");
      expect(commands).toContain("leafnode.kv.purgeKey");
      expect(commands).toContain("leafnode.kv.createKey");
      expect(commands).toContain("leafnode.kv.keyHistory");
    });
  });

  describe("Object Store Commands", () => {
    it("should have object store commands", async () => {
      const commands: string[] = await browser.executeWorkbench(
        (vscode) => {
          return vscode.commands
            .getCommands(true)
            .then((cmds: string[]) =>
              cmds.filter((c: string) => c.startsWith("leafnode.obj.")),
            );
        },
      );

      expect(commands).toContain("leafnode.obj.refresh");
      expect(commands).toContain("leafnode.obj.viewObject");
      expect(commands).toContain("leafnode.obj.deleteObject");
    });
  });

  describe("Utility Commands", () => {
    it("should have monitoring, CLI, and workspace commands", async () => {
      const commands: string[] = await browser.executeWorkbench(
        (vscode) => {
          return vscode.commands
            .getCommands(true)
            .then((cmds: string[]) =>
              cmds.filter((c: string) => c.startsWith("leafnode.")),
            );
        },
      );

      expect(commands).toContain("leafnode.openPubSub");
      expect(commands).toContain("leafnode.openServerMonitor");
      expect(commands).toContain("leafnode.subjects.refresh");
      expect(commands).toContain("leafnode.runNatsCommand");
      expect(commands).toContain("leafnode.workspace.init");
    });
  });
});
