describe("Streams", () => {
  it("should have all stream commands registered", async () => {
    const commands = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) =>
          cmds.filter((c: string) => c.startsWith("leafnode.streams.")),
        );
    });

    expect(commands).toContain("leafnode.streams.refresh");
    expect(commands).toContain("leafnode.streams.browseMessages");
    expect(commands).toContain("leafnode.streams.create");
    expect(commands).toContain("leafnode.streams.edit");
    expect(commands).toContain("leafnode.streams.duplicate");
    expect(commands).toContain("leafnode.streams.purge");
    expect(commands).toContain("leafnode.streams.delete");
    expect(commands).toContain("leafnode.streams.seal");
  });

  it("should have all consumer commands registered", async () => {
    const commands = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) =>
          cmds.filter((c: string) => c.startsWith("leafnode.consumers.")),
        );
    });

    expect(commands).toContain("leafnode.consumers.create");
    expect(commands).toContain("leafnode.consumers.delete");
    expect(commands).toContain("leafnode.consumers.pause");
    expect(commands).toContain("leafnode.consumers.resume");
  });
});
