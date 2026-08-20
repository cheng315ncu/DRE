# DRE

**D**iscord **R**endering **E**nhanced — a [BetterDiscord](https://betterdiscord.app/) plugin that adds Mermaid diagrams, LaTeX math, image link previews, and extra Markdown (headings, GFM tables, `<details>` blocks, horizontal rules) that Discord doesn't natively support.

It was originally built to make working with the **zeroclaw** bot nicer to read — diagrams, tables, and structured Markdown that the bot posts now render properly instead of showing up as raw text.

## Features

- **Mermaid diagrams** — flowcharts, sequence diagrams, class diagrams, state diagrams, Gantt charts, git graphs, and more, rendered straight from ` ```mermaid ` code blocks.
- **Markdown extras** — `#` headings, GFM `| a | b |` tables, `---` horizontal rules, and `<details>`/`<summary>` collapsible sections.
- **LaTeX math** — raw `\(...\)`, `\[...\]`, `$...$`, and `$$...$$` math rendered with KaTeX. Backtick-wrapped math (e.g. `` `$x^2$` ``) is left alone — that's handled by the separate [LaTeX Renderer](https://github.com/BinaryQuantumSoul/discord-latex) plugin.
- **Image link previews** — `![alt](url)` renders as an inline image instead of a plain link.
- **Offline-capable** — Mermaid/KaTeX are downloaded once and cached locally, so the plugin keeps working without a network connection after the first load.

## Screenshots

### Mermaid diagrams

Sequence diagram, rendered live in a zeroclaw dev channel:

![Sequence diagram](.screenshots/Screenshot%202026-08-20%20091958.png)

Class diagram:

![Class diagram](.screenshots/Screenshot%202026-08-20%20092005.png)

State diagram:

![State diagram](.screenshots/Screenshot%202026-08-20%20092010.png)

Gantt chart and git graph:

![Gantt chart and git graph](.screenshots/Screenshot%202026-08-20%20092018.png)

### Markdown extras

GFM tables and syntax-highlighted code blocks:

![Tables and code blocks](.screenshots/Screenshot%202026-08-20%20091946.png)

### LaTeX math

Inline and display math, tested live against the zeroclaw bot:

![LaTeX inline and display test](.screenshots/Screenshot%202026-08-20%20131236.png)

The Schrödinger equation, conditional probability, and mean/variance formulas:

![Schrödinger equation and statistics formulas](.screenshots/Screenshot%202026-08-20%20131215.png)

LaTeX tables and chemical formulas:

![LaTeX tables and chemical formulas](.screenshots/Screenshot%202026-08-20%20131201.png)

Greek letters and special symbols:

![Greek letters and special symbols](.screenshots/Screenshot%202026-08-20%20131155.png)

## Installation

> The plugin file is `DC_Render_Enhanced.plugin.js`. Its internal identity (the `@name`/`CONFIG.name` BetterDiscord uses for the Plugins-list label and for saved settings) is unchanged — it'll still show up as **MarkdownMermaid** there, and existing saved settings/cache carry over. If you're updating an existing install, remove the old `MarkdownMermaid.plugin.js` file and re-enable the plugin under its new filename.

1. Download [`DC_Render_Enhanced.plugin.js`](./DC_Render_Enhanced.plugin.js).
2. Place it in your BetterDiscord `plugins` folder (`%APPDATA%\BetterDiscord\plugins` on Windows).
3. Enable **MarkdownMermaid** in BetterDiscord's Plugins settings.

On first use, the plugin downloads Mermaid and KaTeX from a CDN and caches them locally (`.markdownmermaid-libs/`) so it doesn't need to re-download on every restart.

## Settings

Each feature (Markdown extras, Mermaid, LaTeX, image previews) can be toggled independently from the plugin's settings panel, which also shows the load status of Mermaid/KaTeX and lets you clear the cache and force a re-download.

## Acknowledgements

- [discord-markdown-renderer](https://gist.github.com/xxxxDev/d7452492a2183116736735b6cf417926) — a console-pasteable script covering the same Discord Markdown gaps (tables, `---`, headings, etc.); this plugin builds on that idea with Mermaid, LaTeX, and packaging as a proper BetterDiscord plugin.
- [discord-latex](https://github.com/BinaryQuantumSoul/discord-latex) by [BinaryQuantumSoul](https://github.com/BinaryQuantumSoul) — a MathJax-based LaTeX renderer for Discord. This plugin's own KaTeX-based math support is scoped to raw (non-backtick-wrapped) LaTeX specifically so it can coexist with discord-latex instead of double-rendering the same math.

## License

[Apache License 2.0](./LICENSE)
