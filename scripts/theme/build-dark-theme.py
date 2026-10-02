#!/usr/bin/env python3
"""
ReqGen v3.0.6 — dark theme builder.

1. Rewrites every hard-coded colour in app/**/*.css into a role-aware CSS
   variable WITH the original colour as fallback:
       background:#fff      ->  background:var(--c-bg-ffffff,#fff)
       color:#203457        ->  color:var(--c-fg-203457,#203457)
       border:1px solid #e2e8f0 -> border:1px solid var(--c-ln-e2e8f0,#e2e8f0)
   Light theme is therefore pixel-identical (variables are undefined in light).
2. Computes a dark counterpart for every (role, colour) pair in OKLab and writes
   them to app/theme-dark.generated.css under html[data-theme="dark"].

Idempotent: colours already inside var(--c-…) are left alone. Re-run after
adding new CSS:  python3 scripts/theme/build-dark-theme.py
"""
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
CSS_FILES = sorted(p for p in (ROOT / "app").rglob("*.css") if p.name not in ("theme-dark.generated.css", "theme-dark.css"))
OUT = ROOT / "app" / "theme-dark.generated.css"

HEX = re.compile(r"(?<![\w-])#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b")
NAMED = {"white": "ffffff", "black": "000000"}
RGBA = re.compile(r"(?<![\w-])rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)")
DECL = re.compile(r"(?P<prop>(?<![\w-])-?-?[a-zA-Z-]+)(?P<sep>\s*:\s*)(?P<val>[^;{}]*)")


# ---------------- colour maths (OKLab) ----------------
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lin_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055

def hex_to_rgb(h):
    h = h.lower()
    if len(h) in (3, 4):
        h = "".join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)), (h[6:8] if len(h) == 8 else "")

def to_oklch(rgb):
    r, g, b = (srgb_to_lin(c) for c in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (x ** (1 / 3) if x > 0 else 0 for x in (l, m, s))
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, math.hypot(a, bb), math.atan2(bb, a)

def from_oklch(L, C, H):
    a, bb = C * math.cos(H), C * math.sin(H)
    l_ = L + 0.3963377774 * a + 0.2158037573 * bb
    m_ = L - 0.1055613458 * a - 0.0638541728 * bb
    s_ = L - 0.0894841775 * a - 1.2914855480 * bb
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return "".join(f"{round(lin_to_srgb(c) * 255):02x}" for c in (r, g, b))


# ---------------- v3.0.10: IET logo palette remap ----------------
# Barderian-blue family (OKLCH hue 238-275°) -> IET orange at the SAME lightness
# (contrast preserved). Navy text -> warm charcoal ink. Sky/teal, green, purple,
# neutrals and status colours are untouched.
IET_HUE = math.radians(42)
def iet_remap(hexcode):
    rgb, alpha = hex_to_rgb(hexcode)
    L, C, H = to_oklch(rgb)
    deg = (math.degrees(H) + 360) % 360
    if C < 0.04 or not (238 <= deg <= 275):
        return None
    if L < 0.36:
        C2 = min(C, 0.03) * 0.7          # navy -> warm charcoal ink
    elif L > 0.86:
        C2 = min(C * 1.4, 0.05)          # pale blue tint -> pale orange tint
    else:
        C2 = min(C, 0.17)                # brand blue -> IET orange
    return from_oklch(L, C2, IET_HUE) + alpha

def dark_value(role, hexcode):
    mapped = iet_remap(hexcode)
    if mapped:
        hexcode = mapped
    rgb, alpha = hex_to_rgb(hexcode)
    L, C, H = to_oklch(rgb)
    NAVY_H = -1.68                           # ReqGen navy hue (OKLCH, radians)
    if C < 0.012:                            # neutrals take a faint navy tint in dark mode
        C, H = 0.0, NAVY_H
    if role == "bg":
        if L >= 0.94:                       # page / card / tint surfaces
            L2, C2 = 0.215 - (1 - L) * 1.2, max(C * 0.9, 0.022)
            L2 = max(L2, 0.165)
        elif L >= 0.80:                     # greys / pale fills
            L2, C2 = 0.25 + (0.94 - L) * 0.45, max(C * 0.75, 0.02)
        elif L >= 0.62:                     # mid fills (e.g. disabled)
            L2, C2 = L * 0.62, C * 0.85
        else:                               # brand, saturated, dark headers: keep
            return hexcode
    elif role == "fg":
        if L < 0.50:                        # dark text -> light text
            L2, C2 = 0.96 - L * 0.42, min(C * 0.8, 0.12)
        elif L < 0.78:                      # muted / coloured text -> lighter
            L2, C2 = min(0.86, L + 0.16), C
        else:                               # already light (white on colour): keep
            return hexcode
    else:  # line
        if L >= 0.80:
            L2, C2 = 0.30 + (1 - L) * 0.45, max(C * 0.6, 0.02)
        else:
            return hexcode
    return from_oklch(L2, C2, H) + alpha


def role_for(prop):
    p = prop.lower()
    if p.startswith("--"):
        return None                           # custom properties handled by hand
    if p in ("color", "caret-color", "-webkit-text-fill-color", "text-decoration-color", "column-rule-color"):
        return "fg"
    if p.startswith("background") or p == "fill":
        return "bg"
    if p.startswith("border") or p.startswith("outline") or p in ("box-shadow", "stroke", "text-shadow"):
        return "ln"
    return None


def norm(h):
    h = h.lower()
    if len(h) in (3, 4):
        h = "".join(ch * 2 for ch in h)
    return h


used = {}  # (role, hex) -> dark


def rewrite_value(prop, val):
    role = role_for(prop)
    if not role or "var(--c-" in val:
        return val

    def sub_hex(m):
        h = norm(m.group(1))
        used[(role, h)] = None
        return f"var(--c-{role}-{h},#{m.group(1)})"

    out = HEX.sub(sub_hex, val)

    def sub_named(m):
        word = m.group(0).lower()
        h = NAMED[word]
        used[(role, h)] = None
        return f"var(--c-{role}-{h},{m.group(0)})"

    out = re.sub(r"(?<![\w#-])(white|black)(?![\w-])", sub_named, out, flags=re.I)

    def sub_rgba(m):
        r, g, b_ = (min(255, int(m.group(i))) for i in (1, 2, 3))
        a = m.group(4)
        if a is None:
            alpha = ""
        else:
            av = float(a[:-1]) / 100 if a.endswith("%") else float(a)
            if av < 0.35:          # faint shadows/tints: leave as they are
                return m.group(0)
            alpha = f"{round(max(0, min(1, av)) * 255):02x}"
        h = f"{r:02x}{g:02x}{b_:02x}{alpha}"
        used[(role, h)] = None
        return f"var(--c-{role}-{h},{m.group(0)})"

    out = RGBA.sub(sub_rgba, out)
    return out


def transform(text):
    # Only rewrite inside declaration blocks (between { and }), never selectors.
    result, depth, i, buf = [], 0, 0, []
    out = []
    pos = 0
    for m in re.finditer(r"\{([^{}]*)\}", text):
        out.append(text[pos:m.start()])
        body = m.group(1)
        body = DECL.sub(lambda d: f"{d.group('prop')}{d.group('sep')}{rewrite_value(d.group('prop'), d.group('val'))}", body)
        out.append("{" + body + "}")
        pos = m.end()
    out.append(text[pos:])
    return "".join(out)


changed = 0
for path in CSS_FILES:
    src = path.read_text(encoding="utf-8")
    new = transform(src)
    if new != src:
        path.write_text(new, encoding="utf-8")
        changed += 1

# Also collect variables already present from a previous run.
for path in CSS_FILES:
    for role, h in re.findall(r"var\(--c-(bg|fg|ln)-([0-9a-f]{6}(?:[0-9a-f]{2})?),", path.read_text(encoding="utf-8")):
        used[(role, h)] = None


# ---------------- named design tokens (custom properties) ----------------
KEEP_WORDS = ("blue", "green", "red", "danger", "success", "warning", "violet", "purple", "orange", "cyan",
              "accent", "focus", "chart", "gold-500", "gold-600", "info", "tooltip")
def token_role(name):
    n = name.lower()
    if re.search(r"(soft|-50$|-100$|blue-soft|danger-soft|gold-50|gold-100|surface|card|canvas|page-bg|(^|-)bg$|-bg-?|mock-bg|track)", n):
        return "bg"
    if re.search(r"(line|border|grid)", n):
        return "ln"
    if re.search(r"(text|navy|muted|ink)", n):
        return "fg"
    if any(w in n for w in KEEP_WORDS):
        return None
    return None

# Tokens are emitted at EVERY selector that defines them (a token defined on
# .rg-content would otherwise override a page-level dark value).
BRAND_BLUE_DARK = "#4d8bff"   # brand blue as text on dark surfaces (contrast >= 4.5:1)
BLUE_TOKEN = re.compile(r"^--(rg3|rg|mock|rg-a|rg-s5|reqgen|rg6|rg7|rg-admin|rg-mock|gov)-blue(-2)?$|^--gov-blue-600$|^--mock-blue-2$")
token_by_selector = {}   # selector -> {name: dark}
token_lines = []
for path in CSS_FILES:
    text = path.read_text(encoding="utf-8")
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", text):
        sel = " ".join(re.sub(r"/\*.*?\*/", " ", sel, flags=re.S).split())
        if sel.startswith("@") or not sel:
            continue
        for name, value in re.findall(r"(--(?!c-|color-)[a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|white|black)\b", body):
            role = token_role(name)
            h = NAMED.get(value.lower(), norm(value.lstrip("#")))
            if BLUE_TOKEN.match(name):
                dark = BRAND_BLUE_DARK
            elif role:
                dark = "#" + dark_value(role, h)
            else:
                continue
            token_by_selector.setdefault(sel, {})[name] = dark

def split_top(sel):
    """Split a selector list on commas that are not inside brackets."""
    out, depth, cur = [], 0, ""
    for ch in sel:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    out.append(cur)
    return out

def scoped(sel):
    parts = []
    for one in split_top(sel):
        one = one.strip()
        if one in (":root", "html", ":root,:host", ":host"):
            parts.append('html[data-theme="dark"]')
        elif one.startswith("html"):
            parts.append('html[data-theme="dark"]' + one[4:])
        else:
            parts.append(f'html[data-theme="dark"] {one}')
    return ",".join(parts)

token_blocks = []
for sel, names in sorted(token_by_selector.items()):
    decls = "".join(f"{n}:{v};" for n, v in sorted(names.items()))
    token_blocks.append(f"{scoped(sel)}{{{decls}}}")
token_lines = [f"  /* {sum(len(v) for v in token_by_selector.values())} token definitions in {len(token_by_selector)} scopes — see blocks below */"]

# ---------------- Tailwind palette mirror ----------------
tw = (ROOT / "node_modules" / "tailwindcss" / "theme.css").read_text(encoding="utf-8")
palette = dict(re.findall(r"(--color-[a-z]+-\d+):\s*([^;]+);", tw))
MIRROR = {"50": "950", "100": "900", "200": "800", "300": "700", "700": "300", "800": "200", "900": "100", "950": "50"}
NEUTRAL = ("slate", "gray", "zinc", "neutral", "stone")
tw_lines = []
for name in sorted(palette):
    fam, shade = name[len("--color-"):].rsplit("-", 1)
    if shade not in MIRROR:
        continue
    target = f"--color-{fam}-{MIRROR[shade]}"
    if target in palette:
        # Neutrals mirror fully. Coloured tints (50-200) become dark tints;
        # coloured text shades (700-950) become light text.
        tw_lines.append(f"  {name}:{palette[target]};")
brand = dict(re.findall(r"(--color-brand-\d+):\s*(#[0-9a-fA-F]{6})", (ROOT / "app" / "globals.css").read_text(encoding="utf-8")))
for name in sorted(brand):
    shade = name.rsplit("-", 1)[1]
    if shade in MIRROR and f"--color-brand-{MIRROR[shade]}" in brand:
        tw_lines.append(f"  {name}:{brand['--color-brand-' + MIRROR[shade]]};")

lines = [
    "/* ==========================================================================",
    "   ReqGen v3.0.6 — DARK THEME (generated by scripts/theme/build-dark-theme.py)",
    "   Do not edit by hand: re-run the script. Light theme never uses these.",
    "   ========================================================================== */",
    'html[data-theme="dark"]{',
]
for (role, h) in sorted(used):
    lines.append(f"  --c-{role}-{h}:#{dark_value(role, h)};")
lines.append("  /* named design tokens */")
lines.extend(token_lines)
lines.append("  /* Tailwind palette, mirrored (50<->950 …); mid shades 400-600 unchanged */")
lines.extend(tw_lines)
lines.append("}")
lines.append("/* named design tokens, emitted at their own scopes */")
lines.extend(token_blocks)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")

# ---------------- light-mode IET remap (theme-iet.generated.css) ----------------
light = ['/* ReqGen v3.0.10 — IET logo palette (generated). Light mode remap of the', '   former Barderian-blue family; dark mode is computed from these values. */', 'html[data-theme]{']
n_remap = 0
for (role, h) in sorted(used):
    m = iet_remap(h)
    if m:
        light.append(f"  --c-{role}-{h}:#{m};"); n_remap += 1
for name, value in sorted(palette.items()):
    fam = name[len("--color-"):].rsplit("-", 1)[0]
    if fam in ("blue", "indigo"):
        mo = re.match(r"oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)", value.strip())
        if mo:
            L, Cc = float(mo.group(1)) / 100, float(mo.group(2))
            C2 = min(Cc, 0.03) * 0.7 if L < 0.36 else (min(Cc * 1.4, 0.05) if L > 0.86 else min(Cc, 0.17))
            light.append(f"  {name}:oklch({L*100:.1f}% {C2:.3f} 42);"); n_remap += 1
for name, hexv in sorted(brand.items()):
    m = iet_remap(hexv.lstrip("#"))
    if m: light.append(f"  {name}:#{m};"); n_remap += 1
light.append("}")
light_tokens = []
for path in CSS_FILES:
    text = path.read_text(encoding="utf-8")
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", text):
        sel = " ".join(re.sub(r"/\*.*?\*/", " ", sel, flags=re.S).split())
        if sel.startswith("@") or not sel: continue
        decls = ""
        for name, value in re.findall(r"(--(?!c-|color-)[a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b", body):
            m = iet_remap(value.lstrip("#"))
            if m: decls += f"{name}:#{m};"
        if decls:
            parts = []
            for one in split_top(sel):
                one = one.strip()
                if one in (":root", "html", ":root,:host", ":host"): parts.append("html[data-theme]")
                elif one.startswith("html"): parts.append("html[data-theme]" + one[4:])
                else: parts.append(f"html[data-theme] {one}")
            light_tokens.append(f"{','.join(parts)}{{{decls}}}"); n_remap += 1
(ROOT / "app" / "theme-iet.generated.css").write_text("\n".join(light + light_tokens) + "\n", encoding="utf-8")
print(f"IET palette remap: {n_remap} definitions → app/theme-iet.generated.css")
print(f"{changed} stylesheet(s) rewritten · {len(used)} role-colour pairs · {sum(len(v) for v in token_by_selector.values())} token defs · {len(tw_lines)} palette shades · wrote {OUT.relative_to(ROOT)}")
