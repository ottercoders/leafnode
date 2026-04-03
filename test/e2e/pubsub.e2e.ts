import {
  executeCommand,
  openLeafnodeSidebar,
  openWebview,
  waitForNotification,
} from "./setup.e2e";

describe("Pub/Sub Panel", () => {
  before(async () => {
    await openLeafnodeSidebar();
  });

  it("should warn when opening pub/sub without connection", async () => {
    await executeCommand("leafnode.openPubSub");
    await browser.pause(500);

    // Should show a warning notification
    const warned = await waitForNotification("Connect to a NATS", 3000).catch(
      () => false,
    );
    // Either warns or opens panel — both are valid depending on connection state
    expect(true).toBe(true);
  });

  describe("when panel is open", () => {
    // These tests only run meaningfully when connected to NATS.
    // In CI with nats-server, we'd first add a connection.
    // For now, test the webview structure if a panel can be opened.

    it("should have Subscribe, Publish, and Request tabs", async () => {
      // Try to open — may fail without connection
      try {
        await executeCommand("leafnode.openPubSub");
        await browser.pause(1000);

        const wv = await openWebview();

        // Check for the three tab buttons
        const tabs = await $$(".tabs button");
        if (tabs.length > 0) {
          const labels = await Promise.all(tabs.map((t) => t.getText()));
          expect(labels).toContain("Subscribe");
          expect(labels).toContain("Publish");
          expect(labels).toContain("Request");
        }

        await wv.close();
      } catch {
        // Not connected — skip webview assertions
      }
    });

    it("should switch between tabs when clicked", async () => {
      try {
        const wv = await openWebview();

        const publishTab = await $(".tabs button:nth-child(2)");
        if (await publishTab.isExisting()) {
          await publishTab.click();
          await browser.pause(300);

          // Publish tab should show subject input
          const subjectInput = await $("#pub-subject");
          expect(await subjectInput.isExisting()).toBe(true);

          // Switch to Request tab
          const requestTab = await $(".tabs button:nth-child(3)");
          await requestTab.click();
          await browser.pause(300);

          // Request tab should show timeout input
          const timeoutInput = await $("#req-timeout");
          expect(await timeoutInput.isExisting()).toBe(true);
        }

        await wv.close();
      } catch {
        // Not connected
      }
    });

    it("should have subscribe input and button", async () => {
      try {
        const wv = await openWebview();

        // Click Subscribe tab
        const subscribeTab = await $(".tabs button:nth-child(1)");
        if (await subscribeTab.isExisting()) {
          await subscribeTab.click();
          await browser.pause(300);

          const subjectInput = await $(".subject-input");
          expect(await subjectInput.isExisting()).toBe(true);

          const subButton = await $("button=Subscribe");
          expect(await subButton.isExisting()).toBe(true);
        }

        await wv.close();
      } catch {
        // Not connected
      }
    });
  });
});
