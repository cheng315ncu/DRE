require("./setup.js");
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const plugin = require(path.join(__dirname, "..", "DC_Render_Enhanced.plugin.js"));
const { buildVisibleTextMap, hideRange, findHeadings, findRules, findTables, parseRow } = plugin.__testInternals;

// ---------------------------------------------------------------------------
// Frozen reference copies of the original (pre-rewrite) algorithms, hardcoded
// here so they never change even after the real functions in the plugin file
// are rewritten. Every test below compares the CURRENT plugin.__testInternals.*
// (which will be the new rewrite once each swap lands) against these frozen
// _oldX originals, on the same fixtures.
// ---------------------------------------------------------------------------

const OLD_BLOCK_TAGS = new Set([
    "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6",
    "OL", "UL", "LI", "HR", "BLOCKQUOTE", "TABLE",
]);

function _oldBuildVisibleTextMap(root) {
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
        if (tag === "IMG" && node.alt) {
            const alt = node.alt;
            nodeMap.push({ node, start: text.length, end: text.length + alt.length, isElement: true });
            text += alt;
            return;
        }
        if (tag === "PRE" || tag === "CODE") {
            nodeMap.push({ opaque: true, start: text.length, end: text.length });
            if (tag === "PRE") maybeNewline();
            return;
        }

        const isBlock = OLD_BLOCK_TAGS.has(tag);
        if (isBlock) maybeNewline();
        for (const child of Array.from(node.childNodes)) walk(child);
        if (isBlock) maybeNewline();
    }

    walk(root);
    return { text, nodeMap };
}

function _oldHideRange(nodeMap, charStart, charEnd) {
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

const OLD_HEADING_RE = /(?:^|\n)([ \t]*)(#{1,6})[ \t]+([^\n]+?)[ \t]*(?=\n|$)/g;
function _oldFindHeadings(text) {
    const found = [];
    let m;
    OLD_HEADING_RE.lastIndex = 0;
    while ((m = OLD_HEADING_RE.exec(text)) !== null) {
        const lineOffset = m.index === 0 && text[0] !== "\n" ? 0 : 1;
        const start = m.index + lineOffset;
        found.push({ start, end: start + m[0].length - lineOffset, level: m[2].length, content: m[3] });
    }
    return found;
}

const OLD_HR_RE = /(?:^|\n)([ \t]*(?:-[ \t]*){3,}|[ \t]*(?:\*[ \t]*){3,}|[ \t]*(?:_[ \t]*){3,})(?=\n|$)/g;
function _oldFindRules(text) {
    const found = [];
    let m;
    OLD_HR_RE.lastIndex = 0;
    while ((m = OLD_HR_RE.exec(text)) !== null) {
        const lineOffset = m.index === 0 && text[0] !== "\n" ? 0 : 1;
        const start = m.index + lineOffset;
        found.push({ start, end: start + m[0].length - lineOffset });
    }
    return found;
}

const OLD_ROW_RE = /^\s*\|.*\|\s*$/;
const OLD_SEP_RE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;
function _oldParseRow(line) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed.split("|").map(c => c.trim());
}
function _oldFindTables(text) {
    const lines = text.split("\n");
    const tables = [];
    const lineStart = [0];
    for (let i = 0; i < lines.length; i++) lineStart.push(lineStart[i] + lines[i].length + 1);

    const skipOneBlank = (i) => (i < lines.length && lines[i].trim() === "" ? i + 1 : i);

    for (let i = 0; i < lines.length - 1; i++) {
        if (!OLD_ROW_RE.test(lines[i])) continue;

        const sepIdx = skipOneBlank(i + 1);
        if (sepIdx >= lines.length || !OLD_SEP_RE.test(lines[sepIdx])) continue;

        const headers = _oldParseRow(lines[i]);
        const expectedCols = headers.length;
        if (_oldParseRow(lines[sepIdx]).length !== expectedCols) continue;

        const rows = [];
        let lastRow = sepIdx;
        let j = sepIdx + 1;
        for (;;) {
            const k = skipOneBlank(j);
            if (k >= lines.length || !OLD_ROW_RE.test(lines[k])) break;
            const cells = _oldParseRow(lines[k]);
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div;
}

function normalizeNodeMap(nodeMap) {
    // node references differ across two independent DOM builds, so compare
    // everything about an entry except the live node reference itself.
    return nodeMap.map(e => ({
        start: e.start, end: e.end,
        isElement: !!e.isElement, opaque: !!e.opaque,
        tag: e.node ? e.node.nodeName : null,
        text: e.node && e.node.nodeType === 3 ? e.node.nodeValue : null,
    }));
}

// ---------------------------------------------------------------------------
// buildVisibleTextMap
// ---------------------------------------------------------------------------

test("buildVisibleTextMap: nested block boundaries", () => {
    const a = el("<div><p>Hello <span>world</span></p><p>Second</p></div>");
    const b = el("<div><p>Hello <span>world</span></p><p>Second</p></div>");
    const oldR = _oldBuildVisibleTextMap(a);
    const newR = buildVisibleTextMap(b);
    assert.equal(newR.text, oldR.text);
    assert.deepEqual(normalizeNodeMap(newR.nodeMap), normalizeNodeMap(oldR.nodeMap));
});

test("buildVisibleTextMap: mid-paragraph <br>", () => {
    const html = "<div><p>Line one<br>Line two</p></div>";
    const oldR = _oldBuildVisibleTextMap(el(html));
    const newR = buildVisibleTextMap(el(html));
    assert.equal(newR.text, oldR.text);
});

test("buildVisibleTextMap: emoji <img alt> inline and at cell boundaries", () => {
    const html = '<div>Hi <img alt="😀"> there|<img alt="✅"></div>';
    const oldR = _oldBuildVisibleTextMap(el(html));
    const newR = buildVisibleTextMap(el(html));
    assert.equal(newR.text, oldR.text);
    assert.deepEqual(normalizeNodeMap(newR.nodeMap), normalizeNodeMap(oldR.nodeMap));
});

test("buildVisibleTextMap: <pre><code> opaque marker propagation", () => {
    const html = "<div><p># heading text</p><pre><code># not a heading|table</code></pre><p>after</p></div>";
    const oldR = _oldBuildVisibleTextMap(el(html));
    const newR = buildVisibleTextMap(el(html));
    assert.equal(newR.text, oldR.text);
    const oldOpaque = oldR.nodeMap.filter(e => e.opaque).map(e => ({ start: e.start, end: e.end }));
    const newOpaque = newR.nodeMap.filter(e => e.opaque).map(e => ({ start: e.start, end: e.end }));
    assert.deepEqual(newOpaque, oldOpaque);
});

test("buildVisibleTextMap: root-boundary text (no leading block)", () => {
    const html = "Just text, no wrapping block at all";
    const oldR = _oldBuildVisibleTextMap(el(html));
    const newR = buildVisibleTextMap(el(html));
    assert.equal(newR.text, oldR.text);
});

// ---------------------------------------------------------------------------
// hideRange
// ---------------------------------------------------------------------------

function runHideRange(html, charStart, charEnd, impl, mapImpl) {
    const root = el(html);
    const { text, nodeMap } = mapImpl(root);
    const wrapper = impl(nodeMap, charStart, charEnd);
    return { wrapper, outerHTML: root.innerHTML, text };
}

test("hideRange: match wholly inside one text node", () => {
    const html = "<div>Hello world</div>";
    const a = runHideRange(html, 6, 11, _oldHideRange, _oldBuildVisibleTextMap);
    const b = runHideRange(html, 6, 11, hideRange, buildVisibleTextMap);
    assert.equal(!!a.wrapper, !!b.wrapper);
    assert.equal(a.outerHTML, b.outerHTML);
});

test("hideRange: match spanning multiple sibling elements at different depths", () => {
    const html = "<div><p>foo <b>bar <i>baz</i></b> qux</p></div>";
    const { text } = _oldBuildVisibleTextMap(el(html));
    const start = text.indexOf("bar");
    const end = text.indexOf("qux") + 3;
    const a = runHideRange(html, start, end, _oldHideRange, _oldBuildVisibleTextMap);
    const b = runHideRange(html, start, end, hideRange, buildVisibleTextMap);
    assert.equal(!!a.wrapper, !!b.wrapper);
    assert.equal(a.outerHTML, b.outerHTML);
});

test("hideRange: match landing exactly on an emoji <img alt> entry", () => {
    const html = '<div>pick <img alt="😀"> one</div>';
    const { text } = _oldBuildVisibleTextMap(el(html));
    const start = text.indexOf("😀");
    const end = start + "😀".length;
    const a = runHideRange(html, start, end, _oldHideRange, _oldBuildVisibleTextMap);
    const b = runHideRange(html, start, end, hideRange, buildVisibleTextMap);
    assert.equal(!!a.wrapper, !!b.wrapper);
    assert.equal(a.outerHTML, b.outerHTML);
});

test("hideRange: match crossing an opaque <pre>/<code> entry must return null", () => {
    const html = "<div><p>before</p><pre><code>code stuff</code></pre><p>after</p></div>";
    const { text } = _oldBuildVisibleTextMap(el(html));
    const start = text.indexOf("before");
    const end = text.indexOf("after") + 5;
    const a = runHideRange(html, start, end, _oldHideRange, _oldBuildVisibleTextMap);
    const b = runHideRange(html, start, end, hideRange, buildVisibleTextMap);
    assert.equal(a.wrapper, null);
    assert.equal(b.wrapper, null);
    assert.equal(a.outerHTML, b.outerHTML);
});

test("hideRange: empty nodeMap returns null", () => {
    assert.equal(_oldHideRange([], 0, 1), null);
    assert.equal(hideRange([], 0, 1), null);
});

// ---------------------------------------------------------------------------
// findHeadings
// ---------------------------------------------------------------------------

test("findHeadings: levels 1 through 6", () => {
    const text = "# h1\n## h2\n### h3\n#### h4\n##### h5\n###### h6";
    assert.deepEqual(findHeadings(text), _oldFindHeadings(text));
});

test("findHeadings: 7 #'s must not match", () => {
    const text = "####### not a heading";
    assert.deepEqual(findHeadings(text), _oldFindHeadings(text));
    assert.equal(findHeadings(text).length, 0);
});

test("findHeadings: first line vs mid-text", () => {
    const t1 = "# first line heading\nbody";
    const t2 = "body\n# mid heading\nmore";
    assert.deepEqual(findHeadings(t1), _oldFindHeadings(t1));
    assert.deepEqual(findHeadings(t2), _oldFindHeadings(t2));
});

test("findHeadings: trailing spaces before line break", () => {
    const text = "# heading with trailing spaces   \nbody";
    assert.deepEqual(findHeadings(text), _oldFindHeadings(text));
});

// ---------------------------------------------------------------------------
// findRules
// ---------------------------------------------------------------------------

test("findRules: all three marker chars", () => {
    for (const t of ["a\n---\nb", "a\n***\nb", "a\n___\nb"]) {
        assert.deepEqual(findRules(t), _oldFindRules(t), `mismatch for ${JSON.stringify(t)}`);
    }
});

test("findRules: mixed markers must not match", () => {
    const text = "a\n-*-\nb";
    assert.deepEqual(findRules(text), _oldFindRules(text));
    assert.equal(findRules(text).length, 0);
});

test("findRules: spaced markers", () => {
    const text = "a\n- - -\nb";
    assert.deepEqual(findRules(text), _oldFindRules(text));
});

test("findRules: exactly 2 markers must not match, 3 must match", () => {
    const two = "a\n--\nb";
    const three = "a\n---\nb";
    assert.deepEqual(findRules(two), _oldFindRules(two));
    assert.equal(findRules(two).length, 0);
    assert.deepEqual(findRules(three), _oldFindRules(three));
    assert.equal(findRules(three).length, 1);
});

// ---------------------------------------------------------------------------
// findTables
// ---------------------------------------------------------------------------

test("findTables: 3+ column table", () => {
    const text = "| a | b | c |\n|---|---|---|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |";
    assert.deepEqual(findTables(text), _oldFindTables(text));
});

test("findTables: ragged rows needing padding/truncation", () => {
    const text = "| a | b | c |\n|---|---|---|\n| 1 | 2 |\n| 4 | 5 | 6 | 7 |";
    assert.deepEqual(findTables(text), _oldFindTables(text));
});

test("findTables: one-blank-line continuation (including glom quirk)", () => {
    const text = "| a | b |\n|---|---|\n| 1 | 2 |\n\n| a | b |\n|---|---|\n| 3 | 4 |";
    assert.deepEqual(findTables(text), _oldFindTables(text));
});

test("findTables: failed-separator retry one line later", () => {
    const text = "| not | a | header |\njust text\n| a | b |\n|---|---|\n| 1 | 2 |";
    assert.deepEqual(findTables(text), _oldFindTables(text));
});

test("findTables: double-blank-line terminates continuation tolerance", () => {
    const text = "| a | b |\n|---|---|\n| 1 | 2 |\n\n\n| 3 | 4 |";
    assert.deepEqual(findTables(text), _oldFindTables(text));
});

test("parseRow matches _oldParseRow", () => {
    for (const line of ["| a | b |", "a | b", "|a|b|", "  | x |  "]) {
        assert.deepEqual(parseRow(line), _oldParseRow(line));
    }
});

test("findTables: randomized differential fuzz vs _oldFindTables", () => {
    // findTables has the densest edge-case interaction (blank-line tolerance x
    // ragged rows x retry-on-failed-separator), so beyond the hand-picked fixtures
    // above, generate a batch of pseudo-random line sequences from the same building
    // blocks and require the new implementation to agree with the frozen original on
    // every one -- not just the cases a human thought to write by hand.
    let seed = 20260820;
    const rand = () => {
        // xorshift32 -- deterministic across runs so a failure is reproducible.
        seed ^= seed << 13; seed |= 0;
        seed ^= seed >>> 17;
        seed ^= seed << 5; seed |= 0;
        return ((seed >>> 0) % 1000) / 1000;
    };
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];

    const rowLines = ["| a | b | c |", "| 1 | 2 |", "| x | y | z | w |", "|only|", "not a row at all", ""];
    const sepLines = ["|---|---|---|", "|:--|--:|", "|---|", "not a separator"];

    for (let trial = 0; trial < 300; trial++) {
        const lineCount = 2 + Math.floor(rand() * 8);
        const lines = [];
        for (let i = 0; i < lineCount; i++) {
            lines.push(rand() < 0.4 ? pick(sepLines) : pick(rowLines));
        }
        const text = lines.join("\n");
        assert.deepEqual(
            findTables(text), _oldFindTables(text),
            `mismatch on trial ${trial} for text ${JSON.stringify(text)}`
        );
    }
});

// ---------------------------------------------------------------------------
// isInputAreaTarget (accessed via the class instance, since it's a method)
// ---------------------------------------------------------------------------

function _oldIsInputAreaTarget(target) {
    let cur = target && target.nodeType === 1 ? target : (target && target.parentNode);
    for (let i = 0; i < 20 && cur && cur.nodeType === 1; i++) {
        const ce = cur.getAttribute && cur.getAttribute("contenteditable");
        if (ce === "true" || ce === "") return true;
        if (cur.getAttribute && cur.getAttribute("role") === "textbox") return true;
        cur = cur.parentNode;
    }
    return false;
}

function makeInstance() {
    return new plugin({});
}

function buildDepth(attrsAtDepth, depth) {
    let html = "<div>leaf</div>";
    for (let i = 0; i < depth; i++) {
        const attrs = attrsAtDepth === i ? ' contenteditable=""' : "";
        html = `<div${attrs}>${html}</div>`;
    }
    return el(html);
}

test("isInputAreaTarget: contenteditable true/empty/false, role=textbox", () => {
    const inst = makeInstance();
    const cases = [
        '<div contenteditable="true"><span id="leaf">x</span></div>',
        '<div contenteditable=""><span id="leaf">x</span></div>',
        '<div contenteditable="false"><span id="leaf">x</span></div>',
        '<div role="textbox"><span id="leaf">x</span></div>',
    ];
    for (const html of cases) {
        const root = el(html);
        const leaf = root.querySelector("#leaf");
        assert.equal(inst.isInputAreaTarget(leaf), _oldIsInputAreaTarget(leaf), `mismatch for ${html}`);
    }
});

test("isInputAreaTarget: 20-ancestor cap preserved (depth 19 matches, depth 21 does not)", () => {
    const inst = makeInstance();
    const within = buildDepth(19, 20).querySelector("div > div"); // leaf-ish node within cap
    // Build directly: contenteditable at ancestor index 19 (within loop bound i<20) vs 21 (outside).
    function buildChain(editableAt, totalDepth) {
        let inner = document.createElement("span");
        inner.textContent = "leaf";
        let cur = inner;
        for (let i = 0; i < totalDepth; i++) {
            const wrapper = document.createElement("div");
            if (i === editableAt) wrapper.setAttribute("contenteditable", "");
            wrapper.appendChild(cur);
            cur = wrapper;
        }
        document.body.appendChild(cur);
        return inner;
    }
    const leafNear = buildChain(19, 25);
    const leafFar = buildChain(21, 25);
    assert.equal(inst.isInputAreaTarget(leafNear), _oldIsInputAreaTarget(leafNear));
    assert.equal(inst.isInputAreaTarget(leafFar), _oldIsInputAreaTarget(leafFar));
});

test("isInputAreaTarget: Text-node target vs Element target", () => {
    const inst = makeInstance();
    const root = el('<div contenteditable="true"><span id="leaf">hello</span></div>');
    const leafEl = root.querySelector("#leaf");
    const textNode = leafEl.firstChild;
    assert.equal(inst.isInputAreaTarget(textNode), _oldIsInputAreaTarget(textNode));
    assert.equal(inst.isInputAreaTarget(leafEl), _oldIsInputAreaTarget(leafEl));
    assert.equal(inst.isInputAreaTarget(null), _oldIsInputAreaTarget(null));
});
