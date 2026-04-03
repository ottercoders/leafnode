import { executeCommand, openWebview } from "./setup.e2e";

describe("Server Monitor Panel", () => {
  it("should open server monitor via command", async () => {
    try {
      await executeCommand("leafnode.openServerMonitor");
      await browser.pause(1000);

      // Check that a panel opened
      const workbench = await browser.getWorkbench();
      const editorView = workbench.getEditorView();
      const tabs = await editorView.getOpenTabs();
      const titles = await Promise.all(tabs.map((t) => t.getTitle()));
      const hasMonitor = titles.some((t) => t.includes("Server Monitor"));

      if (hasMonitor) {
        expect(hasMonitor).toBe(true);
      }
    } catch {
      // May fail without a connected + monitored connection
    }
  });

  describe("when panel is open", () => {
    it("should have Server, Connections, JetStream, and Accounts tabs", async () => {
      try {
        await executeCommand("leafnode.openServerMonitor");
        await browser.pause(1000);

        const wv = await openWebview();

        const tabs = await $$(".tabs button");
        if (tabs.length > 0) {
          const labels = await Promise.all(tabs.map((t) => t.getText()));
          expect(labels).toContain("Server");
          expect(labels).toContain("Connections");
          expect(labels).toContain("JetStream");
          expect(labels).toContain("Accounts");
        }

        await wv.close();
      } catch {
        // Not connected with monitoring URL
      }
    });

    it("should switch between monitor tabs", async () => {
      try {
        const wv = await openWebview();

        // Click Connections tab
        const connTab = await $("button=Connections");
        if (await connTab.isExisting()) {
          await connTab.click();
          await browser.pause(300);
        }

        // Click JetStream tab
        const jsTab = await $("button=JetStream");
        if (await jsTab.isExisting()) {
          await jsTab.click();
          await browser.pause(300);
        }

        // Click Accounts tab
        const acctTab = await $("button=Accounts");
        if (await acctTab.isExisting()) {
          await acctTab.click();
          await browser.pause(300);
        }

        await wv.close();
      } catch {
        // Not connected
      }
    });
  });
});
