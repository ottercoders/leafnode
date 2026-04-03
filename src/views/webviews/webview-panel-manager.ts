import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export class WebviewPanelManager implements vscode.Disposable {
  private panels = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly extensionUri: vscode.Uri) {}

  createOrShow(
    panelId: string,
    title: string,
    webviewEntry: string,
    column: vscode.ViewColumn = vscode.ViewColumn.One,
  ): vscode.WebviewPanel {
    const existing = this.panels.get(panelId);
    if (existing) {
      existing.reveal(column);
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      `leafnode.${webviewEntry}`,
      title,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "dist", "webview"),
        ],
      },
    );

    panel.webview.html = this.getWebviewContent(panel.webview, webviewEntry);

    panel.onDidDispose(() => {
      this.panels.delete(panelId);
    });

    this.panels.set(panelId, panel);
    return panel;
  }

  getPanel(panelId: string): vscode.WebviewPanel | undefined {
    return this.panels.get(panelId);
  }

  private getWebviewContent(
    webview: vscode.Webview,
    entry: string,
  ): string {
    const htmlPath = path.join(
      this.extensionUri.fsPath,
      "dist",
      "webview",
      `${entry}.html`,
    );

    let html = fs.readFileSync(htmlPath, "utf-8");

    const nonce = crypto.randomBytes(16).toString("hex");

    const webviewBase = vscode.Uri.joinPath(
      this.extensionUri,
      "dist",
      "webview",
    );

    // Rewrite all src/href paths to webview URIs
    html = html.replace(
      /(src|href)="\.?\/?([^"]+)"/g,
      (_match, attr, filePath) => {
        const uri = webview.asWebviewUri(
          vscode.Uri.joinPath(webviewBase, filePath),
        );
        return `${attr}="${uri}"`;
      },
    );

    // Remove modulepreload links — they're preload hints that don't work
    // with the vscode-webview:// scheme and cause CSP issues
    html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");

    // Remove crossorigin — not needed for webview-local resources
    // and causes issues in the sandboxed iframe
    html = html.replace(/\s+crossorigin/g, "");

    // Add nonce to all script tags (including type="module")
    html = html.replace(/<script\b/g, `<script nonce="${nonce}"`);

    // CSP: nonce for inline/entry scripts, cspSource for dynamically
    // imported module chunks loaded by the entry script at runtime
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    html = html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
    );

    return html;
  }

  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}
