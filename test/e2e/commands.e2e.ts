describe("Command Registration", () => {
  it("should have object store commands", async () => {
    const commands = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) =>
          cmds.filter((c: string) => c.startsWith("leafnode.obj.")),
        );
    });

    expect(commands).toContain("leafnode.obj.refresh");
    expect(commands).toContain("leafnode.obj.viewObject");
    expect(commands).toContain("leafnode.obj.deleteObject");
  });

  it("should have utility commands", async () => {
    const commands = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) =>
          cmds.filter((c: string) => c.startsWith("leafnode.")),
        );
    });

    expect(commands).toContain("leafnode.subjects.refresh");
    expect(commands).toContain("leafnode.runNatsCommand");
    expect(commands).toContain("leafnode.workspace.init");
  });
});
