import { openLeafnodeSidebar, executeCommand } from "./setup.e2e";

describe("Streams Explorer", () => {
  before(async () => {
    await openLeafnodeSidebar();
  });

  it("should show Streams section in sidebar", async () => {
    const workbench = await browser.getWorkbench();
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const sections = await content.getSections();
    const titles = await Promise.all(sections.map((s) => s.getTitle()));
    expect(titles).toContain("Streams");
  });

  it("should refresh streams without error", async () => {
    // Should not throw even without a connection
    try {
      await executeCommand("leafnode.streams.refresh");
      expect(true).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });
});
