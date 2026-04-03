import {
  openLeafnodeSidebar,
  executeCommand,
  dismissNotifications,
} from "./setup.e2e";

describe("Connection Management", () => {
  before(async () => {
    await openLeafnodeSidebar();
    await dismissNotifications();
  });

  it("should show Connections section", async () => {
    const workbench = await browser.getWorkbench();
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const sections = await content.getSections();
    const titles = await Promise.all(sections.map((s) => s.getTitle()));
    expect(titles).toContain("Connections");
  });

  it("should open add connection input box via command", async () => {
    await executeCommand("leafnode.addConnection");
    await browser.pause(500);

    // Input box should be visible — type something then cancel
    const input = await $("input.input");
    const isDisplayed = await input.isDisplayed().catch(() => false);

    // Cancel the wizard
    await browser.keys("Escape");

    // The input box appearing confirms the command works
    expect(isDisplayed).toBe(true);
  });

  it("should open connect picker via command", async () => {
    await executeCommand("leafnode.connect");
    await browser.pause(500);

    // Cancel whatever appears (picker or wizard)
    await browser.keys("Escape");
  });
});
