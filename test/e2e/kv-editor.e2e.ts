describe("KV Stores", () => {
  it("should have all KV commands registered", async () => {
    const commands = await browser.executeWorkbench((vscode) => {
      return vscode.commands
        .getCommands(true)
        .then((cmds: string[]) =>
          cmds.filter((c: string) => c.startsWith("leafnode.kv.")),
        );
    });

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
