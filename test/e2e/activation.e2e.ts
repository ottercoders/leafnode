const SCREENSHOTS = "./test/screenshots";

describe("Extension Activation", () => {
  it("should activate and register leafnode commands", async () => {
    const commands = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) =>
          cmds.filter((c: string) => c.startsWith("leafnode.")),
        );
    });

    expect(commands.length).toBeGreaterThan(10);
    expect(commands).toContain("leafnode.addConnection");
    expect(commands).toContain("leafnode.connect");
    expect(commands).toContain("leafnode.streams.refresh");
    expect(commands).toContain("leafnode.kv.refresh");
    expect(commands).toContain("leafnode.openPubSub");
    expect(commands).toContain("leafnode.openServerMonitor");

    await browser.saveScreenshot(`${SCREENSHOTS}/activation.png`);
  });

  it("should show Leafnode commands in command palette", async () => {
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
