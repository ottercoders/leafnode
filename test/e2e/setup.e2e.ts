/**
 * Shared E2E test helpers for Leafnode VS Code extension.
 */

/**
 * Open the Leafnode sidebar by clicking the NATS activity bar icon.
 */
export async function openLeafnodeSidebar(): Promise<void> {
  const workbench = await browser.getWorkbench();
  const activityBar = workbench.getActivityBar();

  // Try known view control names
  for (const name of ["NATS", "Leafnode"]) {
    try {
      const view = await activityBar.getViewControl(name);
      if (view) {
        await view.openView();
        return;
      }
    } catch {
      // Try next name
    }
  }

  // Fallback: use command to focus the view
  await browser.executeWorkbench((vscode) => {
    return vscode.commands.executeCommand("leafnode.connections.focus");
  });
}

/**
 * Execute a VS Code command by ID.
 */
export async function executeCommand(commandId: string): Promise<void> {
  await browser.executeWorkbench((vscode, cmd) => {
    return vscode.commands.executeCommand(cmd);
  }, commandId);
}

/**
 * Get the first webview and open it (switches into iframe context).
 * Returns a close function that must be called when done.
 */
export async function openWebview(): Promise<{
  close: () => Promise<void>;
}> {
  const workbench = await browser.getWorkbench();
  // Close welcome tab if present
  try {
    const editorView = workbench.getEditorView();
    const tabs = await editorView.getOpenTabs();
    for (const tab of tabs) {
      const title = await tab.getTitle();
      if (title === "Welcome") {
        await editorView.closeEditor(title);
      }
    }
  } catch {
    // No welcome tab
  }

  const webviews = await workbench.getAllWebviews();
  if (webviews.length === 0) {
    throw new Error("No webviews found");
  }
  await webviews[0].open();
  return {
    close: () => webviews[0].close(),
  };
}

/**
 * Wait for a notification message to appear.
 */
export async function waitForNotification(
  text: string,
  timeout = 10000,
): Promise<boolean> {
  return browser.waitUntil(
    async () => {
      const workbench = await browser.getWorkbench();
      const notifications = await workbench.getNotifications();
      for (const n of notifications) {
        const msg = await n.getMessage();
        if (msg.includes(text)) return true;
      }
      return false;
    },
    { timeout, interval: 500 },
  );
}

/**
 * Dismiss all notifications.
 */
export async function dismissNotifications(): Promise<void> {
  const workbench = await browser.getWorkbench();
  const notifications = await workbench.getNotifications();
  for (const n of notifications) {
    await n.dismiss();
  }
}
