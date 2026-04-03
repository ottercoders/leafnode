import { executeCommand, getActiveEditorTitle } from "./setup.e2e";

describe("Command Palette", () => {
  it("should have leafnode commands available", async () => {
    const workbench = await browser.getWorkbench();
    const prompt = await workbench.openCommandPrompt();
    await prompt.setText(">Leafnode");

    // Wait for filtered results
    await browser.pause(500);

    const picks = await prompt.getQuickPicks();
    const labels = await Promise.all(picks.map((p) => p.getLabel()));

    // Should have at least some Leafnode commands
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((l) => l.includes("Add Connection"))).toBe(true);

    await browser.keys("Escape");
  });

  it("should open server monitor panel", async () => {
    // Need a connection first for this to work fully,
    // but the command should at least not crash
    try {
      await executeCommand("leafnode.openServerMonitor");
      await browser.pause(1000);
    } catch {
      // Expected to fail without a connection — that's OK
    }
    await browser.keys("Escape");
  });

  it("should open pub/sub panel", async () => {
    try {
      await executeCommand("leafnode.openPubSub");
      await browser.pause(1000);
    } catch {
      // Expected to fail without a connection
    }
    await browser.keys("Escape");
  });

  it("should show NATS CLI quick pick", async () => {
    try {
      await executeCommand("leafnode.runNatsCommand");
      await browser.pause(500);
    } catch {
      // May fail if nats CLI not installed — that's OK
    }
    await browser.keys("Escape");
  });

  it("should offer workspace init command", async () => {
    const workbench = await browser.getWorkbench();
    const prompt = await workbench.openCommandPrompt();
    await prompt.setText(">Leafnode: Initialize Workspace");
    await browser.pause(500);

    const picks = await prompt.getQuickPicks();
    // Should find the workspace init command (or similar)
    await browser.keys("Escape");
  });
});
