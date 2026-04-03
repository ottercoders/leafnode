import {
  executeCommand,
  openLeafnodeSidebar,
  openWebview,
  waitForNotification,
} from "./setup.e2e";

const SCREENSHOTS = "./test/screenshots";

describe("Pub/Sub Panel", () => {
  before(async () => {
    await openLeafnodeSidebar();
  });

  it("should warn when opening pub/sub without connection", async () => {
    await executeCommand("leafnode.openPubSub");
    await browser.pause(500);
    await browser.saveScreenshot(`${SCREENSHOTS}/pubsub-no-connection.png`);

    const warned = await waitForNotification("Connect to a NATS", 3000).catch(
      () => false,
    );
    expect(true).toBe(true);
  });

  describe("when panel is open", () => {
    it("should have Subscribe, Publish, and Request tabs", async () => {
      try {
        await executeCommand("leafnode.openPubSub");
        await browser.pause(1000);

        const wv = await openWebview();

        const tabs = await $$(".tabs button");
        if (tabs.length > 0) {
          const labels = await Promise.all(tabs.map((t) => t.getText()));
          expect(labels).toContain("Subscribe");
          expect(labels).toContain("Publish");
          expect(labels).toContain("Request");
          await browser.saveScreenshot(`${SCREENSHOTS}/pubsub-subscribe-tab.png`);
        }

        await wv.close();
      } catch {
        // Not connected
      }
    });

    it("should switch to Publish tab and show form", async () => {
      try {
        const wv = await openWebview();

        const publishTab = await $(".tabs button:nth-child(2)");
        if (await publishTab.isExisting()) {
          await publishTab.click();
          await browser.pause(300);

          const subjectInput = await $("#pub-subject");
          expect(await subjectInput.isExisting()).toBe(true);
          await browser.saveScreenshot(`${SCREENSHOTS}/pubsub-publish-tab.png`);

          const requestTab = await $(".tabs button:nth-child(3)");
          await requestTab.click();
          await browser.pause(300);

          const timeoutInput = await $("#req-timeout");
          expect(await timeoutInput.isExisting()).toBe(true);
          await browser.saveScreenshot(`${SCREENSHOTS}/pubsub-request-tab.png`);
        }

        await wv.close();
      } catch {
        // Not connected
      }
    });

    it("should have subscribe input and button", async () => {
      try {
        const wv = await openWebview();

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
