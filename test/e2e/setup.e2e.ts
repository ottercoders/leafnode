/**
 * Shared E2E test helpers for Leafnode VS Code extension.
 *
 * Uses wdio-vscode-service page objects and browser.executeWorkbench
 * to interact with VS Code UI.
 */

/**
 * Open the Leafnode sidebar by clicking the NATS activity bar icon.
 */
export async function openLeafnodeSidebar(): Promise<void> {
  const workbench = await browser.getWorkbench();
  const activityBar = workbench.getActivityBar();
  const natsView = await activityBar.getViewControl("NATS");
  if (natsView) {
    await natsView.openView();
  }
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
 * Get the title of the active editor/panel.
 */
export async function getActiveEditorTitle(): Promise<string | undefined> {
  const workbench = await browser.getWorkbench();
  const editorView = workbench.getEditorView();
  try {
    const activeTab = await editorView.getActiveTab();
    return activeTab ? await activeTab.getTitle() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get all visible status bar items text.
 */
export async function getStatusBarText(): Promise<string[]> {
  const workbench = await browser.getWorkbench();
  const statusBar = workbench.getStatusBar();
  const items = await statusBar.getItems();
  const texts: string[] = [];
  for (const item of items) {
    texts.push(await item.getText());
  }
  return texts;
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
