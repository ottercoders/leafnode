import * as assert from "assert";
import * as vscode from "vscode";

// LeafnodeAPI is exported from the extension's activate()
interface LeafnodeAPI {
  panelManager: {
    createOrShow(
      panelId: string,
      title: string,
      webviewEntry: string,
      column?: vscode.ViewColumn,
    ): vscode.WebviewPanel;
  };
}

suite("Leafnode Extension", () => {
  let api: LeafnodeAPI;

  suiteSetup(async function () {
    this.timeout(30000);
    const ext = vscode.extensions.getExtension("ottercoders.leafnode");
    assert.ok(ext, "Extension not found");
    api = (await ext.activate()) as LeafnodeAPI;
    // Give tree views time to register
    await new Promise((r) => setTimeout(r, 1000));
  });

  suite("Activation", () => {
    test("extension should be present and active", () => {
      const ext = vscode.extensions.getExtension("ottercoders.leafnode");
      assert.ok(ext);
      assert.ok(ext.isActive);
    });

    test("should register 30+ leafnode commands", async () => {
      const allCommands = await vscode.commands.getCommands(true);
      const leafnodeCommands = allCommands.filter((c) => c.startsWith("leafnode."));
      assert.ok(
        leafnodeCommands.length >= 30,
        `Expected 30+ commands, got ${leafnodeCommands.length}`,
      );
    });
  });

  suite("Command Registration", () => {
    let commands: string[];

    suiteSetup(async () => {
      const allCommands = await vscode.commands.getCommands(true);
      commands = allCommands.filter((c) => c.startsWith("leafnode."));
    });

    test("connection commands", () => {
      for (const cmd of [
        "addConnection", "editConnection", "connect",
        "disconnect", "removeConnection", "importNatsContext",
      ]) {
        assert.ok(commands.includes(`leafnode.${cmd}`), `Missing leafnode.${cmd}`);
      }
    });

    test("stream commands", () => {
      for (const cmd of [
        "streams.refresh", "streams.browseMessages", "streams.create",
        "streams.edit", "streams.duplicate", "streams.purge",
        "streams.delete", "streams.seal",
      ]) {
        assert.ok(commands.includes(`leafnode.${cmd}`), `Missing leafnode.${cmd}`);
      }
    });

    test("consumer commands", () => {
      for (const cmd of [
        "consumers.create", "consumers.delete",
        "consumers.pause", "consumers.resume",
      ]) {
        assert.ok(commands.includes(`leafnode.${cmd}`), `Missing leafnode.${cmd}`);
      }
    });

    test("KV commands", () => {
      for (const cmd of [
        "kv.refresh", "kv.viewEntry", "kv.deleteKey",
        "kv.createBucket", "kv.deleteBucket", "kv.purgeKey",
        "kv.createKey", "kv.keyHistory",
      ]) {
        assert.ok(commands.includes(`leafnode.${cmd}`), `Missing leafnode.${cmd}`);
      }
    });

    test("object store commands", () => {
      for (const cmd of ["obj.refresh", "obj.viewObject", "obj.deleteObject"]) {
        assert.ok(commands.includes(`leafnode.${cmd}`), `Missing leafnode.${cmd}`);
      }
    });

    test("utility commands", () => {
      for (const cmd of [
        "openPubSub", "openServerMonitor",
        "subjects.refresh", "runNatsCommand", "workspace.init",
      ]) {
        assert.ok(commands.includes(`leafnode.${cmd}`), `Missing leafnode.${cmd}`);
      }
    });
  });

  suite("Tree Views", () => {
    test("refresh streams without error", async () => {
      await vscode.commands.executeCommand("leafnode.streams.refresh");
    });

    test("refresh KV without error", async () => {
      await vscode.commands.executeCommand("leafnode.kv.refresh");
    });

    test("refresh objects without error", async () => {
      await vscode.commands.executeCommand("leafnode.obj.refresh");
    });

    test("refresh subjects without error", async () => {
      await vscode.commands.executeCommand("leafnode.subjects.refresh");
    });
  });

  suite("Webview Panels", () => {
    test("message-browser panel loads with content", () => {
      const panel = api.panelManager.createOrShow(
        "test:message-browser",
        "Test Messages",
        "message-browser",
      );
      assert.ok(panel.webview.html.length > 100, "Webview HTML is empty or too short");
      assert.ok(
        panel.webview.html.includes("Content-Security-Policy"),
        "Missing CSP header",
      );
      assert.ok(
        !panel.webview.html.includes('rel="modulepreload"'),
        "modulepreload links should be stripped",
      );
      assert.ok(
        !panel.webview.html.includes("crossorigin"),
        "crossorigin attributes should be stripped",
      );
      assert.ok(
        panel.webview.html.includes("nonce="),
        "Scripts should have nonce attribute",
      );
      panel.dispose();
    });

    test("pub-sub panel loads with content", () => {
      const panel = api.panelManager.createOrShow(
        "test:pub-sub",
        "Test Pub/Sub",
        "pub-sub",
      );
      assert.ok(panel.webview.html.length > 100, "Webview HTML is empty");
      assert.ok(
        panel.webview.html.includes("Content-Security-Policy"),
        "Missing CSP",
      );
      assert.ok(
        !panel.webview.html.includes('rel="modulepreload"'),
        "modulepreload not stripped",
      );
      panel.dispose();
    });

    test("kv-editor panel loads with content", () => {
      const panel = api.panelManager.createOrShow(
        "test:kv-editor",
        "Test KV",
        "kv-editor",
      );
      assert.ok(panel.webview.html.length > 100, "Webview HTML is empty");
      assert.ok(
        !panel.webview.html.includes("crossorigin"),
        "crossorigin not stripped",
      );
      panel.dispose();
    });

    test("obj-viewer panel loads with content", () => {
      const panel = api.panelManager.createOrShow(
        "test:obj-viewer",
        "Test Objects",
        "obj-viewer",
      );
      assert.ok(panel.webview.html.length > 100, "Webview HTML is empty");
      panel.dispose();
    });

    test("server-monitor panel loads with content", () => {
      const panel = api.panelManager.createOrShow(
        "test:server-monitor",
        "Test Monitor",
        "server-monitor",
      );
      assert.ok(panel.webview.html.length > 100, "Webview HTML is empty");
      assert.ok(
        panel.webview.html.includes("nonce="),
        "Scripts missing nonce",
      );
      panel.dispose();
    });

    test("webview HTML has correct structure", () => {
      const panel = api.panelManager.createOrShow(
        "test:structure",
        "Test Structure",
        "pub-sub",
      );
      const html = panel.webview.html;

      // Should have exactly one script tag (entry point) with nonce
      const scriptMatches = html.match(/<script\b[^>]*>/g) || [];
      assert.ok(scriptMatches.length >= 1, "Should have at least one script tag");
      for (const tag of scriptMatches) {
        assert.ok(tag.includes("nonce="), `Script tag missing nonce: ${tag}`);
      }

      // Should have stylesheet links with vscode-resource URIs
      const linkMatches = html.match(/href="[^"]*vscode[^"]*\.css"/g) || [];
      assert.ok(linkMatches.length >= 1, "Should have CSS links with vscode URIs");

      // Should have the app mount point
      assert.ok(html.includes('<div id="app">'), "Missing #app mount point");

      panel.dispose();
    });
  });
});
