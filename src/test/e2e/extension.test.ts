import * as assert from "assert";
import * as vscode from "vscode";

suite("Leafnode Extension", () => {
  suiteSetup(async () => {
    // Wait for extension to activate
    const ext = vscode.extensions.getExtension("ottercoders.leafnode");
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    // Give it a moment to register everything
    await new Promise((r) => setTimeout(r, 2000));
  });

  suite("Activation", () => {
    test("extension should be present", () => {
      const ext = vscode.extensions.getExtension("ottercoders.leafnode");
      assert.ok(ext, "Extension not found");
    });

    test("extension should activate", async () => {
      const ext = vscode.extensions.getExtension("ottercoders.leafnode");
      assert.ok(ext);
      if (!ext.isActive) {
        await ext.activate();
      }
      assert.ok(ext.isActive, "Extension did not activate");
    });
  });

  suite("Command Registration", () => {
    let commands: string[];

    suiteSetup(async () => {
      const allCommands = await vscode.commands.getCommands(true);
      commands = allCommands.filter((c) => c.startsWith("leafnode."));
    });

    test("should register connection commands", () => {
      assert.ok(commands.includes("leafnode.addConnection"));
      assert.ok(commands.includes("leafnode.editConnection"));
      assert.ok(commands.includes("leafnode.connect"));
      assert.ok(commands.includes("leafnode.disconnect"));
      assert.ok(commands.includes("leafnode.removeConnection"));
      assert.ok(commands.includes("leafnode.importNatsContext"));
    });

    test("should register stream commands", () => {
      assert.ok(commands.includes("leafnode.streams.refresh"));
      assert.ok(commands.includes("leafnode.streams.browseMessages"));
      assert.ok(commands.includes("leafnode.streams.create"));
      assert.ok(commands.includes("leafnode.streams.edit"));
      assert.ok(commands.includes("leafnode.streams.duplicate"));
      assert.ok(commands.includes("leafnode.streams.purge"));
      assert.ok(commands.includes("leafnode.streams.delete"));
      assert.ok(commands.includes("leafnode.streams.seal"));
    });

    test("should register consumer commands", () => {
      assert.ok(commands.includes("leafnode.consumers.create"));
      assert.ok(commands.includes("leafnode.consumers.delete"));
      assert.ok(commands.includes("leafnode.consumers.pause"));
      assert.ok(commands.includes("leafnode.consumers.resume"));
    });

    test("should register KV commands", () => {
      assert.ok(commands.includes("leafnode.kv.refresh"));
      assert.ok(commands.includes("leafnode.kv.viewEntry"));
      assert.ok(commands.includes("leafnode.kv.deleteKey"));
      assert.ok(commands.includes("leafnode.kv.createBucket"));
      assert.ok(commands.includes("leafnode.kv.deleteBucket"));
      assert.ok(commands.includes("leafnode.kv.purgeKey"));
      assert.ok(commands.includes("leafnode.kv.createKey"));
      assert.ok(commands.includes("leafnode.kv.keyHistory"));
    });

    test("should register object store commands", () => {
      assert.ok(commands.includes("leafnode.obj.refresh"));
      assert.ok(commands.includes("leafnode.obj.viewObject"));
      assert.ok(commands.includes("leafnode.obj.deleteObject"));
    });

    test("should register utility commands", () => {
      assert.ok(commands.includes("leafnode.openPubSub"));
      assert.ok(commands.includes("leafnode.openServerMonitor"));
      assert.ok(commands.includes("leafnode.subjects.refresh"));
      assert.ok(commands.includes("leafnode.runNatsCommand"));
      assert.ok(commands.includes("leafnode.workspace.init"));
    });

    test("should have 30+ commands total", () => {
      assert.ok(
        commands.length >= 30,
        `Expected 30+ commands, got ${commands.length}: ${commands.join(", ")}`,
      );
    });
  });

  suite("Tree Views", () => {
    test("should refresh streams without error", async () => {
      await vscode.commands.executeCommand("leafnode.streams.refresh");
    });

    test("should refresh KV without error", async () => {
      await vscode.commands.executeCommand("leafnode.kv.refresh");
    });

    test("should refresh objects without error", async () => {
      await vscode.commands.executeCommand("leafnode.obj.refresh");
    });

    test("should refresh subjects without error", async () => {
      await vscode.commands.executeCommand("leafnode.subjects.refresh");
    });
  });
});
