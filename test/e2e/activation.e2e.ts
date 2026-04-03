import { openLeafnodeSidebar } from "./setup.e2e";

describe("Extension Activation", () => {
  it("should show NATS icon in activity bar", async () => {
    const workbench = await browser.getWorkbench();
    const activityBar = workbench.getActivityBar();
    const natsView = await activityBar.getViewControl("NATS");
    expect(natsView).toBeDefined();
  });

  it("should open Leafnode sidebar with expected sections", async () => {
    await openLeafnodeSidebar();

    const workbench = await browser.getWorkbench();
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const sections = await content.getSections();
    const titles = await Promise.all(sections.map((s) => s.getTitle()));

    expect(titles).toContain("Connections");
    expect(titles).toContain("Streams");
    expect(titles).toContain("KV Stores");
    expect(titles).toContain("Object Stores");
    expect(titles).toContain("Subjects");
  });

  it("should show NATS status bar item", async () => {
    const workbench = await browser.getWorkbench();
    const statusBar = workbench.getStatusBar();
    const items = await statusBar.getItems();
    const texts = await Promise.all(items.map((i) => i.getText()));
    const hasNats = texts.some((t) => t.includes("NATS"));
    expect(hasNats).toBe(true);
  });
});
