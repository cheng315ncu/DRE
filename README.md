# MarkdownMermaid

A [BetterDiscord](https://betterdiscord.app/) plugin that adds Mermaid diagrams, LaTeX math, image link previews, and extra Markdown (headings, GFM tables, `<details>` blocks, horizontal rules) that Discord doesn't natively support.

It was originally built to make working with the **zeroclaw** bot nicer to read — diagrams, tables, and structured Markdown that the bot posts now render properly instead of showing up as raw text.

## Features

- **Mermaid diagrams** — flowcharts, sequence diagrams, class diagrams, state diagrams, Gantt charts, git graphs, and more, rendered straight from ` ```mermaid ` code blocks.
- **Markdown extras** — `#` headings, GFM `| a | b |` tables, `---` horizontal rules, and `<details>`/`<summary>` collapsible sections.
- **LaTeX math** — raw `\(...\)`, `\[...\]`, `$...$`, and `$$...$$` math rendered with KaTeX.
- **Image link previews** — `![alt](url)` renders as an inline image instead of a plain link.
- **Offline-capable** — Mermaid/KaTeX are downloaded once and cached locally, so the plugin keeps working without a network connection after the first load.

## Screenshots

GFM tables and syntax-highlighted code blocks:

![Tables and code blocks](.screenshots/Screenshot%202026-08-20%20091946.png)

Mermaid sequence diagram, rendered live in a zeroclaw dev channel:

![Sequence diagram](.screenshots/Screenshot%202026-08-20%20091958.png)

Mermaid class diagram:

![Class diagram](.screenshots/Screenshot%202026-08-20%20092005.png)

Mermaid state diagram:

![State diagram](.screenshots/Screenshot%202026-08-20%20092010.png)

Mermaid Gantt chart and git graph:

![Gantt chart and git graph](.screenshots/Screenshot%202026-08-20%20092018.png)

## Installation

1. Download [`MarkdownMermaid.plugin.js`](./MarkdownMermaid.plugin.js).
2. Place it in your BetterDiscord `plugins` folder (`%APPDATA%\BetterDiscord\plugins` on Windows).
3. Enable **MarkdownMermaid** in BetterDiscord's Plugins settings.

On first use, the plugin downloads Mermaid and KaTeX from a CDN and caches them locally (`.markdownmermaid-libs/`) so it doesn't need to re-download on every restart.

## Settings

Each feature (Markdown extras, Mermaid, LaTeX, image previews) can be toggled independently from the plugin's settings panel, which also shows the load status of Mermaid/KaTeX and lets you clear the cache and force a re-download.

## Acknowledgements

- [discord-markdown-renderer](https://gist.github.com/xxxxDev/d7452492a2183116736735b6cf417926) — a console-pasteable script covering the same Discord Markdown gaps (tables, `---`, headings, etc.); this plugin builds on that idea with Mermaid, LaTeX, and packaging as a proper BetterDiscord plugin.

## License

[Apache License 2.0](./LICENSE)
