import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://kompass.dev",
  integrations: [
    starlight({
      title: "Kompass Docs",
      description: "Guided workflows for AI coding agents.",
      favicon: "/kompass-icon.png",
      social: {
        github: "https://github.com/kompassdev/kompass"
      },
      customCss: ["./src/styles/starlight.css"],
      sidebar: [
        "docs",
        "docs/getting-started",
        "docs/installation",
        {
          label: "Concepts",
          items: ["docs/concepts/modes", "docs/concepts/architecture"]
        },
        {
          label: "Adapters",
          items: ["docs/adapters/opencode", "docs/adapters/claude-code"]
        },
        {
          label: "Configuration",
          items: ["docs/config/overview", "docs/config/schema"]
        },
        {
          label: "Reference",
          items: [
            "docs/reference/commands",
            "docs/reference/agents",
            "docs/reference/tools",
            "docs/reference/components",
          ]
        },
        {
          label: "Workspace",
          items: ["docs/workspace/development"]
        }
      ]
    })
  ]
});
