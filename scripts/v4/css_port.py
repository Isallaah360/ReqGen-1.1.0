#!/usr/bin/env python3
"""Port the approved v4 mock-up stylesheet into the ReqGen app.

Every class becomes v4-<name>, every custom property --v4-<name>, element
selectors are scoped under .v4-root, and plain whites/greys on screen
components become tokens so dark mode works. Paper templates (request letter,
voucher, reports) keep black on white.
"""
import re, sys

SRC = sys.argv[1]
OUT = sys.argv[2]
css = open(SRC).read()
css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)

PAPER = ("v3a4", "reqdoc", "pvdoc", "pv-a4", "rpt", "sched", "items", "topbox", "fb", "sigbox", "box2", "lf", "g12",
         "signrow", "signs", "a4", "pvfoot", "rpt-a4", "iet-stamp", "stamp-host", "c1", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c12")

TINTS = {
    "#fff": "var(--v4-surface)", "#ffffff": "var(--v4-surface)",
    "#fafbfd": "var(--v4-surface-2)", "#fbfcfe": "var(--v4-surface-2)", "#f8fafd": "var(--v4-surface-2)",
    "#f3f5f9": "var(--v4-surface-2)", "#f1f4f8": "var(--v4-surface-2)", "#f3f6fb": "var(--v4-surface-2)",
    "#f1f5f9": "var(--v4-surface-2)", "#f6f8fb": "var(--v4-surface-2)", "#f5f7fb": "var(--v4-bg)",
    "#e9edf3": "var(--v4-surface-3)", "#eef2f7": "var(--v4-line-2)", "#e3e9f2": "var(--v4-line)", "#e7ecf3": "var(--v4-line)",
    "#c9d3e2": "var(--v4-line-strong)", "#d5dde9": "var(--v4-line-strong)", "#d5ddea": "var(--v4-line-strong)", "#d9e0ea": "var(--v4-line-strong)",
    "#fff8f2": "var(--v4-brand-tint)", "#fff1e6": "var(--v4-brand-tint)", "#fffaf6": "var(--v4-brand-tint)", "#fdeee5": "var(--v4-brand-soft)",
    "#f2faf6": "var(--v4-green-tint)", "#eaf7f0": "var(--v4-green-tint)",
    "#fff5f4": "var(--v4-red-tint)", "#fffaf9": "var(--v4-red-tint)", "#fff6f5": "var(--v4-red-tint)",
    "#fffcf5": "var(--v4-amber-tint)", "#fff8ec": "var(--v4-amber-tint)", "#fff6ef": "var(--v4-brand-tint)",
    "#eef4ff": "var(--v4-blue-tint)", "#f3f6ff": "var(--v4-blue-tint)", "#f8faff": "var(--v4-blue-tint)", "#f1f5fc": "var(--v4-blue-tint)",
    "#f3f0ff": "var(--v4-violet-tint)",
}

def prefix_selector(sel: str) -> str:
    sel = sel.strip()
    if sel.startswith(":root"):
        return ".v4-root"
    if sel in ("html",):
        return None
    if sel == "body":
        return ".v4-ui"
    # classes
    sel = re.sub(r"(?<![\d])\.(?!\d)([a-zA-Z_][\w-]*)", r".v4-\1", sel)
    # scope element-led selectors and universal selectors
    first = re.match(r"^([a-zA-Z][a-zA-Z0-9]*|\*|\[|:)", sel)
    if first and not sel.startswith(".v4-"):
        sel = ":where(.v4-ui) " + sel
    return sel

def is_paper(selector: str) -> bool:
    return any(re.search(r"\.v4-" + re.escape(p) + r"(?![\w-])", selector) for p in PAPER)

def transform_decls(decls: str, paper: bool) -> str:
    decls = re.sub(r"var\(--([\w-]+)", lambda m: "var(--v4-" + m.group(1), decls)
    decls = re.sub(r"(^|;)\s*--([\w-]+)\s*:", lambda m: m.group(1) + " --v4-" + m.group(2) + ":", decls)
    decls = re.sub(r"animation:\s*([\w-]+)", lambda m: "animation: v4-" + m.group(1), decls)
    if not paper:
        def fix(m):
            prop, val = m.group(1), m.group(2)
            if prop.strip().lower() in ("color",):
                return m.group(0)
            v = re.sub(r"#[0-9a-fA-F]{3,6}\b", lambda h: TINTS.get(h.group(0).lower(), h.group(0)), val)
            return prop + ":" + v
        decls = re.sub(r"((?:^|;)\s*(?:background(?:-color)?|border(?:-[a-z]+)*|box-shadow|outline)\s*)\s*:([^;]*)", fix, decls)
    return decls

out = []
i = 0
n = len(css)

def parse_block(text):
    """Yield (selector, body) or ('@media ...', inner) at one nesting level."""
    pos = 0
    items = []
    while pos < len(text):
        m = re.compile(r"\s*([^{}]+)\{").match(text, pos)
        if not m:
            break
        head = m.group(1).strip()
        depth = 1
        j = m.end()
        while depth and j < len(text):
            if text[j] == "{": depth += 1
            elif text[j] == "}": depth -= 1
            j += 1
        body = text[m.end(): j - 1]
        items.append((head, body))
        pos = j
    return items

def render(items, indent=""):
    res = []
    for head, body in items:
        if head.startswith("@keyframes"):
            name = head.split()[1]
            res.append(f"@keyframes v4-{name} {{{body}}}")
        elif head.startswith("@media") or head.startswith("@supports"):
            inner = render(parse_block(body), indent + "  ")
            if inner.strip():
                res.append(f"{head} {{\n{inner}\n}}")
        elif head.startswith("@page"):
            res.append(f"{head} {{{body}}}")
        else:
            sels = [prefix_selector(s) for s in head.split(",")]
            sels = [s for s in sels if s]
            if not sels:
                continue
            sel = ", ".join(sels)
            res.append(f"{indent}{sel} {{{transform_decls(body, is_paper(sel))}}}")
    return "\n".join(res)

result = render(parse_block(css))
header = """/* =========================================================================
   ReqGen v4.0.0 — design system (ported from the approved mock-ups).
   Generated by scripts/v4/css_port.py. Classes are v4-*, tokens --v4-*.
   Light and dark themes: see app/v4/v4-theme.css.
   ========================================================================= */
"""
open(OUT, "w").write(header + result + "\n")
print("rules:", result.count("{"))
