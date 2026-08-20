/**
 * @name MarkdownMermaid
 * @author Local
 * @description Adds Mermaid diagrams, LaTeX math, image link previews, and extra Markdown (headings, GFM tables) that Discord doesn't natively support.
 * @version 1.4.0
 */

const CONFIG = {
    name: "MarkdownMermaid",
    defaultSettings: {
        markdown: true,
        mermaid: true,
        latex: true,
        images: true,
    },
    mermaid: {
        global: "mermaid",
        probe: "render",
        cacheFile: "mermaid.min.js",
        urls: [
            "https://cdn.jsdelivr.net/npm/mermaid@10.9.8/dist/mermaid.min.js",
            "https://unpkg.com/mermaid@10.9.8/dist/mermaid.min.js",
        ],
    },
    katex: {
        global: "katex",
        probe: "renderToString",
        cacheFile: "katex.min.js",
        urls: [
            "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
            "https://unpkg.com/katex@0.16.11/dist/katex.min.js",
        ],
        cssCacheFile: "katex.min.css",
        cssUrls: [
            "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
            "https://unpkg.com/katex@0.16.11/dist/katex.min.css",
        ],
        assetBase: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/",
    },
    // Mermaid sizes every node from the text it measured, so the font it measures with and
    // the font the SVG is finally painted in have to be the same one. Pinning a stack here
    // AND in the stylesheet is what keeps those two in agreement inside Discord.
    mermaidFont: '"trebuchet ms", verdana, arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif',
    cacheDirName: ".markdownmermaid-libs",
    safetyScanIntervalMs: 2000,
};

const STYLE = `
.richmd-heading { font-weight: 700; color: var(--header-primary); margin: 8px 0 4px; line-height: 1.3; }
.richmd-h1 { font-size: 1.6em; border-bottom: 1px solid var(--background-modifier-accent); padding-bottom: 4px; }
.richmd-h2 { font-size: 1.4em; border-bottom: 1px solid var(--background-modifier-accent); padding-bottom: 3px; }
.richmd-h3 { font-size: 1.25em; }
.richmd-h4 { font-size: 1.1em; }
.richmd-h5 { font-size: 1em; text-transform: uppercase; letter-spacing: .02em; }
.richmd-h6 { font-size: .95em; color: var(--text-muted); }

.richmd-table-wrap { overflow-x: auto; margin: 6px 0; max-width: 100%; }
.richmd-table { border-collapse: collapse; font-size: .9em; }
.richmd-table th, .richmd-table td { border: 1px solid var(--background-modifier-accent); padding: 6px 10px; text-align: left; vertical-align: top; }
.richmd-table th { background: var(--background-modifier-selected); color: var(--header-primary); font-weight: 600; }
.richmd-table tr:nth-child(even) td { background: var(--background-modifier-hover); }

.richmd-hr { border: none; border-top: 1px solid var(--background-modifier-accent); height: 0; margin: 10px 0; }

.richmd-mermaid-wrapper { margin: 6px 0; }
.richmd-mermaid-diagram { background: var(--background-secondary); border: 1px solid var(--background-modifier-accent); border-radius: 6px; padding: 12px; overflow-x: auto; }
.richmd-mermaid-diagram svg { max-width: 100%; height: auto; }
/* Discord styles message text (font, size, line-height, letter-spacing) and those rules
   inherit straight into a mermaid SVG dropped inside a message. Mermaid has already sized
   every box from the text it measured, so anything Discord leaks in here paints at a
   different size than the box computed for it -- which is what clipped the class-diagram
   labels and collapsed the state-diagram nodes to nothing. Pin the metrics back. */
.richmd-mermaid-diagram svg text,
.richmd-mermaid-diagram svg tspan {
    font-family: ${CONFIG.mermaidFont} !important;
    letter-spacing: normal !important;
    font-variant-ligatures: none;
}
/* Diagram types that force HTML labels regardless of config still need to survive. */
.richmd-mermaid-diagram svg foreignObject { overflow: visible; }
.richmd-mermaid-diagram svg foreignObject div,
.richmd-mermaid-diagram svg foreignObject span,
.richmd-mermaid-diagram svg foreignObject p {
    font-family: ${CONFIG.mermaidFont} !important;
    line-height: normal !important;
    letter-spacing: normal !important;
    margin: 0;
}
.richmd-mermaid-diagram.richmd-mermaid-error { color: var(--text-danger); font-family: var(--font-code); white-space: pre-wrap; }
.richmd-mermaid-toggle { display: inline-block; margin-top: 4px; background: none; border: none; color: var(--text-link); font-size: 12px; cursor: pointer; padding: 0; }
.richmd-mermaid-toggle:hover { text-decoration: underline; }

.richmd-latex-inline { display: inline-block; }
.richmd-latex-block { display: block; margin: 6px 0; overflow-x: auto; }
.richmd-latex-error { color: var(--text-danger); font-family: var(--font-code); white-space: pre-wrap; }

.richmd-image-wrap { margin: 4px 0; display: block; }
.richmd-image-preview { max-width: 400px; max-height: 300px; border-radius: 6px; display: block; cursor: zoom-in; }

.richmd-details { margin: 6px 0; border: 1px solid var(--background-modifier-accent); border-radius: 6px; padding: 2px 10px; background: var(--background-secondary); }
.richmd-details > summary { cursor: pointer; padding: 6px 0; font-weight: 600; color: var(--header-primary); list-style: none; }
.richmd-details > summary::-webkit-details-marker { display: none; }
.richmd-details > summary::before { content: "▶"; display: inline-block; width: 1em; margin-right: 4px; font-size: .75em; transition: transform .15s ease; }
.richmd-details[open] > summary::before { transform: rotate(90deg); }
.richmd-details-body { padding: 2px 0 10px; color: var(--text-normal); }
.richmd-details .richmd-details { margin: 6px 0 6px 14px; }
`;

// Discord's CSS class names are hashed per-build; resolve the real (current) class
// names by the stable webpack export keys instead of hardcoding either a class or an id.
// A "markup__" substring fallback is included too, since that's proven (via manual
// testing against this exact client) to match Discord's message content element even
// when the other two techniques don't.
const CLASS_MESSAGE_LIST_ITEM = (BdApi.Webpack.getByKeys("messageListItem") || {}).messageListItem;
const CLASS_MESSAGE_CONTENT = (BdApi.Webpack.getByKeys("threadMessageAccessoryContentLeadingIcon") || {}).messageContent;

const MESSAGE_CONTENT_SELECTOR = [
    CLASS_MESSAGE_CONTENT ? `.${CLASS_MESSAGE_CONTENT}` : null,
    '[id^="message-content-"]',
    '[class*="markup__"]',
].filter(Boolean).join(", ");

function getMessageContents(root) {
    if (!root || root.nodeType !== 1) return [];
    return Array.from(root.querySelectorAll(MESSAGE_CONTENT_SELECTOR));
}

function getReactFiber(node) {
    const key = Object.keys(node).find(k => k.startsWith("__reactFiber$"));
    return key ? node[key] : null;
}

function getMessageFromContentEl(el) {
    let fiber = getReactFiber(el);
    let depth = 0;
    while (fiber && depth++ < 40) {
        const props = fiber.memoizedProps;
        if (props && props.message && typeof props.message.content === "string") return props.message;
        fiber = fiber.return;
    }
    return null;
}

// message.content is empty for embed-based bot messages (the text lives in
// message.embeds[].description/fields instead), which silently disabled LaTeX detection
// for any bot -- like zeroclaw -- that replies via embed rather than plain content. Mermaid
// sidesteps this with a DOM-sniffing fallback (see findMermaidBlocks below); LaTeX can't
// do the same since Discord's DOM has already eaten the "\(" "\[" backslash by the time we
// see it, so instead we widen the raw-text search to include embed text too.
function getLatexSearchText(message) {
    if (!message) return null;
    const parts = [];
    if (message.content) parts.push(message.content);
    for (const embed of message.embeds || []) {
        if (embed.title) parts.push(embed.title);
        if (embed.description) parts.push(embed.description);
        for (const field of embed.fields || []) {
            if (field.name) parts.push(field.name);
            if (field.value) parts.push(field.value);
        }
    }
    return parts.length ? parts.join("\n") : null;
}

// ---------- flattened-text DOM mapping (recursive, block-tag-aware) ----------
// Ported from a manually-verified content script: walks the FULL subtree (not just
// direct children), inserting a newline at block-tag boundaries, so headings/tables
// are found correctly regardless of how deep Discord nests each line.

const BLOCK_TAGS = new Set([
    "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6",
    "OL", "UL", "LI", "HR", "BLOCKQUOTE", "TABLE",
]);

function buildVisibleTextMap(root) {
    let text = "";
    const nodeMap = [];

    const maybeNewline = () => {
        if (text.length > 0 && !text.endsWith("\n")) text += "\n";
    };

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const len = node.nodeValue.length;
            nodeMap.push({ node, start: text.length, end: text.length + len });
            text += node.nodeValue;
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // Skip our own output. richmd-mermaid-wrapper matters just as much as the other
        // two: once a diagram renders, its SVG carries a text node for every label in the
        // chart, and letting those into the flattened text both shifts every offset after
        // it and makes a label containing "|" or "#" look like a table or heading.
        if (node.classList && (
            node.classList.contains("richmd-hidden") ||
            node.classList.contains("richmd-rendered") ||
            node.classList.contains("richmd-mermaid-wrapper")
        )) return;

        const tag = node.tagName;
        if (tag === "BR") {
            text += "\n";
            return;
        }
        // Emoji render as <img alt="😀">; without this their cells/lines read as empty.
        if (tag === "IMG" && node.alt) {
            const alt = node.alt;
            nodeMap.push({ node, start: text.length, end: text.length + alt.length, isElement: true });
            text += alt;
            return;
        }
        // Don't let code contents (which may themselves contain "#"/"|"/"$" as literal
        // example text, or backtick-wrapped LaTeX meant for the other LaTeX plugin) feed
        // into heading/table/latex detection. Record an opaque marker at this position so
        // hideRange() can tell a match's range would cross over this element in the live
        // DOM (even though it contributes no characters here) and refuse to touch it —
        // otherwise a DOM Range spanning past a hidden <pre> (e.g. a mermaid code block)
        // would silently extract and hide that unrelated element too.
        if (tag === "PRE" || tag === "CODE") {
            nodeMap.push({ opaque: true, start: text.length, end: text.length });
            if (tag === "PRE") maybeNewline();
            return;
        }

        const isBlock = BLOCK_TAGS.has(tag);
        if (isBlock) maybeNewline();
        for (const child of Array.from(node.childNodes)) walk(child);
        if (isBlock) maybeNewline();
    }

    walk(root);
    return { text, nodeMap };
}

function hideRange(nodeMap, charStart, charEnd) {
    if (!nodeMap.length) return null;
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < nodeMap.length; i++) {
        const e = nodeMap[i];
        if (startIdx === -1 && charStart < e.end) startIdx = i;
        if (charEnd <= e.end) { endIdx = i; break; }
    }
    if (endIdx === -1) endIdx = nodeMap.length - 1;
    if (startIdx === -1) return null;

    for (let i = startIdx; i <= endIdx; i++) {
        if (nodeMap[i].opaque) return null;
    }

    const startEntry = nodeMap[startIdx];
    const endEntry = nodeMap[endIdx];

    const range = document.createRange();
    try {
        if (startEntry.isElement) range.setStartBefore(startEntry.node);
        else range.setStart(startEntry.node, charStart - startEntry.start);
        if (endEntry.isElement) range.setEndAfter(endEntry.node);
        else range.setEnd(endEntry.node, Math.min(charEnd - endEntry.start, endEntry.node.nodeValue.length));
    } catch (e) {
        return null;
    }

    const fragment = range.extractContents();
    const wrapper = document.createElement("span");
    wrapper.className = "richmd-hidden";
    wrapper.style.display = "none";
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    range.detach();
    return wrapper;
}

// Diagram headers mermaid understands. Used only to sniff code blocks that arrived with
// no language label, and every hit is confirmed with mermaid.parse() before the block is
// touched -- see findMermaidBlocks().
const MERMAID_HEADER_RE = /^(?:%%\{[\s\S]*?\}%%\s*)*(?:flowchart|graph|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|zenuml|sankey-beta|xychart-beta|block-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/;

function escHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

// ---------- heading detection ----------

const HEADING_RE = /(?:^|\n)([ \t]*)(#{1,6})[ \t]+([^\n]+?)[ \t]*(?=\n|$)/g;

function findHeadings(text) {
    const found = [];
    let m;
    HEADING_RE.lastIndex = 0;
    while ((m = HEADING_RE.exec(text)) !== null) {
        const lineOffset = m.index === 0 && text[0] !== "\n" ? 0 : 1;
        const start = m.index + lineOffset;
        found.push({ start, end: start + m[0].length - lineOffset, level: m[2].length, content: m[3] });
    }
    return found;
}

// ---------- horizontal rules ----------
// Discord has no "---" rule syntax, so the line survives into the rendered DOM as literal
// text exactly like "#" and "|" do. Requires the whole line to be 3+ of one marker
// character (spaces allowed between them, as CommonMark permits), which is what keeps it
// clear of Discord's "-# subtext" and of a table's "|---|---|" delimiter row.
const HR_RE = /(?:^|\n)([ \t]*(?:-[ \t]*){3,}|[ \t]*(?:\*[ \t]*){3,}|[ \t]*(?:_[ \t]*){3,})(?=\n|$)/g;

function findRules(text) {
    const found = [];
    let m;
    HR_RE.lastIndex = 0;
    while ((m = HR_RE.exec(text)) !== null) {
        const lineOffset = m.index === 0 && text[0] !== "\n" ? 0 : 1;
        const start = m.index + lineOffset;
        found.push({ start, end: start + m[0].length - lineOffset });
    }
    return found;
}

// ---------- table detection ----------

const ROW_RE = /^\s*\|.*\|\s*$/;
const SEP_RE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;

function parseRow(line) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed.split("|").map(c => c.trim());
}

function findTables(text) {
    const lines = text.split("\n");
    const tables = [];
    const lineStart = [0];
    for (let i = 0; i < lines.length; i++) lineStart.push(lineStart[i] + lines[i].length + 1);

    // One blank line between a table's rows is tolerated. That isn't GFM-legal, but this
    // parser runs against text recovered from the *rendered* DOM, where a block element per
    // line can contribute a line break of its own on top of the one already in the message
    // -- and the strict version's only response to that was to silently leave an obvious
    // table sitting there as raw pipes.
    const skipOneBlank = (i) => (i < lines.length && lines[i].trim() === "" ? i + 1 : i);

    for (let i = 0; i < lines.length - 1; i++) {
        if (!ROW_RE.test(lines[i])) continue;

        const sepIdx = skipOneBlank(i + 1);
        if (sepIdx >= lines.length || !SEP_RE.test(lines[sepIdx])) continue;

        const headers = parseRow(lines[i]);
        const expectedCols = headers.length;
        if (parseRow(lines[sepIdx]).length !== expectedCols) continue;

        const rows = [];
        let lastRow = sepIdx;
        let j = sepIdx + 1;
        for (;;) {
            const k = skipOneBlank(j);
            if (k >= lines.length || !ROW_RE.test(lines[k])) break;
            const cells = parseRow(lines[k]);
            while (cells.length < expectedCols) cells.push("");
            if (cells.length > expectedCols) cells.length = expectedCols;
            rows.push(cells);
            lastRow = k;
            j = k + 1;
        }
        tables.push({ headers, rows, start: lineStart[i], end: lineStart[lastRow] + lines[lastRow].length });
        i = lastRow;
    }
    return tables;
}

function renderTableInner(headers, rows) {
    const thead = `<thead><tr>${headers.map(h => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${escHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    return `<table class="richmd-table">${thead}${tbody}</table>`;
}

// ---------- <details>/<summary> collapsible blocks ----------
// Discord has no notion of these tags, so raw "<details>"/"<summary>" text survives
// untouched in the rendered DOM (same reason "#" and "|" do). We only ever read this as
// PLAIN TEXT and rebuild real <details> elements via textContent/createTextNode — never
// via innerHTML on message content — so no attacker-controlled markup can execute.

function tokenizeDetails(text) {
    const tokens = [];
    const re = /<details\s*>|<summary\s*>([\s\S]*?)<\/summary\s*>|<\/details\s*>/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
        const start = m.index, end = m.index + m[0].length;
        if (/^<details/i.test(m[0])) tokens.push({ type: "open", start, end });
        else if (/^<summary/i.test(m[0])) tokens.push({ type: "summary", start, end, text: m[1] });
        else tokens.push({ type: "close", start, end });
    }
    return tokens;
}

// Recursive-descent over the token stream so nested <details> (fold inside a fold) build
// a matching tree of nested elements instead of mis-pairing with the wrong closing tag.
function parseDetailsNode(tokens, idx) {
    const openTok = tokens[idx];
    let i = idx + 1;
    let summary = null;
    let bodyStart = openTok.end;
    if (tokens[i] && tokens[i].type === "summary") {
        summary = tokens[i].text;
        bodyStart = tokens[i].end;
        i++;
    }
    const children = [];
    while (i < tokens.length && tokens[i].type !== "close") {
        if (tokens[i].type === "open") {
            const child = parseDetailsNode(tokens, i);
            if (child) { children.push(child.node); i = child.nextIdx; continue; }
        }
        i++;
    }
    if (i >= tokens.length) return null; // unmatched <details>, bail
    const closeTok = tokens[i];
    return {
        node: { start: openTok.start, end: closeTok.end, summary, bodyStart, bodyEnd: closeTok.start, children },
        nextIdx: i + 1,
    };
}

function findDetailsBlocks(text) {
    const tokens = tokenizeDetails(text);
    const blocks = [];
    let i = 0;
    while (i < tokens.length) {
        if (tokens[i].type === "open") {
            const result = parseDetailsNode(tokens, i);
            if (result) { blocks.push(result.node); i = result.nextIdx; continue; }
        }
        i++;
    }
    return blocks;
}

function textToFragment(str) {
    const frag = document.createDocumentFragment();
    const lines = str.split("\n");
    lines.forEach((line, i) => {
        if (i > 0) frag.appendChild(document.createElement("br"));
        if (line) frag.appendChild(document.createTextNode(line));
    });
    return frag;
}

// ---------- LaTeX detection (raw, non-code-wrapped math only; the separate LaTeX ----------
// ---------- Renderer plugin still owns backtick-wrapped math via <code>, which we skip) ----------
//
// This MUST run against the raw, un-rendered message string, not the rendered DOM text:
// Discord's own markdown parser strips the backslash off "\(" "\)" "\[" "\]" (it's a
// CommonMark-style escape — backslash followed by ASCII punctuation) before we ever see
// the DOM, so by the time buildVisibleTextMap() runs, those delimiters are gone. Only the
// LaTeX *content* between them survives verbatim (backslash-letter commands like \hat or
// \frac aren't valid escapes, so Discord leaves them alone) — which is what lets us find
// where a raw-detected span landed in the rendered text via a plain substring search.

function findLatex(text) {
    const found = [];
    const occupied = [];
    const isFree = (s, e) => !occupied.some(c => s < c.end && e > c.start);
    const occupy = (s, e) => occupied.push({ start: s, end: e });

    // Unambiguous delimiters first.
    let re = /\$\$([\s\S]+?)\$\$/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const s = m.index, e = s + m[0].length;
        if (isFree(s, e)) { found.push({ start: s, end: e, content: m[1], display: true }); occupy(s, e); }
    }
    re = /\\\[([\s\S]+?)\\\]/g;
    while ((m = re.exec(text)) !== null) {
        const s = m.index, e = s + m[0].length;
        if (isFree(s, e)) { found.push({ start: s, end: e, content: m[1], display: true }); occupy(s, e); }
    }
    re = /\\\(([\s\S]+?)\\\)/g;
    while ((m = re.exec(text)) !== null) {
        const s = m.index, e = s + m[0].length;
        if (isFree(s, e)) { found.push({ start: s, end: e, content: m[1], display: false }); occupy(s, e); }
    }
    // Single-dollar inline math collides with plain-prose currency ("$5 and $10"), so
    // require it to actually look like math and not just be prose with dollar signs.
    re = /\$([^$\n]+?)\$/g;
    while ((m = re.exec(text)) !== null) {
        const s = m.index, e = s + m[0].length;
        const content = m[1];
        if (!/[\\^_{}]/.test(content)) continue;
        if (/^\s|\s$/.test(content)) continue;
        if (isFree(s, e)) { found.push({ start: s, end: e, content, display: false }); occupy(s, e); }
    }
    found.sort((a, b) => a.start - b.start);
    return found;
}

function escapeRegExpChar(ch) {
    return /[.*+?^${}()|[\]\\]/.test(ch) ? "\\" + ch : ch;
}

// ASCII punctuation, matching CommonMark's escapable set.
const ESCAPABLE_PUNCT = /[!-/:-@[-`{-~]/;

// Builds a regex that matches raw LaTeX content even after Discord's own markdown parser
// has partially mangled it in the rendered DOM: a backslash immediately before ASCII
// punctuation (as in "\(", "\\", "\,") may have been eaten as an escape marker, and a bare
// "_" or "*" (a LaTeX subscript marker, not an escape) may have been eaten as an emphasis
// delimiter — in both cases only that one character disappears, everything else survives,
// so making just those characters optional reconstructs a match against the mangled text.
function buildFlexibleLatexPattern(content) {
    let pattern = "";
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (ch === "\\" && i + 1 < content.length && ESCAPABLE_PUNCT.test(content[i + 1])) {
            pattern += "\\\\?";
            continue;
        }
        if (ch === "_" || ch === "*") {
            pattern += escapeRegExpChar(ch) + "?";
            continue;
        }
        pattern += escapeRegExpChar(ch);
    }
    return new RegExp(pattern);
}

// Locates each raw-detected LaTeX span inside the rendered DOM's flattened text, advancing
// a cursor left-to-right so repeated identical formulas map to successive occurrences
// instead of all matching the first one.
function locateLatexInDomText(domText, rawSpans) {
    const located = [];
    let cursor = 0;
    for (const span of rawSpans) {
        const needle = span.content.trim();
        if (!needle) continue;

        const pattern = buildFlexibleLatexPattern(needle);
        const rest = domText.slice(cursor);
        const m = pattern.exec(rest);
        if (!m) continue;

        let start = cursor + m.index;
        let end = start + m[0].length;

        // "\(" / "\[" only lose their backslash, not the bracket itself, so a bare "(" or
        // "[" (and its close) is still sitting right next to the content — absorb it so we
        // don't leave a stray paren/bracket floating around the rendered math.
        const openCh = span.display ? "[" : "(";
        const closeCh = span.display ? "]" : ")";
        let b = start - 1;
        while (b >= 0 && /\s/.test(domText[b])) b--;
        if (b >= 0 && domText[b] === openCh) start = b;
        let a = end;
        while (a < domText.length && /\s/.test(domText[a])) a++;
        if (a < domText.length && domText[a] === closeCh) end = a + 1;

        located.push({ start, end, content: needle, display: span.display });
        cursor = end;
    }
    return located;
}

// ---------- library loading (CSP-proof, UMD-proof, offline-capable) ----------
//
// Pulling mermaid/katex in with a plain <script src="https://cdn..."> tag fails inside the
// Discord client in two independent ways, and both of them look identical from the user's
// seat: nothing renders, mermaid code blocks just stay code blocks.
//   1. Discord serves a Content-Security-Policy. On builds where it isn't stripped, a
//      remote script/stylesheet tag is refused outright and only onerror fires.
//   2. Both libraries are UMD bundles whose wrapper tests `typeof exports`/`typeof module`
//      FIRST and only falls through to the global object last. Discord's renderer runs
//      with Node integration, so wherever those globals are visible in page scope the
//      bundle exports into them and never defines window.mermaid -- the script tag loads
//      fine, yet the global the plugin waits for never appears.
// So instead: fetch the source over Node's https (which CSP has no say over), cache it in
// a folder next to the plugin, and evaluate it here with module/exports/define forced
// undefined so the UMD wrapper is pushed down its "attach to the global object" branch.
// After one successful download the plugin also works with no network at all.

function nodeRequire(name) {
    try {
        return typeof require === "function" ? require(name) : null;
    } catch (e) {
        return null;
    }
}

function cacheDir() {
    const fs = nodeRequire("fs");
    const path = nodeRequire("path");
    if (!fs || !path) return null;

    let base = null;
    try {
        base = BdApi.Plugins.folder;
    } catch (e) {
        base = null;
    }
    if (!base) return null;

    const dir = path.join(base, CONFIG.cacheDirName);
    try {
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    } catch (e) {
        return null;
    }
}

function cachePath(file) {
    const path = nodeRequire("path");
    const dir = cacheDir();
    return path && dir ? path.join(dir, file) : null;
}

function readCache(file) {
    const fs = nodeRequire("fs");
    const full = cachePath(file);
    if (!fs || !full) return null;
    try {
        const text = fs.readFileSync(full, "utf8");
        return text && text.length > 1000 ? text : null;
    } catch (e) {
        return null;
    }
}

function writeCache(file, text) {
    const fs = nodeRequire("fs");
    const full = cachePath(file);
    if (!fs || !full) return;
    try {
        fs.writeFileSync(full, text, "utf8");
    } catch (e) {
        /* caching is best effort; a failure here only costs a re-download next start */
    }
}

function clearCache() {
    const fs = nodeRequire("fs");
    const dir = cacheDir();
    if (!fs || !dir) return;
    for (const file of [CONFIG.mermaid.cacheFile, CONFIG.katex.cacheFile, CONFIG.katex.cssCacheFile]) {
        try {
            fs.unlinkSync(cachePath(file));
        } catch (e) {
            /* already gone */
        }
    }
}

// Node's https, so the download isn't subject to the page's connect-src policy.
function httpGet(url, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        const https = nodeRequire("https");
        if (!https) return reject(new Error("node https unavailable"));

        const req = https.get(url, { headers: { "user-agent": "BetterDiscord-MarkdownMermaid" } }, res => {
            const status = res.statusCode;
            const location = res.headers.location;
            if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
                res.resume();
                resolve(httpGet(new URL(location, url).toString(), redirectsLeft - 1));
                return;
            }
            if (status !== 200) {
                res.resume();
                reject(new Error(`HTTP ${status}`));
                return;
            }
            let body = "";
            res.setEncoding("utf8");
            res.on("data", chunk => { body += chunk; });
            res.on("end", () => resolve(body));
        });
        req.on("error", reject);
        req.setTimeout(30000, () => req.destroy(new Error("timed out")));
    });
}

async function fetchText(url) {
    try {
        return await httpGet(url);
    } catch (e) {
        /* fall through to the renderer-side fetchers */
    }
    if (BdApi.Net && typeof BdApi.Net.fetch === "function") {
        const res = await BdApi.Net.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
}

async function fetchFirst(urls) {
    const failures = [];
    for (const url of urls) {
        try {
            const text = await fetchText(url);
            if (text && text.length > 1000) return text;
            failures.push(`${url}: response too small (${text ? text.length : 0} bytes)`);
        } catch (e) {
            failures.push(`${url}: ${e.message}`);
        }
    }
    throw new Error(`download failed -- ${failures.join("; ")}`);
}

async function ensureText(urls, cacheFile) {
    const cached = readCache(cacheFile);
    if (cached) return cached;
    const text = await fetchFirst(urls);
    writeCache(cacheFile, text);
    return text;
}

// Runs the bundle with module/exports/define undefined so its UMD wrapper takes the
// global-object branch; falls back to handing it a CommonJS shim if it found some other
// route to a module system.
function evalLibrary(code, spec) {
    const source = `${code}\n//# sourceURL=richmd/${spec.cacheFile}`;
    try {
        new Function("module", "exports", "define", "require", source)
            .call(window, undefined, undefined, undefined, undefined);
    } catch (e) {
        throw new Error(`evaluating ${spec.cacheFile} threw: ${e.message}`);
    }

    let lib = window[spec.global] || globalThis[spec.global];
    if (!lib) {
        const shim = { exports: {} };
        new Function("module", "exports", "define", "require", source)
            .call(window, shim, shim.exports, undefined, undefined);
        lib = shim.exports;
    }
    return normalizeLibrary(lib, spec);
}

// Loading the cached file as a real Node module. This one needs no eval at all, so it
// still works if the page's CSP happens to forbid 'unsafe-eval'.
function requireLibrary(spec) {
    const full = cachePath(spec.cacheFile);
    if (!full || typeof require !== "function") return null;
    try {
        return normalizeLibrary(require(full), spec);
    } catch (e) {
        return null;
    }
}

// Last resort, and the one that started all this: a plain script tag. Kept because on
// client builds where BetterDiscord does strip the CSP and no module globals leak into
// page scope, it works fine and costs nothing.
function scriptTagLibrary(spec) {
    return new Promise((resolve, reject) => {
        const url = spec.urls[0];
        const script = document.createElement("script");
        // A tag that is silently dropped fires neither onload nor onerror, which would
        // leave the loader pending forever and the settings panel stuck on "loading…".
        const timer = setTimeout(() => reject(new Error(`script tag for ${url} never resolved`)), 30000);
        const settle = (fn, arg) => { clearTimeout(timer); fn(arg); };
        script.src = url;
        script.onload = () => {
            const lib = normalizeLibrary(window[spec.global] || globalThis[spec.global], spec);
            if (lib) settle(resolve, lib);
            else settle(reject, new Error(`${spec.global} global missing after loading ${url}`));
        };
        script.onerror = () => settle(reject, new Error(`script tag blocked or failed for ${url}`));
        document.head.appendChild(script);
    });
}

// Some bundlers hand back the ES module namespace rather than the API object itself.
function normalizeLibrary(lib, spec) {
    if (!lib || (typeof lib !== "object" && typeof lib !== "function")) return null;
    if (spec.probe && typeof lib[spec.probe] !== "function" && lib.default && typeof lib.default[spec.probe] === "function") {
        lib = lib.default;
    }
    if (spec.probe && typeof lib[spec.probe] !== "function") return null;
    return lib;
}

async function ensureLibrary(spec) {
    const already = normalizeLibrary(window[spec.global], spec);
    if (already) {
        window[spec.global] = already;
        return already;
    }

    const failures = [];
    let code = null;
    try {
        code = await ensureText(spec.urls, spec.cacheFile);
    } catch (e) {
        failures.push(e.message);
    }

    if (code) {
        try {
            const lib = evalLibrary(code, spec);
            if (lib) {
                window[spec.global] = lib;
                return lib;
            }
            failures.push(`eval produced no usable ${spec.global}`);
        } catch (e) {
            failures.push(`eval: ${e.message}`);
        }

        const required = requireLibrary(spec);
        if (required) {
            window[spec.global] = required;
            return required;
        }
        failures.push("require() of the cached copy produced no usable export");
    }

    try {
        const lib = await scriptTagLibrary(spec);
        window[spec.global] = lib;
        return lib;
    } catch (e) {
        failures.push(`script tag: ${e.message}`);
    }

    throw new Error(failures.join(" | "));
}

module.exports = class MarkdownMermaid {
    constructor(meta) {
        this.meta = meta;
        this.settings = Object.assign({}, CONFIG.defaultSettings, BdApi.Data.load(CONFIG.name, "settings"));
        this._observer = null;
        this._intervalId = null;
        this._scanScheduled = false;
        this._mermaidSeq = 0;
        this._mermaidLoaded = false;
        this._katexLoaded = false;
        this._status = { mermaid: "not loaded", katex: "not loaded" };
        this._statusListeners = [];
    }

    setStatus(key, value) {
        this._status[key] = value;
        this._statusListeners.forEach(fn => fn());
    }

    saveSettings() {
        BdApi.Data.save(CONFIG.name, "settings", this.settings);
    }

    start() {
        BdApi.DOM.addStyle(CONFIG.name, STYLE);

        if (!CLASS_MESSAGE_CONTENT) {
            console.warn(`[${CONFIG.name}] Could not resolve Discord's messageContent class via webpack; relying on id/class-substring fallbacks.`);
        }

        if (this.settings.mermaid) this.loadMermaid();
        if (this.settings.latex) this.loadKatex();

        this._observer = new MutationObserver(mutations => this.handleMutations(mutations));
        this._observer.observe(document.body, { childList: true, subtree: true });

        // Safety net for mutations we don't catch directly (e.g. SPA route/channel changes).
        this._intervalId = setInterval(() => this.scanAll(), CONFIG.safetyScanIntervalMs);

        this.scanAll();
    }

    stop() {
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
        BdApi.DOM.removeStyle(CONFIG.name);
        BdApi.DOM.removeStyle(`${CONFIG.name}-katex`);
    }

    // ---------- library loading ----------

    detectTheme() {
        return document.documentElement.classList.contains("theme-light") ? "default" : "dark";
    }

    async loadKatex() {
        if (this._katexLoaded) return;
        this.setStatus("katex", "loading…");

        // Inlined rather than <link>ed for the same CSP reason as the scripts. KaTeX's
        // stylesheet points at its font files with a relative url(fonts/…), which would
        // otherwise resolve against discord.com once the rules are inlined.
        try {
            const css = await ensureText(CONFIG.katex.cssUrls, CONFIG.katex.cssCacheFile);
            BdApi.DOM.addStyle(`${CONFIG.name}-katex`, css.replace(/url\((['"]?)fonts\//g, `url($1${CONFIG.katex.assetBase}fonts/`));
        } catch (e) {
            console.warn(`[${CONFIG.name}] katex stylesheet unavailable; math will render unstyled`, e);
        }

        try {
            await ensureLibrary(CONFIG.katex);
            this._katexLoaded = true;
            this.setStatus("katex", "loaded");
            this.scanAll();
        } catch (e) {
            this.setStatus("katex", `failed — ${e.message}`);
            console.error(`[${CONFIG.name}] could not load katex`, e);
        }
    }

    async loadMermaid() {
        if (this._mermaidLoaded) return;
        this.setStatus("mermaid", "loading…");
        try {
            const mermaid = await ensureLibrary(CONFIG.mermaid);
            mermaid.initialize({
                startOnLoad: false,
                theme: this.detectTheme(),
                securityLevel: "strict",
                fontFamily: CONFIG.mermaidFont,
                // The dagre-based diagrams (flowchart, class, state) default to HTML labels:
                // each label is a <div> inside a <foreignObject>, measured with
                // getBoundingClientRect(). That measurement happens in one styling context
                // and the SVG is then painted inside a Discord message in another, so
                // Discord's own font/line-height rules make labels come out a different size
                // than the boxes computed for them -- class-diagram rows get clipped and
                // state-diagram nodes collapse to nothing. SVG <text> is measured with
                // getBBox() in SVG user units instead, which no HTML CSS can reach.
                flowchart: { htmlLabels: false },
            });
            this._mermaidLoaded = true;
            this.setStatus("mermaid", "loaded");
            this.scanAll();
        } catch (e) {
            this.setStatus("mermaid", `failed — ${e.message}`);
            console.error(`[${CONFIG.name}] could not load mermaid`, e);
        }
    }

    // ---------- DOM scanning entrypoint ----------

    scanAll() {
        getMessageContents(document.body).forEach(el => this.processMessageEl(el));
    }

    scheduleScan() {
        if (this._scanScheduled) return;
        this._scanScheduled = true;
        const run = () => {
            this._scanScheduled = false;
            this.scanAll();
        };
        if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 200 });
        else setTimeout(run, 50);
    }

    // Avoid rescanning on every keystroke in the message composer / unrelated UI churn.
    isInputAreaTarget(target) {
        let cur = target && target.nodeType === 1 ? target : (target && target.parentNode);
        for (let i = 0; i < 20 && cur && cur.nodeType === 1; i++) {
            const ce = cur.getAttribute && cur.getAttribute("contenteditable");
            if (ce === "true" || ce === "") return true;
            if (cur.getAttribute && cur.getAttribute("role") === "textbox") return true;
            cur = cur.parentNode;
        }
        return false;
    }

    mutationLooksRelevant(mutation) {
        if (this.isInputAreaTarget(mutation.target)) return false;
        for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.matches && node.matches(MESSAGE_CONTENT_SELECTOR)) return true;
            if (CLASS_MESSAGE_LIST_ITEM && node.classList && node.classList.contains(CLASS_MESSAGE_LIST_ITEM)) return true;
            if (node.querySelector && node.querySelector(MESSAGE_CONTENT_SELECTOR)) return true;
        }
        return false;
    }

    handleMutations(mutations) {
        for (const mutation of mutations) {
            if (this.mutationLooksRelevant(mutation)) {
                this.scheduleScan();
                return;
            }
        }
    }

    processMessageEl(el) {
        if (!el) return;

        if (this.settings.markdown || (this.settings.latex && this._katexLoaded)) {
            try {
                this.processMarkdownExtras(el);
            } catch (e) {
                console.error(`[${CONFIG.name}] markdown extras failed`, e);
            }
        }

        if (this.settings.mermaid) this.renderMermaidIn(el);
        if (this.settings.images) this.processImagePreviews(el);
    }

    // ---------- headings + tables + latex (idempotent: re-validates on every call so ----------
    // ---------- it survives Discord re-rendering a message's DOM subtree) ----------

    processMarkdownExtras(el) {
        const expected = el.getAttribute("data-richmd-count");
        if (expected !== null) {
            const actual = el.querySelectorAll(".richmd-rendered").length;
            if (String(actual) === expected) return;
        }

        // Reset: unhide any previously-hidden original content, drop previous renders.
        el.querySelectorAll(".richmd-rendered").forEach(n => n.remove());
        el.querySelectorAll(".richmd-hidden").forEach(w => {
            const parent = w.parentNode;
            if (!parent) return;
            while (w.firstChild) parent.insertBefore(w.firstChild, w);
            parent.removeChild(w);
        });

        const wantsMarkdown = this.settings.markdown;
        const wantsLatex = this.settings.latex && this._katexLoaded;
        const { text, nodeMap } = buildVisibleTextMap(el);
        const hasHeading = wantsMarkdown && text.includes("#");
        const hasRule = wantsMarkdown && /[-*_]{3}/.test(text);
        const hasTable = wantsMarkdown && text.includes("|");
        const hasDetails = wantsMarkdown && /<details/i.test(text);

        // Candidates carry a priority: block structures should win over anything nested
        // inside their own text (a <details> fold wins over a heading/table it contains;
        // tables/headings win over an inline LaTeX span nested inside a cell), so an outer
        // structure doesn't get skipped just because something matched inside it too.
        const candidates = [];
        if (hasDetails) findDetailsBlocks(text).forEach(b => candidates.push({ start: b.start, end: b.end, priority: 3, kind: "details", data: { block: b, fullText: text } }));
        if (hasTable) findTables(text).forEach(t => candidates.push({ start: t.start, end: t.end, priority: 2, kind: "table", data: t }));
        if (hasHeading) findHeadings(text).forEach(h => candidates.push({ start: h.start, end: h.end, priority: 2, kind: "heading", data: h }));
        if (hasRule) findRules(text).forEach(r => candidates.push({ start: r.start, end: r.end, priority: 2, kind: "hr", data: r }));

        if (wantsLatex) {
            const message = getMessageFromContentEl(el);
            const raw = getLatexSearchText(message);
            if (raw && (raw.includes("$") || raw.includes("\\[") || raw.includes("\\("))) {
                locateLatexInDomText(text, findLatex(raw)).forEach(x => {
                    candidates.push({ start: x.start, end: x.end, priority: 1, kind: "latex", data: x });
                });
            }
        }

        if (!candidates.length) {
            el.setAttribute("data-richmd-count", "0");
            return;
        }

        candidates.sort((a, b) => (b.priority - a.priority) || ((b.end - b.start) - (a.end - a.start)));
        const accepted = [];
        const overlapsAccepted = (s, e) => accepted.some(c => s < c.end && e > c.start);
        for (const c of candidates) {
            if (overlapsAccepted(c.start, c.end)) continue;
            accepted.push(c);
        }

        // Tail-first so earlier offsets in nodeMap stay valid as we mutate the DOM.
        accepted.sort((a, b) => b.start - a.start);

        for (const match of accepted) {
            const wrapper = hideRange(nodeMap, match.start, match.end);
            if (!wrapper || !wrapper.parentNode) continue;
            const rendered = this.buildRenderedNode(match);
            wrapper.parentNode.insertBefore(rendered, wrapper.nextSibling);
        }
        // Count every rendered node including nested ones (a table inside a <details>),
        // because the guard at the top of this method compares against a live
        // querySelectorAll: counting only top-level insertions made the two disagree on
        // every pass, so each message was torn down and rebuilt twice a second.
        el.setAttribute("data-richmd-count", String(el.querySelectorAll(".richmd-rendered").length));
    }

    buildRenderedNode(match) {
        if (match.kind === "table") return this.buildTableNode(match.data);
        if (match.kind === "heading") return this.buildHeadingNode(match.data);
        if (match.kind === "hr") return this.buildRuleNode();
        if (match.kind === "details") return this.buildDetailsNode(match.data.block, match.data.fullText);
        return this.buildLatexNode(match.data);
    }

    buildDetailsNode(block, fullText) {
        const details = document.createElement("details");
        details.className = "richmd-rendered richmd-details";

        if (block.summary !== null) {
            const summaryEl = document.createElement("summary");
            summaryEl.appendChild(textToFragment(block.summary.trim()));
            details.appendChild(summaryEl);
        }

        const body = document.createElement("div");
        body.className = "richmd-details-body";
        body.appendChild(this.buildExtrasFragment(fullText, block.bodyStart, block.bodyEnd, block.children));
        details.appendChild(body);

        return details;
    }

    // Builds a fragment for a text range that may itself contain nested <details>
    // (already parsed, passed in as knownChildren) plus headings/tables found fresh within
    // that range — so a table or heading inside a fold renders instead of staying plain
    // text. LaTeX isn't recursed into folds (it depends on matching the raw message string,
    // which isn't scoped to a sub-range here) — a possible future extension.
    buildExtrasFragment(fullText, start, end, knownChildren) {
        const slice = fullText.slice(start, end);
        const candidates = [];
        knownChildren.forEach(b => candidates.push({ start: b.start, end: b.end, priority: 3, kind: "details", data: { block: b, fullText } }));
        if (slice.includes("|")) findTables(slice).forEach(t => candidates.push({ start: start + t.start, end: start + t.end, priority: 2, kind: "table", data: t }));
        if (slice.includes("#")) findHeadings(slice).forEach(h => candidates.push({ start: start + h.start, end: start + h.end, priority: 2, kind: "heading", data: h }));
        if (/[-*_]{3}/.test(slice)) findRules(slice).forEach(r => candidates.push({ start: start + r.start, end: start + r.end, priority: 2, kind: "hr", data: r }));

        candidates.sort((a, b) => (b.priority - a.priority) || ((b.end - b.start) - (a.end - a.start)));
        const accepted = [];
        const overlapsAccepted = (s, e) => accepted.some(c => s < c.end && e > c.start);
        for (const c of candidates) {
            if (overlapsAccepted(c.start, c.end)) continue;
            accepted.push(c);
        }
        accepted.sort((a, b) => a.start - b.start);

        const frag = document.createDocumentFragment();
        let cursor = start;
        for (const match of accepted) {
            const before = fullText.slice(cursor, match.start).trim();
            if (before) frag.appendChild(textToFragment(before));
            frag.appendChild(this.buildRenderedNode(match));
            cursor = match.end;
        }
        const after = fullText.slice(cursor, end).trim();
        if (after) frag.appendChild(textToFragment(after));
        return frag;
    }

    buildTableNode(t) {
        const wrap = document.createElement("div");
        wrap.className = "richmd-rendered richmd-table-wrap";
        wrap.innerHTML = renderTableInner(t.headers, t.rows);
        return wrap;
    }

    buildRuleNode() {
        const hr = document.createElement("hr");
        hr.className = "richmd-rendered richmd-hr";
        return hr;
    }

    buildHeadingNode(h) {
        const div = document.createElement("div");
        div.className = `richmd-rendered richmd-heading richmd-h${h.level}`;
        div.textContent = h.content;
        return div;
    }

    buildLatexNode(x) {
        const el = document.createElement(x.display ? "div" : "span");
        el.className = `richmd-rendered ${x.display ? "richmd-latex-block" : "richmd-latex-inline"}`;
        try {
            el.innerHTML = window.katex.renderToString(x.content.trim(), {
                throwOnError: false,
                displayMode: !!x.display,
            });
        } catch (e) {
            el.textContent = x.content;
            el.classList.add("richmd-latex-error");
        }
        return el;
    }

    // ---------- image link previews (![alt](url) -> Discord renders as a literal "!" ----------
    // ---------- followed by a masked link; we upgrade that pair to a real <img>) ----------

    findImagePreviewCandidates(el) {
        return Array.from(el.querySelectorAll("a[href]")).filter(a => {
            if (a.dataset.richmdImgPending || a.classList.contains("richmd-rendered")) return false;
            const prev = a.previousSibling;
            return !!(prev && prev.nodeType === Node.TEXT_NODE && prev.nodeValue.endsWith("!"));
        });
    }

    processImagePreviews(el) {
        this.findImagePreviewCandidates(el).forEach(a => {
            a.dataset.richmdImgPending = "1";
            const bangNode = a.previousSibling;
            const url = a.href;
            const alt = a.textContent;

            const probe = new Image();
            probe.onload = () => {
                if (!a.parentNode) return;
                const wrap = document.createElement("div");
                wrap.className = "richmd-rendered richmd-image-wrap";
                const link = document.createElement("a");
                link.href = url;
                link.target = "_blank";
                link.rel = "noreferrer noopener";
                const img = document.createElement("img");
                img.src = url;
                img.alt = alt;
                img.className = "richmd-image-preview";
                link.appendChild(img);
                wrap.appendChild(link);

                a.parentNode.insertBefore(wrap, a);
                if (bangNode && bangNode.nodeValue && bangNode.nodeValue.endsWith("!")) {
                    bangNode.nodeValue = bangNode.nodeValue.slice(0, -1);
                }
                a.remove();
            };
            probe.onerror = () => { /* not an image; leave the original link untouched, don't retry */ };
            probe.src = url;
        });
    }

    // ---------- mermaid ----------

    // Three ways to recognise a mermaid block, in descending order of confidence:
    //   1. an explicit language class, when Discord's highlighter emits one;
    //   2. the raw message text, pairing the Nth ```mermaid fence with the Nth <pre><code>;
    //   3. sniffing the code itself for a mermaid diagram header.
    // (3) is what actually makes this work in practice: mermaid isn't a language
    // highlight.js knows, so Discord usually emits a bare <code class="hljs"> with no
    // language on it at all, and the React-fiber walk that recovers the raw message text
    // comes back empty for embeds and some bot messages -- leaving the first two routes
    // with nothing to go on. Anything found only by sniffing is checked with
    // mermaid.parse() before its code block is touched, so an ordinary code block that
    // happens to open with "graph" or "pie" is left exactly as it was.

    findMermaidBlocks(el) {
        const blocks = new Map(); // code element -> was it explicitly labelled mermaid?

        el.querySelectorAll('code[class*="mermaid" i]').forEach(c => blocks.set(c, true));

        const allPre = Array.from(el.querySelectorAll("pre code"));
        const message = getMessageFromContentEl(el);
        const raw = message ? message.content : null;
        if (raw) {
            const fenceRe = /```([\w-]*)\r?\n?[\s\S]*?```/g;
            let idx = 0;
            let m;
            while ((m = fenceRe.exec(raw))) {
                if (/^mermaid$/i.test(m[1].trim()) && allPre[idx]) blocks.set(allPre[idx], true);
                idx++;
            }
        }

        for (const codeEl of allPre) {
            if (blocks.has(codeEl)) continue;
            if (MERMAID_HEADER_RE.test(codeEl.textContent.trim())) blocks.set(codeEl, false);
        }

        return Array.from(blocks, ([codeEl, explicit]) => ({ codeEl, explicit }));
    }

    renderMermaidIn(el) {
        if (!this._mermaidLoaded || !window.mermaid) return;
        this.findMermaidBlocks(el).forEach(({ codeEl, explicit }) => {
            this.renderMermaidBlock(codeEl, explicit).catch(e => console.error(`[${CONFIG.name}] mermaid render failed`, e));
        });
    }

    async renderMermaidBlock(codeEl, explicit) {
        const pre = codeEl.closest("pre") || codeEl.parentElement;
        if (!pre || pre.dataset.richmdMermaid) return;
        // Set before the await below so a rescan can't start a second render of this block.
        // Deliberately left set even when we bail out, so a block we've already rejected
        // isn't re-parsed on every scan.
        pre.dataset.richmdMermaid = "1";

        const source = codeEl.textContent;

        // A sniffed block is only a guess -- confirm it before hiding anything.
        if (!explicit) {
            let parses = false;
            try {
                parses = (await window.mermaid.parse(source, { suppressErrors: true })) !== false;
            } catch (e) {
                parses = false;
            }
            if (!parses) return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "richmd-mermaid-wrapper";

        const diagram = document.createElement("div");
        diagram.className = "richmd-mermaid-diagram";
        diagram.textContent = "Rendering diagram…";

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "richmd-mermaid-toggle";
        toggle.textContent = "View source";
        toggle.addEventListener("click", () => {
            const showingSource = pre.style.display !== "none";
            pre.style.display = showingSource ? "none" : "";
            toggle.textContent = showingSource ? "View source" : "Hide source";
        });

        wrapper.appendChild(diagram);
        wrapper.appendChild(toggle);

        pre.insertAdjacentElement("beforebegin", wrapper);
        pre.style.display = "none";

        try {
            const id = `richmd-mermaid-${++this._mermaidSeq}`;
            // Passing the destination element makes mermaid do its measuring pass inside the
            // very container the diagram ends up in, rather than loose in document.body.
            const { svg } = await window.mermaid.render(id, source, diagram);
            diagram.innerHTML = svg;
        } catch (err) {
            diagram.textContent = `Mermaid render error: ${err && err.message ? err.message : err}`;
            diagram.classList.add("richmd-mermaid-error");
        }
    }

    // ---------- settings ----------

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.cssText = "display:flex;flex-direction:column;gap:16px;padding:4px 0;";

        const note = document.createElement("div");
        note.textContent = "Changes apply to new messages immediately. Reload Discord (Ctrl+R) to fully re-apply to messages already on screen.";
        note.style.cssText = "color: var(--text-muted); font-size: 12px; margin-bottom: 4px;";
        panel.appendChild(note);

        const makeToggle = (key, label, desc) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;";

            const text = document.createElement("div");
            const title = document.createElement("div");
            title.textContent = label;
            title.style.cssText = "color: var(--header-primary); font-weight:600;";
            const sub = document.createElement("div");
            sub.textContent = desc;
            sub.style.cssText = "color: var(--text-muted); font-size:12px;";
            text.append(title, sub);

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = !!this.settings[key];
            checkbox.addEventListener("change", () => {
                this.settings[key] = checkbox.checked;
                this.saveSettings();
                if (key === "mermaid" && checkbox.checked && !this._mermaidLoaded) this.loadMermaid();
                if (key === "latex" && checkbox.checked && !this._katexLoaded) this.loadKatex();
            });

            row.append(text, checkbox);
            return row;
        };

        panel.appendChild(makeToggle("markdown", "Extra Markdown", "Render heading (# ...), table (| a | b |), horizontal rule (---), and <details>/<summary> collapsible-section syntax that Discord doesn't support natively."));
        panel.appendChild(makeToggle("mermaid", "Mermaid Diagrams", "Render ```mermaid code blocks as diagrams (loads mermaid.js from cdn.jsdelivr.net)."));
        panel.appendChild(makeToggle("latex", "LaTeX Math", "Render raw \\(...\\), \\[...\\], $...$ and $$...$$ math that isn't wrapped in backticks (loads katex from cdn.jsdelivr.net). Backtick-wrapped math still goes through the separate LaTeX Renderer plugin."));
        panel.appendChild(makeToggle("images", "Image Link Previews", "Render ![alt](url) image links as an actual inline image preview instead of Discord's plain link."));

        // Mermaid and LaTeX both depend on a downloaded library, and when that download is
        // blocked the only symptom is that nothing renders. Show the real reason here
        // instead of leaving it in the console.
        const status = document.createElement("div");
        status.style.cssText = "color: var(--text-muted); font-size:12px; border-top:1px solid var(--background-modifier-accent); padding-top:12px; white-space:pre-wrap;";
        const paint = () => {
            status.textContent = `mermaid: ${this._status.mermaid}\nkatex: ${this._status.katex}`;
        };
        paint();
        this._statusListeners.push(paint);
        panel.appendChild(status);

        const redownload = document.createElement("button");
        redownload.type = "button";
        redownload.textContent = "Clear cached libraries and re-download";
        redownload.style.cssText = "align-self:flex-start; background: var(--button-secondary-background); color: var(--text-normal); border:none; border-radius:3px; padding:6px 12px; cursor:pointer;";
        redownload.addEventListener("click", () => {
            clearCache();
            delete window.mermaid;
            delete window.katex;
            this._mermaidLoaded = false;
            this._katexLoaded = false;
            if (this.settings.mermaid) this.loadMermaid();
            if (this.settings.latex) this.loadKatex();
        });
        panel.appendChild(redownload);

        return panel;
    }
};
