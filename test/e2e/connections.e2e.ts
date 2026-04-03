describe("Connection Management", () => {
  it("should have all connection commands registered", async () => {
    const commands = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) =>
          cmds.filter((c: string) => c.startsWith("leafnode.")),
        );
    });

    expect(commands).toContain("leafnode.addConnection");
    expect(commands).toContain("leafnode.editConnection");
    expect(commands).toContain("leafnode.connect");
    expect(commands).toContain("leafnode.disconnect");
    expect(commands).toContain("leafnode.removeConnection");
    expect(commands).toContain("leafnode.importNatsContext");
  });
});
