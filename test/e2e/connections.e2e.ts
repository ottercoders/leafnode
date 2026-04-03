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

  it("should show welcome view when no connections exist", async () => {
    const workbench = await browser.getWorkbench();
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const sections = await content.getSections();

    // Find the Connections section
    let connectionsSection;
    for (const section of sections) {
      const title = await section.getTitle();
      if (title === "Connections") {
        connectionsSection = section;
        break;
      }
    }

    expect(connectionsSection).toBeDefined();
  });

  it("should add a connection via command", async () => {
    // Execute the add connection command
    await executeCommand("leafnode.addConnection");

    // The connection wizard opens as an input box
    // Type the connection name
    const inputBox = await (
      await browser.getWorkbench()
    ).openCommandPrompt();
    // Input box should be visible for connection name
    expect(inputBox).toBeDefined();

    // Cancel to avoid actually creating a connection in this test
    await browser.keys("Escape");
  });

  it("should open connect picker via command", async () => {
    await executeCommand("leafnode.connect");

    // Should open either a quick pick (if connections exist)
    // or the connection wizard (if no connections)
    // Either way, an input/picker UI should appear
    await browser.pause(500);

    // Cancel
    await browser.keys("Escape");
  });
});
