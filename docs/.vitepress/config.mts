import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(defineConfig({
  title: "Leafnode",
  description: "NATS observability and management for VS Code",
  base: "/leafnode/",
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/commands" },
      { text: "GitHub", link: "https://github.com/ottercoders/leafnode" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Connections", link: "/guide/connections" },
            { text: "Streams", link: "/guide/streams" },
            { text: "KV Stores", link: "/guide/kv-stores" },
            { text: "Object Stores", link: "/guide/object-stores" },
            { text: "Pub/Sub", link: "/guide/pub-sub" },
            { text: "Bookmarks", link: "/guide/bookmarks" },
            { text: "Server Monitoring", link: "/guide/monitoring" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Commands", link: "/reference/commands" },
            { text: "Settings", link: "/reference/settings" },
            { text: "Workspace Config", link: "/reference/workspace-config" },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/ottercoders/leafnode" },
    ],
    footer: {
      message: "Released under the MIT License.",
    },
  },
}));
