import { openLeafnodeSidebar } from "./setup.e2e";

describe("Extension Activation", () => {
  it("should show NATS icon in activity bar", async () => {
    const workbench = await browser.getWorkbench();
    const activityBar = workbench.getActivityBar();
    const natsView = await activityBar.getViewControl("NATS");
    expect(natsView).toBeDefined();
  });

  it("should open Leafnode sidebar", async () => {
    await openLeafnodeSidebar();

    const workbench = await browser.getWorkbench();
    const sidebarView = workbench.getSideBar();
    const titlePart = sidebarView.getTitlePart();
    const title = await titlePart.getTitle();
    expect(title).toContain("NATS");
  });

  it("should show tree views in sidebar", async () => {
    await openLeafnodeSidebar();

    const workbench = await browser.getWorkbench();
    const sidebarView = workbench.getSideBar();
    const content = sidebarView.getContent();
    const sections = await content.getSections();
    const sectionTitles = await Promise.all(
      sections.map((s) => s.getTitle()),
    );

    expect(sectionTitles).toContain("Connections");
    expect(sectionTitles).toContain("Streams");
    expect(sectionTitles).toContain("KV Stores");
  });

  it("should show status bar item", async () => {
    const workbench = await browser.getWorkbench();
    const statusBar = workbench.getStatusBar();
    const items = await statusBar.getItems();
    const texts = await Promise.all(items.map((i) => i.getText()));
    const hasNats = texts.some(
      (t) => t.includes("NATS") || t.includes("Leafnode"),
    );
    expect(hasNats).toBe(true);
  });
});
