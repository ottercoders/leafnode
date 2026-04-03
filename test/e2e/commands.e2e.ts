describe("Command Palette", () => {
  it("should list Leafnode commands", async () => {
    const workbench = await browser.getWorkbench();
    const prompt = await workbench.openCommandPrompt();
    await prompt.setText(">Leafnode");
    await browser.pause(500);

    const picks = await prompt.getQuickPicks();
    const labels = await Promise.all(picks.map((p) => p.getLabel()));

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((l) => l.includes("Add Connection"))).toBe(true);

    await browser.keys("Escape");
  });

  it("should have stream management commands", async () => {
    const workbench = await browser.getWorkbench();
    const prompt = await workbench.openCommandPrompt();
    await prompt.setText(">Leafnode: Create Stream");
    await browser.pause(500);

    const picks = await prompt.getQuickPicks();
    const labels = await Promise.all(picks.map((p) => p.getLabel()));
    const hasCreate = labels.some((l) => l.includes("Create Stream"));

    await browser.keys("Escape");
    expect(hasCreate).toBe(true);
  });

  it("should have KV management commands", async () => {
    const workbench = await browser.getWorkbench();
    const prompt = await workbench.openCommandPrompt();
    await prompt.setText(">Leafnode: Create Bucket");
    await browser.pause(500);

    const picks = await prompt.getQuickPicks();
    const labels = await Promise.all(picks.map((p) => p.getLabel()));
    const hasBucket = labels.some((l) => l.includes("Create Bucket"));

    await browser.keys("Escape");
    expect(hasBucket).toBe(true);
  });
});
