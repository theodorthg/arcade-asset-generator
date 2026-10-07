#!/usr/bin/env python3
"""Erzeugt die Comic-Anleitung "Jump & Run in MakeCode Arcade" als .odp.

Aufruf:  python3 tools/make_makecode_course.py [ausgabe.odp]
Benötigt: python-pptx, Pillow, LibreOffice (soffice) für die Umwandlung nach ODP.
"""
import math
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    HERE, "..", "docs", "MakeCode-JumpAndRun-Anleitung.odp")
TMP = tempfile.mkdtemp(prefix="mkcd_")

COMIC = "Comic Sans MS"
BLACK = "1A1A1A"
FONT_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_D = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


# ------------------------------------------------------------------ Pixel-Art
def up(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def player_frame(kind="idle"):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k, skin, hair, org, jeans, shoe = ("#1a1a1a", "#ffd2a0", "#5a3a22",
                                       "#ff9f1c", "#2f5fd0", "#d83a3a")
    # Beine / Schuhe
    legs = {"idle": [(5, 9), (9, 10)], "walk1": [(4, 8), (10, 11)],
            "walk2": [(6, 7), (8, 9)], "jump": [(4, 6), (9, 11)]}[kind]
    top = 13 if kind != "jump" else 12
    for a, b in legs:
        d.rectangle([a, top, b - 3 if b - a > 3 else a + 1, 14], fill=jeans, outline=k)
        d.point((a, 15), fill=shoe)
        d.point((a + 1, 15), fill=shoe)
    # Bauch
    d.ellipse([2, 8, 13, 14], fill=org, outline=k)
    d.point((7, 11), fill="#c9760a")
    # Arme
    if kind == "jump":
        d.rectangle([1, 6, 2, 9], fill=org, outline=k)
        d.rectangle([13, 6, 14, 9], fill=org, outline=k)
        d.point((1, 5), fill=skin)
        d.point((14, 5), fill=skin)
    else:
        d.rectangle([1, 9, 2, 12], fill=org, outline=k)
        d.rectangle([13, 9, 14, 12], fill=org, outline=k)
    # Kopf
    d.ellipse([3, 0, 12, 9], fill=skin, outline=k)
    d.rectangle([4, 1, 11, 2], fill=hair)
    d.point((3, 3), fill=hair)
    d.point((12, 3), fill=hair)
    # Brille
    d.rectangle([4, 4, 6, 6], fill="white")
    d.rectangle([9, 4, 11, 6], fill="white")
    d.line([(3, 3), (12, 3)], fill=k)
    d.line([(3, 7), (7, 7)], fill=k)
    d.line([(8, 7), (12, 7)], fill=k)
    d.line([(3, 3), (3, 7)], fill=k)
    d.line([(7, 3), (8, 7)], fill=k)
    d.line([(12, 3), (12, 7)], fill=k)
    d.point((5, 5), fill=k)
    d.point((10, 5), fill=k)
    d.line([(6, 8), (9, 8)], fill="#a02020")
    return im


def coin_frames():
    out = []
    for hw in (6, 4, 1, 4):
        im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([8 - hw, 2, 8 + hw, 13], fill="#ffd21f", outline="#7a4b00")
        if hw > 2:
            d.line([(8 - hw + 2, 5), (8 - hw + 2, 9)], fill="#fff4a8")
            d.point((8, 7), fill="#c98a00")
        out.append(im)
    return out


def slime():
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.pieslice([1, 4, 14, 20], 180, 360, fill="#4cc84c", outline="#1a1a1a")
    d.rectangle([2, 12, 13, 14], fill="#4cc84c", outline="#1a1a1a")
    d.rectangle([4, 8, 6, 10], fill="white", outline="#1a1a1a")
    d.rectangle([9, 8, 11, 10], fill="white", outline="#1a1a1a")
    d.point((5, 9), fill="#1a1a1a")
    d.point((10, 9), fill="#1a1a1a")
    d.line([(4, 7), (6, 8)], fill="#1a1a1a")
    d.line([(11, 7), (9, 8)], fill="#1a1a1a")
    return im


def boss_img():
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = "#1a1a1a"
    d.polygon([(5, 9), (8, 0), (12, 8)], fill="#f2e6c8", outline=k)
    d.polygon([(27, 9), (24, 0), (20, 8)], fill="#f2e6c8", outline=k)
    d.ellipse([2, 4, 29, 29], fill="#8a3fd0", outline=k)
    d.rectangle([4, 24, 27, 30], fill="#8a3fd0", outline=k)
    d.rectangle([7, 11, 13, 16], fill="#ffe14d", outline=k)
    d.rectangle([18, 11, 24, 16], fill="#ffe14d", outline=k)
    d.rectangle([10, 13, 12, 16], fill="#d01010")
    d.rectangle([19, 13, 21, 16], fill="#d01010")
    d.line([(6, 9), (13, 12)], fill=k, width=1)
    d.line([(25, 9), (18, 12)], fill=k, width=1)
    d.rectangle([8, 20, 23, 25], fill="#3a0b4a", outline=k)
    for x in range(9, 23, 3):
        d.polygon([(x, 20), (x + 2, 20), (x + 1, 23)], fill="white")
    return im


def save(img, name, k=1):
    p = os.path.join(TMP, name)
    up(img, k).save(p)
    return p


def make_assets():
    A = {}
    A["player"] = save(player_frame("idle"), "p_idle.png", 8)
    frames = [("idle", "Stehen"), ("walk1", "Lauf 1"), ("walk2", "Lauf 2"), ("jump", "Sprung")]
    for f, _ in frames:
        A["p_" + f] = save(player_frame(f), "p_%s.png" % f, 8)
    for i, c in enumerate(coin_frames()):
        A["coin%d" % i] = save(c, "coin%d.png" % i, 8)
    A["slime"] = save(slime(), "slime.png", 8)
    A["boss"] = save(boss_img(), "boss.png", 6)
    A["tilepal"] = make_tilepal()
    A["map"] = make_map()
    A["jump"] = make_jump_diagram()
    return A


def tile(kind):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = "#1a1a1a"
    if kind == "ground":
        d.rectangle([0, 0, 15, 15], fill="#8b5a2b", outline=k)
        d.rectangle([0, 0, 15, 4], fill="#4cc84c", outline=k)
        for p in [(3, 9), (10, 11), (6, 13), (12, 8)]:
            d.point(p, fill="#5c3a1a")
    elif kind == "plat":
        d.rectangle([0, 0, 15, 7], fill="#c8a060", outline=k)
        d.line([(0, 3), (15, 3)], fill="#8a6a38")
        d.line([(8, 3), (8, 7)], fill="#8a6a38")
    elif kind == "coin":
        d.ellipse([4, 3, 11, 12], fill="#ffd21f", outline="#7a4b00")
    elif kind == "spawn":
        d.rectangle([1, 1, 14, 14], fill="#36c46a", outline=k)
        d.text((5, 2), "S", fill="white", font=ImageFont.truetype(FONT_D, 11))
    elif kind == "goal":
        d.line([(5, 2), (5, 14)], fill=k, width=1)
        d.polygon([(6, 2), (13, 5), (6, 8)], fill="#e03030", outline=k)
    elif kind == "enemy":
        d.rectangle([1, 1, 14, 14], fill="#a24ad8", outline=k)
        d.text((4, 2), "E", fill="white", font=ImageFont.truetype(FONT_D, 11))
    elif kind == "boss":
        d.rectangle([1, 1, 14, 14], fill="#d02828", outline=k)
        d.text((4, 2), "B", fill="white", font=ImageFont.truetype(FONT_D, 11))
    return im


def make_tilepal():
    kinds = [("ground", "Boden\n(Wand)"), ("plat", "Plattform\n(Wand)"), ("coin", "Münze\n(keine Wand)"),
             ("spawn", "Start\n(keine Wand)"), ("goal", "Ziel\n(keine Wand)"),
             ("enemy", "Gegner-Start"), ("boss", "Boss-Start")]
    W, H = 168, 190
    img = Image.new("RGB", (W * len(kinds) // 2 + 20, 2 * H + 10), "#fff7d6")
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_B, 17)
    for i, (k, label) in enumerate(kinds):
        x = (i % 4) * 150 + 20 if i < 4 else (i - 4) * 150 + 20
        y = 10 if i < 4 else H + 10
        t = up(tile(k), 5)
        bg = Image.new("RGBA", t.size, "#9fd8ff")
        bg.alpha_composite(t)
        img.paste(bg.convert("RGB"), (x + 15, y))
        d.rectangle([x + 15, y, x + 15 + 79, y + 79], outline="#1a1a1a", width=3)
        d.multiline_text((x + 55, y + 88), label, fill="#1a1a1a", font=f, anchor="ma", align="center")
    p = os.path.join(TMP, "tilepal.png")
    img = img.crop((0, 0, 4 * 150 + 40, 2 * H - 10))
    img.save(p)
    return p


def make_map():
    cols, rows = 26, 10
    im = Image.new("RGBA", (cols * 16, rows * 16), "#9fd8ff")
    # Wolken
    d = ImageDraw.Draw(im)
    for cx, cy in [(40, 24), (250, 36), (350, 20)]:
        d.ellipse([cx, cy, cx + 38, cy + 14], fill="white")
        d.ellipse([cx + 10, cy - 6, cx + 30, cy + 8], fill="white")
    grid = [list("." * cols) for _ in range(rows)]
    for x in range(cols):
        grid[8][x] = "g"
        grid[9][x] = "g"
    for x in range(9, 12):
        grid[8][x] = "."
        grid[9][x] = "."
    for (x0, x1, y) in [(4, 7, 6), (12, 15, 5), (17, 20, 3), (21, 24, 6)]:
        for x in range(x0, x1 + 1):
            grid[y][x] = "p"
    marks = {(1, 7): "S", (24, 5): "G", (5, 5): "c", (6, 5): "c", (13, 4): "c", (14, 4): "c",
             (18, 2): "c", (19, 2): "c", (10, 6): "c", (11, 7): "c", (8, 7): "E", (22, 7): "E"}
    for y in range(rows):
        for x in range(cols):
            c = grid[y][x]
            if c in ("g", "p"):
                t = tile("ground" if c == "g" else "plat")
                if c == "g" and y == 9:
                    t = tile("ground")
                    ImageDraw.Draw(t).rectangle([0, 0, 15, 4], fill="#8b5a2b", outline="#1a1a1a")
                im.alpha_composite(t, (x * 16, y * 16))
    for (x, y), m in marks.items():
        kind = {"S": "spawn", "G": "goal", "c": "coin", "E": "enemy"}[m]
        im.alpha_composite(tile(kind), (x * 16, y * 16))
    big = up(im, 4)
    d = ImageDraw.Draw(big)
    for x in range(0, big.width, 64):
        d.line([(x, 0), (x, big.height)], fill=(0, 0, 0, 40))
    for y in range(0, big.height, 64):
        d.line([(0, y), (big.width, y)], fill=(0, 0, 0, 40))
    p = os.path.join(TMP, "map.png")
    big.convert("RGB").save(p)
    return p


def make_jump_diagram():
    S = 2
    W, H = 1000 * S, 440 * S
    im = Image.new("RGB", (W, H), "#fff7d6")
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT_B, 26 * S)
    fs = ImageFont.truetype(FONT_B, 20 * S)
    gy = 360 * S
    d.rectangle([0, gy, W, H], fill="#8b5a2b")
    d.rectangle([0, gy, W, gy + 14 * S], fill="#4cc84c")
    d.line([(0, gy), (W, gy)], fill="#1a1a1a", width=4 * S)

    def arc(x0, y0, x1, y1, peak, color, dash=False):
        pts = []
        n = 60
        for i in range(n + 1):
            t = i / n
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t - 4 * peak * t * (1 - t)
            pts.append((x, y))
        for i in range(0, n, 2 if dash else 1):
            d.line([pts[i], pts[i + 1]], fill=color, width=6 * S)
    # Einfachsprung (links)
    arc(110 * S, gy, 330 * S, gy, 110 * S, "#d54322")
    d.text((220 * S, gy - 150 * S), "1 Sprung\n≈ 2,3 Kacheln", fill="#d54322", font=fs, anchor="ma", align="center")
    # Doppelsprung (rechts)
    x0, x1, x2 = 470 * S, 600 * S, 880 * S
    mid = gy - 110 * S
    arc(x0, gy, x1, mid + 0, 4 * 110 * S * 0.25 * 4 / 4 * 1.0, "#2f5fd0")
    arc(x1, mid, x2, gy, 4 * 110 * S * 0.0 + 150 * S, "#2f5fd0")
    d.ellipse([x1 - 11 * S, mid - 11 * S, x1 + 11 * S, mid + 11 * S], fill="#ffd21f", outline="#1a1a1a", width=3 * S)
    d.text((x1, mid + 34 * S), "2. Druck auf A\n(in der Luft)", fill="#1a1a1a", font=fs, anchor="ma", align="center")
    d.text((700 * S, 60 * S), "Doppelsprung\n≈ 4,7 Kacheln", fill="#2f5fd0", font=fs, anchor="ma", align="center")
    # Figuren
    for x in (110 * S, 470 * S):
        d.ellipse([x - 8 * S, gy - 8 * S, x + 8 * S, gy + 8 * S], fill="#1a1a1a")
    p = player_frame("idle")
    p = up(p, 4 * S)
    im.paste(p, (80 * S, gy - 64 * S - 4 * S), p)
    im.paste(p, (440 * S, gy - 64 * S - 4 * S), p)
    d.text((20 * S, 20 * S), "Sprunghöhe  h = v² / (2·a)   →   150² / 600 ≈ 37,5 px",
           fill="#1a1a1a", font=f)
    out = im.resize((W // S, H // S), Image.LANCZOS)
    pth = os.path.join(TMP, "jump.png")
    out.save(pth)
    return pth


# ------------------------------------------------------------------ pptx-Helfer
def hexrgb(h):
    return RGBColor.from_string(h.lstrip("#").upper())


def I(v):
    return Inches(v)


def shp(sl, kind, x, y, w, h, fill="FFFFFF", line=BLACK, lw=2.5, rot=0):
    s = sl.shapes.add_shape(kind, I(x), I(y), I(w), I(h))
    s.shadow.inherit = False
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = hexrgb(fill)
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = hexrgb(line)
        s.line.width = Pt(lw)
    if rot:
        s.rotation = rot % 360
    return s


def settext(s, text, size=14, bold=False, color=BLACK, align=PP_ALIGN.LEFT, font=COMIC,
            anchor=MSO_ANCHOR.MIDDLE, margin=0.08, italic=False):
    tf = s.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = I(margin)
    tf.margin_top = tf.margin_bottom = I(0.04)
    paras = text if isinstance(text, list) else [text]
    for i, ptxt in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        runs = ptxt if isinstance(ptxt, list) else [(ptxt, {})]
        for r in runs:
            if isinstance(r, str):
                r = (r, {})
            t, o = r
            run = p.add_run()
            run.text = t
            f = run.font
            f.name = o.get("font", font)
            f.size = Pt(o.get("size", size))
            f.bold = o.get("bold", bold)
            f.italic = o.get("italic", italic)
            f.color.rgb = hexrgb(o.get("color", color))
    return s


def tbox(sl, x, y, w, h, text, **kw):
    s = sl.shapes.add_textbox(I(x), I(y), I(w), I(h))
    settext(s, text, **kw)
    return s


def line(sl, x1, y1, x2, y2, color=BLACK, lw=3):
    c = sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, I(x1), I(y1), I(x2), I(y2))
    c.line.color.rgb = hexrgb(color)
    c.line.width = Pt(lw)
    return c


def arrow(sl, x, y, w, h, fill="FF6B35", rot=0, kind=MSO_SHAPE.RIGHT_ARROW):
    return shp(sl, kind, x, y, w, h, fill=fill, lw=2.5, rot=rot)


def bubble(sl, x, y, w, h, text, tip, size=14, fill="FFFFFF"):
    s = shp(sl, MSO_SHAPE.OVAL_CALLOUT if False else MSO_SHAPE.ROUNDED_RECTANGULAR_CALLOUT,
            x, y, w, h, fill=fill, lw=3)
    s.adjustments[0] = (tip[0] - (x + w / 2)) / w
    s.adjustments[1] = (tip[1] - (y + h / 2)) / h
    settext(s, text, size=size, align=PP_ALIGN.CENTER, margin=0.12)
    return s


def pic(sl, path, x, y, w=None, h=None, frame=True):
    kw = {}
    if w:
        kw["width"] = I(w)
    if h:
        kw["height"] = I(h)
    p = sl.shapes.add_picture(path, I(x), I(y), **kw)
    if frame:
        p.line.color.rgb = hexrgb(BLACK)
        p.line.width = Pt(3)
    return p


def note_box(sl, x, y, w, h, text, size=13, fill="FFE14D", rot=-1, title=None):
    s = shp(sl, MSO_SHAPE.RECTANGLE, x, y, w, h, fill=fill, lw=3, rot=rot)
    paras = []
    if title:
        paras.append([(title, {"bold": True, "size": size + 1})])
    paras += text if isinstance(text, list) else [text]
    settext(s, paras, size=size, anchor=MSO_ANCHOR.TOP, margin=0.12)
    return s


def tag(sl, x, y, text, fill="1A1A1A", color="FFFFFF", size=12, w=None):
    w = w or (0.12 * len(text) + 0.4)
    s = shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, 0.34, fill=fill, line=None)
    settext(s, text, size=size, bold=True, color=color, align=PP_ALIGN.CENTER)
    return s


def halftone(sl, x, y, cols, rows, color, step=0.26, maxd=0.17):
    for r in range(rows):
        for c in range(cols):
            d = maxd * (1 - 0.8 * (c + r) / (cols + rows))
            if d < 0.03:
                continue
            e = sl.shapes.add_shape(MSO_SHAPE.OVAL, I(x + c * step), I(y + r * step), I(d), I(d))
            e.shadow.inherit = False
            e.fill.solid()
            e.fill.fore_color.rgb = hexrgb(color)
            e.line.fill.background()


# ------------------------------------------------------------------ Figur
def freeform(sl, pts, fill, line_c=BLACK, lw=2.5):
    fb = sl.shapes.build_freeform(int(pts[0][0] * 914400), int(pts[0][1] * 914400))
    fb.add_line_segments([(int(a * 914400), int(b * 914400)) for a, b in pts[1:]], close=True)
    s = fb.convert_to_shape()
    s.shadow.inherit = False
    s.fill.solid()
    s.fill.fore_color.rgb = hexrgb(fill)
    s.line.color.rgb = hexrgb(line_c)
    s.line.width = Pt(lw)
    return s


def limb(sl, x1, y1, x2, y2, wd, fill, lw):
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    L = math.hypot(x2 - x1, y2 - y1)
    dx, dy = (x2 - x1) / L, (y2 - y1) / L
    ang = math.degrees(math.atan2(-dx, dy))
    return shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, cx - wd / 2, cy - L / 2, wd, L, fill=fill, lw=lw, rot=ang)


def paule(sl, cx, bottom, s=1.0, larm=12, rarm=-12, mouth="smile", look=(0.0, 0.0), brow=0, hold=None):
    """Paule Pixel: gross, Bäuchlein, Brille, kurze Haare. Armwinkel: 0=runter, 90=zur Seite (viewer-rechts), 180=hoch."""
    lw = max(1.5, 3.2 * s)
    top = bottom - 5.0 * s
    skin, shirt, jeans, shoe, hair = "FFD2A0", "FF9F1C", "2F5FD0", "D83A3A", "5A3A22"
    # Beine + Schuhe
    for dx in (-0.85, 0.1):
        shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, cx + dx * s, top + 3.5 * s, 0.75 * s, 1.1 * s, fill=jeans, lw=lw)
    for dx, w in ((-1.15, 1.05), (0.1, 1.05)):
        shp(sl, MSO_SHAPE.OVAL, cx + dx * s, top + 4.55 * s, w * s, 0.45 * s, fill=shoe, lw=lw)
    # Körper + Bauch
    shp(sl, MSO_SHAPE.OVAL, cx - 1.3 * s, top + 1.3 * s, 2.6 * s, 2.5 * s, fill=shirt, lw=lw)
    shp(sl, MSO_SHAPE.OVAL, cx - 0.95 * s, top + 2.35 * s, 2.15 * s, 1.55 * s, fill="FFB74A", lw=lw * 0.8)
    shp(sl, MSO_SHAPE.STAR_5_POINT, cx - 0.3 * s, top + 2.55 * s, 0.7 * s, 0.7 * s, fill="FFE14D", lw=lw * 0.7)
    # Arme (hinter dem Kopf)
    for sign, ang in ((-1, larm), (1, rarm)):
        sx, sy = cx + sign * 1.08 * s, top + 1.95 * s
        a = math.radians(ang)
        # ang positiv: Arm hebt sich nach aussen/oben (sign bestimmt Seite)
        ex = sx + sign * math.sin(a) * 1.3 * s
        ey = sy + math.cos(a) * 1.3 * s
        limb(sl, sx, sy, ex, ey, 0.42 * s, shirt, lw)
        shp(sl, MSO_SHAPE.OVAL, ex - 0.2 * s, ey - 0.2 * s, 0.4 * s, 0.4 * s, fill=skin, lw=lw)
        if hold and sign == 1:
            hold(sl, ex, ey, s)
    # Kopf
    hx, hy, r = cx, top + 0.75 * s, 0.75 * s
    for sign in (-1, 1):
        shp(sl, MSO_SHAPE.OVAL, hx + sign * r * 0.98 - 0.14 * s, hy - 0.02 * s, 0.28 * s, 0.34 * s, fill=skin, lw=lw)
    shp(sl, MSO_SHAPE.OVAL, hx - r, hy - r, 2 * r, 2 * r * 1.04, fill=skin, lw=lw)
    # Haare: kurzer Stoppelschnitt
    pts = []
    for th in range(190, 351, 15):
        t = math.radians(th)
        pts.append((hx + 1.03 * r * math.cos(t), hy + 1.03 * r * math.sin(t) * 1.02))
    zig = []
    n = 7
    for i in range(n + 1):
        x = hx + r * 0.84 - (1.68 * r) * i / n
        y = hy - r * (0.52 if i % 2 == 0 else 0.30)
        zig.append((x, y))
    freeform(sl, pts + zig, hair, lw=lw)
    # Brille
    lensd = 0.5 * s
    for sign in (-1, 1):
        lx, ly = hx + sign * 0.29 * s, hy + 0.02 * s
        shp(sl, MSO_SHAPE.OVAL, lx - lensd / 2, ly - lensd / 2, lensd, lensd, fill="FFFFFF", lw=lw * 1.2)
        shp(sl, MSO_SHAPE.OVAL, lx - 0.08 * s + look[0] * s, ly - 0.08 * s + look[1] * s, 0.16 * s, 0.16 * s,
            fill=BLACK, line=None)
        line(sl, lx + sign * lensd / 2, ly - 0.02 * s, hx + sign * r * 0.98, hy + 0.02 * s, lw=lw)
        line(sl, lx - sign * 0.2 * s, ly - lensd / 2 - 0.08 * s + sign * brow * 0.05 * s,
             lx + sign * 0.22 * s, ly - lensd / 2 - 0.08 * s - sign * brow * 0.05 * s, lw=lw * 1.2)
    line(sl, hx - 0.06 * s, hy + 0.02 * s, hx + 0.06 * s, hy + 0.02 * s, lw=lw)
    # Nase, Wangen, Mund
    shp(sl, MSO_SHAPE.OVAL, hx - 0.09 * s, hy + 0.2 * s, 0.18 * s, 0.15 * s, fill="F5B27A", lw=lw * 0.6)
    for sign in (-1, 1):
        shp(sl, MSO_SHAPE.OVAL, hx + sign * 0.5 * s - 0.1 * s, hy + 0.3 * s, 0.2 * s, 0.14 * s, fill="FF9AA2", line=None)
    if mouth == "smile":
        shp(sl, MSO_SHAPE.FLOWCHART_DELAY, hx - 0.07 * s - 0.0, hy + 0.36 * s - 0.0, 0.25 * s, 0.5 * s,
            fill="B01E2E", lw=lw * 0.8, rot=90).left = I(hx - 0.125 * s)
    elif mouth == "o":
        shp(sl, MSO_SHAPE.OVAL, hx - 0.11 * s, hy + 0.4 * s, 0.22 * s, 0.26 * s, fill="B01E2E", lw=lw * 0.8)
    elif mouth == "grin":
        g = shp(sl, MSO_SHAPE.FLOWCHART_DELAY, hx - 0.15 * s, hy + 0.34 * s, 0.3 * s, 0.6 * s,
                fill="FFFFFF", lw=lw * 0.8, rot=90)
        g.left = I(hx - 0.15 * s)
    return (hx, hy)


def foam_finger(sl, ex, ey, s):  # kleine Geste: Daumen hoch
    shp(sl, MSO_SHAPE.OVAL, ex - 0.06 * s, ey - 0.38 * s, 0.14 * s, 0.3 * s, fill="FFD2A0", lw=max(1.5, 3 * s) * 0.7)


# ------------------------------------------------------------------ Blöcke
CAT = {
    "start": "E0A100", "event": "D54322", "sprite": "4B7BEC", "logic": "2D9CDB", "loop": "20A55B",
    "var": "DC143C", "math": "8E44AD", "scene": "4B6584", "info": "C2185B", "anim": "C79810",
    "func": "3455DB", "game": "8854D0", "music": "C21BAA", "ctrl": "5C6B7A",
}
_mf = ImageFont.truetype(FONT_B, 110)


def tw(text):
    return _mf.getlength(text) / 10 / 72


def blocks(sl, x, y, lines, w_min=1.6, size=11):
    """lines: (indent, text, cat[, kind]) – kind: 'hat' | 'else'. Gibt y unter dem Stapel zurück."""
    H, G, IND, BAR, FOOT = (0.36 if size >= 11 else 0.3), 0.04, 0.3, 0.2, 0.12
    stack = []

    def close(item, foot=True):
        nonlocal y
        ind, cat, y0, hw = item
        bx = x + ind * IND
        if y > y0:
            shp(sl, MSO_SHAPE.RECTANGLE, bx, y0 - 0.02, BAR, y - y0 + 0.02, fill=CAT[cat], line=None)
        if foot:
            shp(sl, MSO_SHAPE.ROUND_2_SAME_RECTANGLE if False else MSO_SHAPE.RECTANGLE,
                bx, y, max(hw * 0.55, 0.9), FOOT, fill=CAT[cat], line=None)
            y += FOOT + G

    for i, ln in enumerate(lines):
        ind, text, cat = ln[0], ln[1], ln[2]
        kind = ln[3] if len(ln) > 3 else ""
        nxt = lines[i + 1][0] if i + 1 < len(lines) else -1
        while stack and stack[-1][0] > ind:
            close(stack.pop())
        if stack and stack[-1][0] == ind:
            if kind == "else":
                close(stack.pop(), foot=False)
            else:
                stack.pop()  # gleiches Niveau -> Container wurde bereits geschlossen
        bx = x + ind * IND
        w = max(w_min, tw(text) * (size / 10) + 0.42)
        shape = MSO_SHAPE.ROUND_2_SAME_RECTANGLE if kind == "hat" else MSO_SHAPE.ROUNDED_RECTANGLE
        b = shp(sl, shape, bx, y, w, H, fill=CAT[cat], line="FFFFFF", lw=1.2)
        settext(b, text, size=size, bold=True, color="FFFFFF", font="Arial", margin=0.1)
        y0 = y + H + G
        y += H + G
        if nxt > ind:
            stack.append((ind, cat, y0 - G, w))
    while stack:
        close(stack.pop())
    return y


# ------------------------------------------------------------------ Folien-Gerüst
prs = Presentation()
prs.slide_width = I(13.333)
prs.slide_height = I(7.5)
BLANK = prs.slide_layouts[6]
BGS = ["BFE6FF", "FFE9A8", "FFD6E0", "D9F2C4", "E4D9FF", "FFDDB8"]
state = {"n": 0}


def new_slide(bg=None, notes=None):
    sl = prs.slides.add_slide(BLANK)
    state["n"] += 1
    sl.background.fill.solid()
    sl.background.fill.fore_color.rgb = hexrgb(bg or BGS[state["n"] % len(BGS)])
    if notes:
        sl.notes_slide.notes_text_frame.text = notes
    return sl


def header(sl, chapter, title):
    halftone(sl, 11.2, 0.15, 9, 5, "FFFFFF", step=0.3, maxd=0.2)
    star = shp(sl, MSO_SHAPE.EXPLOSION1, 0.12, 0.08, 1.35, 1.2, fill="E03030", lw=3)
    settext(star, chapter, size=17, bold=True, color="FFFFFF", align=PP_ALIGN.CENTER, margin=0.0)
    b = shp(sl, MSO_SHAPE.RECTANGLE, 1.45, 0.3, 11.4, 0.85, fill="FFE14D", lw=4, rot=-0.8)
    settext(b, title, size=29, bold=True, align=PP_ALIGN.LEFT, margin=0.25)


def content_slide(chapter, title, say, pose=None, notes=None, bg=None, bw=3.35, bh=2.55, size=13):
    sl = new_slide(bg, notes)
    header(sl, chapter, title)
    pose = pose or {}
    cx, bottom, sc = 1.75, 7.38, 0.56
    hx, hy = paule(sl, cx, bottom, sc, **pose)
    bubble(sl, 0.2, 1.5, bw, bh, say, (hx, hy - 0.5), size=size)
    return sl


def tail(sl, text):
    tbox(sl, 3.7, 7.1, 9.5, 0.3, text, size=10, color="444444", italic=True)


def code_note(sl, x, y, w, h, code, size=10):
    s = shp(sl, MSO_SHAPE.RECTANGLE, x, y, w, h, fill="1E1E2E", lw=2, line="000000")
    paras = [[(l, {"font": "DejaVu Sans Mono", "size": size, "color": "E8E8F0"})] for l in code.split("\n")]
    settext(s, paras, anchor=MSO_ANCHOR.TOP, margin=0.12)
    return s


# =================================================================== Folien
A = make_assets()

# ---------------------------------------------------------------- 1 Titel
sl = new_slide("8FD3FF", notes=(
    "Titelfolie. Paule Pixel führt durch die Anleitung. Alle Blöcke sind sinngemäß in deutscher "
    "MakeCode-Arcade-Oberfläche beschrieben; in den Notizen jeder Folie steht der passende "
    "JavaScript-Code (im Editor oben auf 'JavaScript' umschalten)."))
halftone(sl, 6.0, 0.2, 26, 9, "FFFFFF", step=0.28, maxd=0.2)
for i, c in enumerate(["FFE14D", "FF6B35", "FFFFFF"]):
    shp(sl, MSO_SHAPE.LIGHTNING_BOLT, 5.4 + i * 2.6, 5.7, 1.1, 1.3, fill=c, lw=3, rot=-8 + i * 8)
hx, hy = paule(sl, 2.5, 7.3, 1.28, larm=170, rarm=35, mouth="grin", brow=1)
bubble(sl, 5.2, 4.05, 7.5, 1.45, "Hallo! Ich bin Paule Pixel! Heute lernt ihr, wie man hüpft, "
       "Münzen sammelt und Bosse verhaut!", (hx + 0.95, hy + 1.5), size=18)
for dx, dy, col in ((0.07, 0.07, BLACK), (0, 0, "FFE14D")):
    tbox(sl, 5.0 + dx, 0.55 + dy, 8.2, 1.7, "JUMP & RUN", size=76, bold=True, color=col, align=PP_ALIGN.CENTER)
b = shp(sl, MSO_SHAPE.RECTANGLE, 5.3, 2.3, 7.7, 1.15, fill="E03030", lw=4, rot=-1.5)
settext(b, ["in MakeCode Arcade – mit Blöcken!", [("Sprung · Plattformen · Level · Coins · Gegner-KI · Boss", {"size": 15})]],
        size=24, bold=True, color="FFFFFF", align=PP_ALIGN.CENTER)

# ---------------------------------------------------------------- 2 Fahrplan
sl = content_slide("Los!", "Unser Fahrplan – 10 Comic-Panels bis zum Boss",
                   "Wir bauen Stück für Stück ein komplettes Spiel. Jede Folie = ein Baustein, den du direkt "
                   "in MakeCode nachbauen kannst. Los geht's!", dict(larm=20, rarm=120, mouth="grin"),
                   notes="Übersicht über alle Kapitel.")
panels = [("1", "Projekt, Kacheln & Map", "4B7BEC"), ("2", "Laufen & Schwerkraft", "D54322"),
          ("3", "Einfach- & Doppelsprung", "20A55B"), ("4", "Animationen", "C79810"),
          ("5", "Level per Funktion", "8854D0"), ("6", "Animierte Coins", "E0A100"),
          ("7", "Gegner mit KI", "C2185B"), ("8", "Bosskampf in Phasen", "DC143C"),
          ("9", "Gesamtbild", "4B6584"), ("10", "Tipps & Challenges", "2D9CDB")]
for i, (n, t, c) in enumerate(panels):
    x = 3.75 + (i % 5) * 1.9
    y = 1.55 + (i // 5) * 2.7
    shp(sl, MSO_SHAPE.RECTANGLE, x, y, 1.75, 2.5, fill="FFFFFF", lw=4, rot=(-1 if i % 2 else 1) * 0.8)
    circle = shp(sl, MSO_SHAPE.OVAL, x + 0.1, y + 0.1, 0.62, 0.62, fill=c, lw=3)
    settext(circle, n, size=18, bold=True, color="FFFFFF", align=PP_ALIGN.CENTER, margin=0)
    tbox(sl, x + 0.05, y + 0.85, 1.65, 1.5, t, size=15, bold=True, align=PP_ALIGN.CENTER)
pic(sl, A["p_idle"], 4.0, 6.55, h=0.75, frame=False)
pic(sl, A["coin0"], 5.0, 6.6, h=0.7, frame=False)
pic(sl, A["slime"], 6.0, 6.6, h=0.7, frame=False)
pic(sl, A["boss"], 7.0, 6.35, h=0.95, frame=False)
tbox(sl, 8.2, 6.7, 5.0, 0.5, "Blöcke: Farben angelehnt an MakeCode", size=11, color="555555", italic=True)

# ---------------------------------------------------------------- 3 Projekt & Kacheln
sl = content_slide("1", "Projekt anlegen & Kacheln (Tiles) vorbereiten",
                   "Erst das Fundament: Ohne Kacheln keine Map! Wichtig: Boden & Plattformen bekommen im "
                   "Kachel-Editor die Wand-Markierung. Alles andere sind nur Platzhalter!",
                   dict(larm=15, rarm=95, mouth="smile"),
                   notes=("Neue SpriteKinds (Sprites > SpriteKind bearbeiten): Player, Enemy, Food (Münzen), "
                          "Boss.\nJS: namespace SpriteKind { export const Boss = SpriteKind.create() }\n"
                          "Platzhalter-Kacheln werden zur Laufzeit per Schleife ersetzt (Kapitel 5, 6, 7)."))
steps = [("1", "makecode.com/arcade ▸ Neues Projekt „JumpAndRun“"),
         ("2", "Sprites ▸ SpriteKind: Player, Enemy, Food (=Münze) + neu: Boss"),
         ("3", "Szene ▸ Tilemap ▸ z. B. 32×16 Kacheln (16 px)"),
         ("4", "Kacheln malen; nur Boden/Plattform als „Wand“ markieren"),
         ("5", "Platzhalter-Kacheln: Start, Ziel, Münze, Gegner-Start, Boss-Start")]
for i, (n, t) in enumerate(steps):
    y = 1.55 + i * 0.62
    c = shp(sl, MSO_SHAPE.OVAL, 3.75, y, 0.46, 0.46, fill="E03030", lw=2.5)
    settext(c, n, size=14, bold=True, color="FFFFFF", align=PP_ALIGN.CENTER, margin=0)
    tbox(sl, 4.3, y - 0.05, 8.7, 0.56, t, size=15, bold=True)
pic(sl, A["tilepal"], 3.75, 4.75, h=2.45)
note_box(sl, 8.55, 4.85, 4.4, 2.2, ["Wand = Spieler und Gegner können nicht hindurch. "
                                    "Ziel, Münze & Co. sind KEINE Wände – wir ersetzen sie beim Levelstart "
                                    "durch Sprites oder leere Kacheln."], size=14, title="Merke:")

# ---------------------------------------------------------------- 4 Laufen & Schwerkraft
sl = content_slide("2", "Spieler: Laufen & Schwerkraft",
                   "Der Trick der Schwerkraft: eine ständige Beschleunigung nach unten (ay). Bei den Tasten "
                   "geben wir nur die Seitwärts-Geschwindigkeit frei – sonst fliegt Paule!",
                   dict(larm=10, rarm=110, mouth="smile"),
                   notes=("let player = sprites.create(assets.image`player`, SpriteKind.Player)\n"
                          "controller.moveSprite(player, 100, 0)\nplayer.ay = 300\n"
                          "scene.cameraFollowSprite(player)\ninfo.setLife(3)"))
tag(sl, 3.75, 1.45, "Beim Start")
y = blocks(sl, 3.75, 1.85, [
    (0, "beim Start", "start", "hat"),
    (1, "setze player auf Sprite [Paule 16×16] der Art Player", "sprite"),
    (1, "bewege player mit Tasten  vx 100   vy 0", "event"),
    (1, "setze player  Beschleunigung ay  auf 300", "sprite"),
    (1, "Kamera folgt player", "scene"),
    (1, "setze Leben auf 3", "info"),
])
pic(sl, A["p_idle"], 10.0, 1.7, h=1.3, frame=False)
arrow(sl, 10.45, 3.1, 0.5, 0.9, rot=90, kind=MSO_SHAPE.RIGHT_ARROW)
tbox(sl, 9.6, 4.0, 3.4, 0.5, "ay = 300  ⇒  fällt", size=15, bold=True, align=PP_ALIGN.CENTER)
note_box(sl, 3.75, 5.0, 5.0, 1.9, ["vy NICHT an die Tasten binden (0 lassen), sonst steuerst du hoch/runter.",
                                    "ay größer = schwerer, kleiner = Mond-Gefühl."], size=14, title="Achtung:")
note_box(sl, 9.0, 4.85, 4.0, 2.0, ["Pixelmaß: 16 px = 1 Kachel.", "Tempo 100 px/s ≈ 6 Kacheln pro Sekunde."],
         size=14, title="Faustregel:", fill="C9F2A8", rot=1)

# ---------------------------------------------------------------- 5 Einfachsprung
sl = content_slide("3a", "Der Einfachsprung",
                   "Sprung = kurzer Stoß nach oben: vy auf −150. Aber nur, wenn Paule auf dem Boden steht – "
                   "dafür fragen wir die Kollision nach unten ab!",
                   dict(larm=170, rarm=-20, mouth="grin"),
                   notes=("controller.A.onEvent(ControllerButtonEvent.Pressed, function () {\n"
                          "    if (player.isHittingTile(CollisionDirection.Bottom)) {\n"
                          "        player.vy = -150\n    }\n})"))
tag(sl, 3.75, 1.45, "Sprung auslösen")
blocks(sl, 3.75, 1.85, [
    (0, "wenn Taste A gedrückt", "event", "hat"),
    (1, "wenn  <player berührt Wand [unten]>  dann", "logic"),
    (2, "setze player  Geschwindigkeit vy  auf -150", "sprite"),
])
pic(sl, A["jump"], 3.75, 4.0, h=2.9)
note_box(sl, 10.05, 4.1, 3.0, 2.8, ["−150 px/s und ay = 300 ergibt h = 150² / (2·300) ≈ 37 px, also gut 2 Kacheln.",
                                     "Mehr Höhe? vy ↑ (z. B. −180)."], size=13, title="Rechnung:", rot=1)
tbox(sl, 8.4, 2.2, 4.7, 1.5, ["Kategorien:", "Steuerung ▸ A-Taste", "Logik ▸ wenn", "Sprites ▸ berührt Wand"],
     size=12, color="444444")

# ---------------------------------------------------------------- 6 Doppelsprung
sl = content_slide("3b", "Der Doppelsprung",
                   "Wir zählen die Sprünge! Erlaubt sind 2. Auf dem Boden setzen wir den Zähler zurück – "
                   "aber nur, wenn Paule nicht gerade nach oben fliegt (vy ≥ 0)!",
                   dict(larm=165, rarm=165, mouth="grin", brow=1),
                   notes=("let jumps = 0\n"
                          "controller.A.onEvent(ControllerButtonEvent.Pressed, function () {\n"
                          "    if (jumps < 2) {\n        player.vy = -150\n        jumps += 1\n    }\n})\n"
                          "game.onUpdate(function () {\n"
                          "    if (player.isHittingTile(CollisionDirection.Bottom) && player.vy >= 0) {\n"
                          "        jumps = 0\n    }\n})"))
tag(sl, 3.75, 1.45, "Variable: Sprünge", fill=CAT["var"])
blocks(sl, 3.75, 1.85, [(0, "beim Start", "start", "hat"), (1, "setze [Sprünge] auf 0", "var")])
tag(sl, 3.75, 3.3, "A-Taste", fill=CAT["event"])
blocks(sl, 3.75, 3.7, [
    (0, "wenn Taste A gedrückt", "event", "hat"),
    (1, "wenn  Sprünge < 2  dann", "logic"),
    (2, "setze player  vy  auf -150", "sprite"),
    (2, "ändere [Sprünge] um 1", "var"),
])
tag(sl, 8.2, 1.45, "Zurücksetzen am Boden", fill=CAT["game"])
blocks(sl, 8.2, 1.85, [
    (0, "bei jedem Spiel-Update", "game", "hat"),
    (1, "wenn <player berührt Wand [unten]  und", "logic"),
    (1, "       player vy ≥ 0>  dann", "logic"),
    (2, "setze [Sprünge] auf 0", "var"),
])
note_box(sl, 8.2, 4.4, 4.8, 2.4, ["Ohne „vy ≥ 0“ wäre der Zähler im Sprungmoment noch am Boden "
                                   "→ unendlich viele Sprünge!",
                                   "Zahl 2 → 3 = Dreifachsprung."], size=13, title="Bug-Falle:")

# ---------------------------------------------------------------- 7 Map & Plattformen
sl = content_slide("4", "Plattformen, Map & Kamera",
                   "Malt die Welt wie ein Level-Designer: Boden, Plattformen, Lücken. Die Platzhalter "
                   "(S, Ziel, Münzen, E) setzt du einfach auf die Karte!",
                   dict(larm=20, rarm=100, mouth="smile"),
                   notes=("scene.setBackgroundColor(9)\ntiles.setCurrentTilemap(tilemap`level1`)\n"
                          "scene.cameraFollowSprite(player)"))
pic(sl, A["map"], 3.7, 1.45, w=9.3)
tag(sl, 3.75, 4.85, "Szene", fill=CAT["scene"])
blocks(sl, 3.75, 5.23, [
    (0, "setze Hintergrundfarbe auf [hellblau]", "scene"),
    (0, "setze Tilemap auf [level1]", "scene"),
    (0, "Kamera folgt player", "scene"),
], w_min=3.6)
for (txt, x, col) in (("Lücke = Absturz-Gefahr", 7.6, "E03030"), ("Plattformen: 2–3 Kacheln hoch", 7.6, "2F5FD0")):
    pass
note_box(sl, 8.1, 4.95, 4.9, 2.0,
         ["Sprunghöhe ≈ 2,3 Kacheln → Plattformen höchstens 2 Kacheln höher bauen (Doppelsprung: bis 4).",
          "Lücken ≤ 5 Kacheln breit.",
          "Dunkle Linien = Raster der Kacheln."], size=12, title="Level-Design-Regeln:", rot=0.8)

# ---------------------------------------------------------------- 8 Animationen
sl = content_slide("5", "Animationen: Laufen, Stehen, Springen",
                   "Mit der Erweiterung „character animations“ (Erweiterungen ▸ suchen) wählt Paule "
                   "automatisch den passenden Film – je nach Bewegung!",
                   dict(larm=165, rarm=20, mouth="grin"),
                   notes=("Erweiterung: character animations (Erweiterungen > 'character animations').\n"
                          "characterAnimations.loopFrames(player, assets.animation`walkRight`, 100, "
                          "characterAnimations.rule(Predicate.MovingRight))\n"
                          "characterAnimations.loopFrames(player, assets.animation`walkLeft`, 100, "
                          "characterAnimations.rule(Predicate.MovingLeft))\n"
                          "characterAnimations.loopFrames(player, [assets.image`idle`], 100, "
                          "characterAnimations.rule(Predicate.NotMoving))\n"
                          "characterAnimations.loopFrames(player, [assets.image`jump`], 100, "
                          "characterAnimations.rule(Predicate.MovingUp))\n"
                          "Ohne Erweiterung: animation.runImageAnimation(sprite, [bild1, bild2], 100, true)"))
fr = [("p_idle", "Stehen"), ("p_walk1", "Lauf 1"), ("p_walk2", "Lauf 2"), ("p_jump", "Sprung")]
for i, (k, lab) in enumerate(fr):
    x = 3.75 + i * 1.65
    shp(sl, MSO_SHAPE.RECTANGLE, x, 1.5, 1.5, 1.85, fill="FFFFFF", lw=3)
    pic(sl, A[k], x + 0.1, 1.55, w=1.3, frame=False)
    tbox(sl, x, 2.95, 1.5, 0.4, lab, size=13, bold=True, align=PP_ALIGN.CENTER)
tag(sl, 3.75, 3.5, "Regeln (beim Start)", fill=CAT["anim"])
blocks(sl, 3.75, 3.88, [
    (0, "player: Bilder in Schleife [Lauf rechts] alle 100 ms  wenn [bewegt nach rechts]", "anim"),
    (0, "player: Bilder in Schleife [Lauf links] alle 100 ms  wenn [bewegt nach links]", "anim"),
    (0, "player: Bilder in Schleife [Stehen] alle 100 ms  wenn [steht still]", "anim"),
    (0, "player: Bilder in Schleife [Sprung] alle 100 ms  wenn [bewegt nach oben]", "anim"),
], w_min=4)
note_box(sl, 10.4, 1.5, 2.65, 2.2, ["Links-Bilder: im Bildeditor „spiegeln“ (⇆).",
                                    "Regeln mit mehr Bedingungen (z. B. links + oben) gewinnen."],
         size=12, title="Tipp:", rot=1)

# ---------------------------------------------------------------- 9 Level per Funktion
sl = content_slide("6", "Mehrere Level – per Funktionsaufruf",
                   "Alles, was beim Levelstart passiert, packen wir in EINE Funktion: starteLevel(nr). "
                   "Ziel erreicht? Level +1 und Funktion nochmal aufrufen. Fertig!",
                   dict(larm=20, rarm=170, mouth="grin"),
                   notes=("let level = 0\nfunction startLevel (nr: number) {\n"
                          "    for (let s of sprites.allOfKind(SpriteKind.Food)) { s.destroy() }\n"
                          "    for (let s of sprites.allOfKind(SpriteKind.Enemy)) { s.destroy() }\n"
                          "    if (nr == 1) { tiles.setCurrentTilemap(tilemap`level1`) }\n"
                          "    else if (nr == 2) { tiles.setCurrentTilemap(tilemap`level2`) }\n"
                          "    else { tiles.setCurrentTilemap(tilemap`level3`) }\n"
                          "    for (let ort of tiles.getTilesByType(assets.tile`spawn`)) {\n"
                          "        tiles.placeOnTile(player, ort)\n"
                          "        tiles.setTileAt(ort, assets.tile`transparency16`)\n    }\n"
                          "    spawnCoins()\n    spawnEnemies()\n}\n"
                          "level = 1\nstartLevel(level)\n"
                          "scene.onOverlapTile(SpriteKind.Player, assets.tile`goal`, function (sprite, location) {\n"
                          "    level += 1\n    if (level > 3) { game.gameOver(true) } else { startLevel(level) }\n})"),
                   size=12)
tag(sl, 3.75, 1.45, "Funktion starteLevel (nr)", fill=CAT["func"], w=2.9)
blocks(sl, 3.75, 1.83, [
    (0, "Funktion  starteLevel (nr)", "func", "hat"),
    (1, "für [s] aus Sprites der Art Food: zerstöre s", "loop"),
    (1, "für [s] aus Sprites der Art Enemy: zerstöre s", "loop"),
    (1, "wenn  nr = 1  dann", "logic"),
    (2, "setze Tilemap auf [level1]", "scene"),
    (1, "sonst wenn  nr = 2  dann", "logic", "else"),
    (2, "setze Tilemap auf [level2]", "scene"),
    (1, "sonst", "logic", "else"),
    (2, "setze Tilemap auf [level3]", "scene"),
    (1, "für Element [ort] aus alle Orte der Kachel [Start]", "loop"),
    (2, "platziere player auf ort", "sprite"),
    (2, "setze Kachel bei ort auf [leer]", "scene"),
    (1, "rufe  erzeugeMünzen", "func"),
    (1, "rufe  erzeugeGegner", "func"),
], w_min=3.0, size=10)
tag(sl, 8.55, 1.45, "Start", fill=CAT["start"])
blocks(sl, 8.55, 1.83, [(0, "beim Start", "start", "hat"), (1, "setze [Level] auf 1", "var"),
                         (1, "rufe  starteLevel  (Level)", "func")])
tag(sl, 8.55, 3.55, "Ziel erreicht", fill=CAT["scene"])
blocks(sl, 8.55, 3.93, [
    (0, "wenn Player Kachel [Ziel] berührt", "scene", "hat"),
    (1, "ändere [Level] um 1", "var"),
    (1, "wenn  Level > 3  dann", "logic"),
    (2, "Spiel vorbei – gewonnen", "game"),
    (1, "sonst", "logic", "else"),
    (2, "rufe  starteLevel  (Level)", "func"),
], size=10)

# ---------------------------------------------------------------- 10 Animierte Coins
sl = content_slide("7", "Animierte Coins: Kachel → bewegter Sprite",
                   "Der Clou: Du malst nur einfache Münz-Kacheln in die Map. Beim Levelstart ersetzt eine "
                   "For-Schleife jede Kachel durch eine drehende Münze!",
                   dict(larm=15, rarm=130, mouth="grin"),
                   notes=("function spawnCoins () {\n"
                          "    for (let ort of tiles.getTilesByType(assets.tile`coinTile`)) {\n"
                          "        let coin = sprites.create(assets.image`coin0`, SpriteKind.Food)\n"
                          "        tiles.placeOnTile(coin, ort)\n"
                          "        animation.runImageAnimation(coin, assets.animation`coinSpin`, 120, true)\n"
                          "        tiles.setTileAt(ort, assets.tile`transparency16`)\n    }\n}\n"
                          "Schweben (optional): game.onUpdate -> für jede Münze  coin.y = startY + 2 * Math.sin(game.runtime() / 200)"),
                   size=12)
tag(sl, 3.75, 1.45, "Funktion erzeugeMünzen", fill=CAT["func"], w=3.0)
blocks(sl, 3.75, 1.83, [
    (0, "Funktion  erzeugeMünzen", "func", "hat"),
    (1, "für Element [ort] aus alle Orte der Kachel [Münze]", "loop"),
    (2, "setze [coin] auf Sprite [Münze 1] der Art Food", "sprite"),
    (2, "platziere coin auf ort", "sprite"),
    (2, "animiere coin: [Münze 1–4] 120 ms, Schleife", "anim"),
    (2, "setze Kachel bei ort auf [leer]", "scene"),
], size=11)
for i in range(4):
    x = 3.75 + i * 1.15
    shp(sl, MSO_SHAPE.RECTANGLE, x, 5.05, 1.05, 1.05, fill="9FD8FF", lw=3)
    pic(sl, A["coin%d" % i], x + 0.05, 5.1, w=0.95, frame=False)
    tbox(sl, x, 6.12, 1.05, 0.3, "Frame %d" % (i + 1), size=11, align=PP_ALIGN.CENTER)
tbox(sl, 8.4, 1.5, 4.7, 0.5, "So läuft's ab:", size=17, bold=True)
tile_c = tile("coin")
tp = os.path.join(TMP, "tile_coin.png")
up(tile_c, 8).save(tp)
shp(sl, MSO_SHAPE.RECTANGLE, 8.5, 2.2, 1.1, 1.1, fill="9FD8FF", lw=3)
pic(sl, tp, 8.55, 2.25, w=1.0, frame=False)
arrow(sl, 9.8, 2.45, 0.9, 0.6)
shp(sl, MSO_SHAPE.RECTANGLE, 10.9, 2.2, 1.1, 1.1, fill="9FD8FF", lw=3)
pic(sl, A["coin1"], 10.95, 2.25, w=1.0, frame=False)
tbox(sl, 8.3, 3.35, 2.0, 0.5, "Kachel (Map)", size=13, bold=True, align=PP_ALIGN.CENTER)
tbox(sl, 10.6, 3.35, 2.0, 0.5, "Sprite (dreht sich)", size=13, bold=True, align=PP_ALIGN.CENTER)
note_box(sl, 8.4, 4.3, 4.6, 2.55,
         ["Erst Sprite erzeugen, DANN die Kachel durch „leer“ ersetzen – sonst bleibt die gemalte Münze stehen.",
          "Wie bei Start & Gegnern: gleiches Muster!"], size=13, title="Muster merken:", rot=-0.8)

# ---------------------------------------------------------------- 11 Einsammeln
sl = content_slide("7b", "Münzen einsammeln, Punkte & Leben",
                   "Überlappen Spieler und Münze → Punkt, Funken, Sound, Münze weg! "
                   "Und wer in ein Loch fällt, verliert ein Leben.",
                   dict(larm=20, rarm=165, mouth="grin"),
                   notes=("sprites.onOverlap(SpriteKind.Player, SpriteKind.Food, function (sprite, otherSprite) {\n"
                          "    info.changeScoreBy(1)\n    otherSprite.destroy(effects.spray, 100)\n    music.baDing.play()\n})\n"
                          "game.onUpdate(function () {\n    if (player.y > 320) {\n"
                          "        info.changeLifeBy(-1)\n        startLevel(level)\n    }\n})\n"
                          "320 = Kartenhöhe in Pixel (Zeilen × 16) + etwas Reserve."))
tag(sl, 3.75, 1.45, "Münze nehmen", fill=CAT["sprite"])
blocks(sl, 3.75, 1.83, [
    (0, "wenn Player  berührt  Food", "sprite", "hat"),
    (1, "ändere Punktestand um 1", "info"),
    (1, "zerstöre otherSprite  Effekt [Sprühen] 100 ms", "sprite"),
    (1, "spiele Ton [ba ding]", "music"),
], w_min=4.4)
tag(sl, 3.75, 3.9, "In den Abgrund gefallen", fill=CAT["game"], w=3.0)
blocks(sl, 3.75, 4.28, [
    (0, "bei jedem Spiel-Update", "game", "hat"),
    (1, "wenn  player y > 320  dann", "logic"),
    (2, "ändere Leben um -1", "info"),
    (2, "rufe  starteLevel  (Level)", "func"),
], w_min=4.4)
note_box(sl, 9.0, 1.6, 4.0, 2.5, ["Punkte & Leben zeigt MakeCode automatisch oben im Bild an.",
                                  "Bei 0 Leben endet das Spiel von allein (Game Over)."],
         size=13, title="Gratis dabei:", fill="C9F2A8", rot=1)
note_box(sl, 9.0, 4.4, 4.0, 2.5, ["Bonus: alle 10 Münzen ein Extra-Leben:",
                                  "wenn  Punkte mod 10 = 0 → Leben +1"], size=13, title="Idee:", rot=-1)

# ---------------------------------------------------------------- 12 Gegner: Patrouille
sl = content_slide("8a", "Gegner-KI Stufe 1: Patrouille",
                   "Ein guter Gegner läuft hin und her, dreht an Wänden um – und stürzt nicht von Kanten! "
                   "Dazu schaut er eine Kachel nach vorne und unten.",
                   dict(larm=20, rarm=100, mouth="o", look=(0.0, 0.0)),
                   notes=("function spawnEnemies () {\n"
                          "    for (let ort of tiles.getTilesByType(assets.tile`enemySpawn`)) {\n"
                          "        let enemy = sprites.create(assets.image`slime`, SpriteKind.Enemy)\n"
                          "        tiles.placeOnTile(enemy, ort)\n        enemy.ay = 300\n"
                          "        sprites.setDataNumber(enemy, \"dir\", 1)\n"
                          "        tiles.setTileAt(ort, assets.tile`transparency16`)\n    }\n}\n"
                          "game.onUpdate(function () {\n"
                          "    for (let enemy of sprites.allOfKind(SpriteKind.Enemy)) {\n"
                          "        if (enemy.isHittingTile(CollisionDirection.Bottom)) {\n"
                          "            let dir = sprites.readDataNumber(enemy, \"dir\")\n"
                          "            let ahead = tiles.getTileLocation(enemy.tilemapLocation().column + dir, enemy.tilemapLocation().row + 1)\n"
                          "            if (enemy.isHittingTile(CollisionDirection.Left) || enemy.isHittingTile(CollisionDirection.Right) || !(tiles.tileAtLocationIsWall(ahead))) {\n"
                          "                dir = -dir\n                sprites.setDataNumber(enemy, \"dir\", dir)\n            }\n"
                          "            enemy.vx = dir * 30\n        }\n    }\n})"),
                   size=12)
tag(sl, 3.75, 1.45, "Gegner erzeugen (Funktion erzeugeGegner)", fill=CAT["func"], w=4.6)
blocks(sl, 3.75, 1.83, [
    (0, "Funktion  erzeugeGegner", "func", "hat"),
    (1, "für Element [ort] aus alle Orte der Kachel [Gegner-Start]", "loop"),
    (2, "setze [gegner] auf Sprite [Schleim] der Art Enemy", "sprite"),
    (2, "platziere gegner auf ort;  gegner ay = 300", "sprite"),
    (2, "setze Daten [dir] von gegner auf 1", "sprite"),
    (2, "setze Kachel bei ort auf [leer]", "scene"),
], w_min=4.0, size=10)
tag(sl, 3.75, 4.35, "Patrouillen-Logik", fill=CAT["game"], w=2.6)
blocks(sl, 3.75, 4.73, [
    (0, "bei jedem Spiel-Update", "game", "hat"),
    (1, "für Element [g] aus alle Sprites der Art Enemy", "loop"),
    (2, "wenn  g berührt Wand [links] oder [rechts]  oder", "logic"),
    (2, "       nicht [Kachel vorn-unten ist Wand]  dann", "logic"),
    (3, "setze [dir] von g auf  –dir", "var"),
    (2, "setze g vx auf  dir × 30", "sprite"),
], w_min=4.0, size=10)
pic(sl, A["slime"], 10.2, 1.55, h=1.3, frame=False)
tbox(sl, 9.2, 2.9, 3.8, 0.5, "← Schleim patrouilliert →", size=14, bold=True, align=PP_ALIGN.CENTER)
note_box(sl, 9.2, 3.55, 3.85, 3.3,
         ["Kachel „vorn-unten“ = Spalte + Blickrichtung, Zeile + 1.",
          "Blöcke: Szene ▸ Kachelposition (Spalte, Zeile) und „ist Wand“.",
          "Richtung als Daten speichern, weil eine Wandberührung vx auf 0 setzt!"],
         size=12, title="Kante erkennen:", rot=0.8)

# ---------------------------------------------------------------- 13 Gegner: Verfolger
sl = content_slide("8b", "Gegner-KI Stufe 2: Sehen & Jagen",
                   "Jetzt wird's gemein: Sieht der Gegner Paule in Reichweite, jagt er ihn! "
                   "Das ist ein einfacher Zustandsautomat – genau so tickt echte Spiel-KI.",
                   dict(larm=165, rarm=165, mouth="o", brow=-1, look=(0.12, 0)),
                   notes=("game.onUpdate(function () {\n"
                          "    for (let enemy of sprites.allOfKind(SpriteKind.Enemy)) {\n"
                          "        if (Math.abs(player.x - enemy.x) < 70 && Math.abs(player.y - enemy.y) < 24) {\n"
                          "            // JAGEN\n"
                          "            enemy.vx = player.x > enemy.x ? 45 : -45\n"
                          "        } else {\n            // PATROUILLE (wie auf der vorigen Folie)\n        }\n    }\n})"),
                   size=12)
# Zustandsdiagramm
s1 = shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, 3.8, 1.7, 2.3, 1.0, fill="9BE37F", lw=3.5)
settext(s1, "PATROUILLE\nlangsam hin & her", size=14, bold=True, align=PP_ALIGN.CENTER)
s2 = shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, 7.8, 1.7, 2.3, 1.0, fill="FF8A80", lw=3.5)
settext(s2, "JAGEN\nschnell zum Spieler", size=14, bold=True, align=PP_ALIGN.CENTER)
arrow(sl, 6.25, 1.75, 1.45, 0.4, fill="FFE14D")
arrow(sl, 6.25, 2.3, 1.45, 0.4, fill="FFE14D", kind=MSO_SHAPE.LEFT_ARROW)
tbox(sl, 5.95, 1.2, 2.2, 0.5, "Spieler < 70 px nah", size=11, bold=True, align=PP_ALIGN.CENTER)
tbox(sl, 5.95, 2.7, 2.2, 0.5, "Spieler weg", size=11, bold=True, align=PP_ALIGN.CENTER)
s3 = shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, 10.6, 1.7, 2.4, 1.0, fill="B0BEC5", lw=3.5)
settext(s3, "BESIEGT\nPuff!", size=14, bold=True, align=PP_ALIGN.CENTER)
arrow(sl, 10.15, 2.0, 0.4, 0.4, fill="FFE14D")
tag(sl, 3.75, 3.35, "Entscheidung pro Gegner", fill=CAT["game"], w=3.0)
blocks(sl, 3.75, 3.73, [
    (0, "bei jedem Spiel-Update", "game", "hat"),
    (1, "für Element [g] aus alle Sprites der Art Enemy", "loop"),
    (2, "wenn  |player x – g x| < 70  und  |player y – g y| < 24  dann", "logic"),
    (3, "wenn  player x > g x  dann  vx = 45   sonst  vx = -45", "sprite"),
    (2, "sonst", "logic", "else"),
    (3, "Patrouille (Kante & Wand wie vorige Folie)", "func"),
], w_min=4.0, size=10)
note_box(sl, 9.6, 3.6, 3.45, 3.3,
         ["Unterschiedliche „Sichtweiten“ (70, 100, 40) → Gegner mit eigener Persönlichkeit.",
          "Fliegender Gegner? ay = 0 und auch vy zum Spieler setzen."],
         size=12, title="Variieren:", rot=1)

# ---------------------------------------------------------------- 14 Stomp & Schaden
sl = content_slide("8c", "Gegner besiegen: Von oben draufhüpfen!",
                   "Trifft Paule von oben (er fällt und seine Füße sind über dem Gegner) → Gegner weg + "
                   "Bounce! Sonst tut's weh – dann kurz unverwundbar.",
                   dict(larm=170, rarm=-10, mouth="grin"),
                   notes=("let invincible = false\nfunction hurtPlayer () {\n    if (!(invincible)) {\n"
                          "        invincible = true\n        info.changeLifeBy(-1)\n        player.vy = -120\n"
                          "        player.startEffect(effects.fire, 500)\n"
                          "        control.runInParallel(function () {\n            pause(1000)\n            invincible = false\n        })\n    }\n}\n"
                          "sprites.onOverlap(SpriteKind.Player, SpriteKind.Enemy, function (sprite, otherSprite) {\n"
                          "    if (sprite.vy > 0 && sprite.bottom < otherSprite.y) {\n"
                          "        otherSprite.destroy(effects.disintegrate, 200)\n        sprite.vy = -120\n        info.changeScoreBy(5)\n"
                          "    } else {\n        hurtPlayer()\n    }\n})"),
                   size=12)
tag(sl, 3.75, 1.45, "Funktion hurtPlayer", fill=CAT["func"], w=2.7)
blocks(sl, 3.75, 1.83, [
    (0, "Funktion  hurtPlayer", "func", "hat"),
    (1, "wenn  nicht [unverwundbar]  dann", "logic"),
    (2, "setze [unverwundbar] auf wahr", "var"),
    (2, "ändere Leben um -1;  player vy = -120", "info"),
    (2, "im Hintergrund ausführen:", "ctrl"),
    (3, "pause 1000 ms;  setze [unverwundbar] auf falsch", "var"),
], w_min=4.4, size=10)
tag(sl, 3.75, 4.5, "Spieler trifft Gegner", fill=CAT["sprite"], w=2.9)
blocks(sl, 3.75, 4.88, [
    (0, "wenn Player  berührt  Enemy", "sprite", "hat"),
    (1, "wenn  player vy > 0  und  player unten < otherSprite y  dann", "logic"),
    (2, "zerstöre otherSprite;  player vy = -120;  Punkte +5", "sprite"),
    (1, "sonst", "logic", "else"),
    (2, "rufe  hurtPlayer", "func"),
], w_min=4.4, size=10)
# Bild: Stomp-Skizze
shp(sl, MSO_SHAPE.RECTANGLE, 9.6, 1.6, 3.4, 2.7, fill="9FD8FF", lw=3)
pic(sl, A["p_jump"], 10.55, 1.7, w=1.1, frame=False)
arrow(sl, 10.95, 2.85, 0.3, 0.55, rot=90, fill="E03030")
pic(sl, A["slime"], 10.55, 3.2, w=1.1, frame=False)
tbox(sl, 9.6, 4.35, 3.4, 0.4, "Fällt von oben = Stomp ✔", size=13, bold=True, align=PP_ALIGN.CENTER)
note_box(sl, 9.6, 4.9, 3.4, 2.0,
         ["Dieselbe Funktion hurtPlayer nutzen wir später für Boss & Feuerbälle!"], size=12, title="Wiederverwenden:", rot=-1)

# ---------------------------------------------------------------- 15 Boss-Konzept
sl = content_slide("9a", "Bosskampf: Phasen statt Dauerfeuer",
                   "Ein guter Boss ändert sein Verhalten, wenn er Leben verliert. "
                   "Wir bauen 3 Phasen – und jede gibt dem Boss neue, gemeine Tricks!",
                   dict(larm=20, rarm=165, mouth="o", brow=1),
                   notes=("Phasen aus den Lebenspunkten ableiten: bossHp > 5 -> Phase 1; <= 5 -> Phase 2; <= 2 -> Phase 3.\n"
                          "Statusbalken: Erweiterung 'Status Bar' (Erweiterungen > 'status bar')."),
                   size=12)
pic(sl, A["boss"], 10.85, 1.45, h=1.8, frame=False)
# Lebensbalken
tbox(sl, 3.75, 1.4, 3.0, 0.4, "Boss-Leben", size=14, bold=True)
shp(sl, MSO_SHAPE.RECTANGLE, 3.75, 1.85, 6.8, 0.45, fill="FFFFFF", lw=3)
for i, (c, w) in enumerate((("4CC84C", 3.4), ("FFC107", 2.04), ("E03030", 1.36))):
    x = 3.75 + [0, 3.4, 5.44][i]
    shp(sl, MSO_SHAPE.RECTANGLE, x, 1.85, w, 0.45, fill=c, lw=2)
tbox(sl, 3.75, 2.3, 3.4, 0.4, "10 → 6 Leben", size=12, align=PP_ALIGN.CENTER)
tbox(sl, 7.15, 2.3, 2.0, 0.4, "5 → 3", size=12, align=PP_ALIGN.CENTER)
tbox(sl, 9.0, 2.3, 1.5, 0.4, "2 → 0", size=12, align=PP_ALIGN.CENTER)
cards = [("Phase 1", "Ruhiger Start", ["läuft auf Spieler zu", "gelegentlich Sprung"], "9BE37F"),
         ("Phase 2", "Wird wütend", ["schneller", "+ wirft Feuerbälle"], "FFD54F"),
         ("Phase 3", "Raserei!", ["noch schneller", "Sprung + Feuerball", "kurze Pausen"], "FF8A80")]
for i, (t, sub, items, col) in enumerate(cards):
    x = 3.75 + i * 3.1
    shp(sl, MSO_SHAPE.RECTANGLE, x, 3.0, 2.95, 2.55, fill=col, lw=4, rot=(-1, 1, -1)[i] * 0.8)
    tbox(sl, x + 0.1, 3.05, 2.7, 0.5, t, size=20, bold=True)
    tbox(sl, x + 0.1, 3.5, 2.7, 0.4, sub, size=13, italic=True)
    tbox(sl, x + 0.1, 3.95, 2.7, 1.5, ["• " + it for it in items], size=13)
note_box(sl, 3.75, 5.75, 9.3, 1.2,
         ["Faires Design: Vor jedem Angriff kurz blinken lassen (Telegraph) – so kann der Spieler reagieren. "
          "Boss nur von oben verwundbar, 0,8 s Schonzeit nach jedem Treffer."], size=13, title="Intelligenz heißt:", rot=0.5)

# ---------------------------------------------------------------- 16 Boss: Aufbau & Treffer
sl = content_slide("9b", "Boss bauen: Leben, Balken & Treffer",
                   "Boss erzeugen wir wie die Gegner: Platzhalter-Kachel suchen, Sprite platzieren. "
                   "Dazu ein Lebensbalken über dem Kopf (Erweiterung „status bar“).",
                   dict(larm=15, rarm=110, mouth="smile"),
                   notes=("let boss: Sprite = null\nlet bossBar: StatusBarSprite = null\n"
                          "let bossHp = 0\nlet phase = 1\nlet bossHurt = false\n"
                          "function spawnBoss () {\n"
                          "    for (let ort of tiles.getTilesByType(assets.tile`bossSpawn`)) {\n"
                          "        boss = sprites.create(assets.image`boss`, SpriteKind.Boss)\n"
                          "        tiles.placeOnTile(boss, ort)\n        boss.ay = 300\n"
                          "        tiles.setTileAt(ort, assets.tile`transparency16`)\n    }\n"
                          "    bossHp = 10\n    phase = 1\n"
                          "    bossBar = statusbars.create(24, 4, StatusBarKind.EnemyHealth)\n"
                          "    bossBar.attachToSprite(boss)\n    bossBar.max = 10\n    bossBar.value = 10\n}\n"
                          "sprites.onOverlap(SpriteKind.Player, SpriteKind.Boss, function (sprite, otherSprite) {\n"
                          "    if (sprite.vy > 0 && sprite.bottom < otherSprite.top + 8) {\n"
                          "        if (!(bossHurt)) {\n            bossHurt = true\n            bossHp += -1\n"
                          "            bossBar.value = bossHp\n            sprite.vy = -170\n"
                          "            otherSprite.startEffect(effects.fire, 300)\n"
                          "            if (bossHp <= 2) { phase = 3 } else if (bossHp <= 5) { phase = 2 }\n"
                          "            if (bossHp <= 0) {\n                otherSprite.destroy(effects.disintegrate, 500)\n"
                          "                info.changeScoreBy(100)\n                game.gameOver(true)\n            }\n"
                          "            control.runInParallel(function () { pause(800); bossHurt = false })\n        }\n"
                          "    } else {\n        hurtPlayer()\n    }\n})"),
                   size=12)
tag(sl, 3.75, 1.45, "Boss erzeugen", fill=CAT["func"], w=2.0)
blocks(sl, 3.75, 1.83, [
    (0, "Funktion  erzeugeBoss", "func", "hat"),
    (1, "für Element [ort] aus alle Orte der Kachel [Boss-Start]", "loop"),
    (2, "setze [boss] auf Sprite [Boss 32×32] der Art Boss;  platziere auf ort", "sprite"),
    (2, "setze boss ay auf 300;  Kachel bei ort auf [leer]", "sprite"),
    (1, "setze [BossLeben] auf 10;  setze [Phase] auf 1", "var"),
    (1, "setze [bossBar] auf Statusbalken 24×4 Art [Gegnerleben]", "info"),
    (1, "hänge bossBar an boss;  Max = 10;  Wert = 10", "info"),
], w_min=4.4, size=10)
tag(sl, 3.75, 4.55, "Treffer auf den Boss", fill=CAT["sprite"], w=2.7)
blocks(sl, 3.75, 4.93, [
    (0, "wenn Player  berührt  Boss", "sprite", "hat"),
    (1, "wenn  player vy > 0  und  unten < Boss oben + 8", "logic"),
    (2, "wenn  nicht [bossHurt]  dann", "logic"),
    (3, "bossHurt = wahr;  BossLeben −1;  Balken aktualisieren", "var"),
    (3, "Phase setzen (≤5→2, ≤2→3); bei 0: Sieg!", "logic"),
    (1, "sonst: rufe hurtPlayer", "func", "else"),
], w_min=4.4, size=10)
pic(sl, A["boss"], 10.4, 1.55, h=1.9, frame=False)
note_box(sl, 9.9, 3.75, 3.15, 3.15,
         ["„Sieg“ = Spiel vorbei – gewonnen, oder: Tür/Ziel-Kachel erscheinen lassen.",
          "bossHurt-Flag verhindert, dass ein Sprung mehrere Treffer zählt."],
         size=12, title="Wichtig:", rot=0.8)

# ---------------------------------------------------------------- 17 Boss: KI
sl = content_slide("9c", "Boss-KI: Angriffe per Zufall & Phase",
                   "Alle 1,5 Sekunden entscheidet der Boss neu: Anlauf, Sprung oder Feuerball. "
                   "Je höher die Phase, desto schneller – und der Feuerball wird erst in Phase 2 freigeschaltet!",
                   dict(larm=170, rarm=170, mouth="o", brow=1),
                   notes=("namespace SpriteKind { export const Boss = SpriteKind.create() }\n"
                          "game.onUpdateInterval(1500, function () {\n"
                          "    if (bossHp > 0) {\n"
                          "        let dir = player.x > boss.x ? 1 : -1\n"
                          "        let attack = randint(0, 2)\n"
                          "        if (attack == 0) {\n            boss.vx = dir * (40 + 25 * phase)\n"
                          "        } else if (attack == 1 && boss.isHittingTile(CollisionDirection.Bottom)) {\n"
                          "            boss.vy = -160\n            boss.vx = dir * 50\n"
                          "        } else if (phase >= 2) {\n"
                          "            boss.startEffect(effects.warmRadial, 400)\n            pause(400)\n"
                          "            sprites.createProjectileFromSprite(assets.image`fireball`, boss, dir * (70 + 20 * phase), 0)\n"
                          "        }\n    }\n})\n"
                          "sprites.onOverlap(SpriteKind.Player, SpriteKind.Projectile, function (sprite, otherSprite) {\n"
                          "    otherSprite.destroy()\n    hurtPlayer()\n})"),
                   size=12)
tag(sl, 3.75, 1.45, "Angriffs-Auswahl", fill=CAT["game"], w=2.4)
blocks(sl, 3.75, 1.83, [
    (0, "alle 1500 ms", "game", "hat"),
    (1, "wenn  BossLeben > 0  dann", "logic"),
    (2, "setze [Richtung] auf  1 wenn player rechts, sonst -1", "var"),
    (2, "setze [Angriff] auf Zufallszahl von 0 bis 2", "math"),
    (2, "wenn  Angriff = 0  dann", "logic"),
    (3, "setze boss vx auf  Richtung × (40 + 25 × Phase)", "sprite"),
    (2, "sonst wenn  Angriff = 1  und  boss am Boden", "logic", "else"),
    (3, "setze boss vy auf -160;  boss vx auf Richtung × 50", "sprite"),
    (2, "sonst wenn  Phase ≥ 2  dann", "logic", "else"),
    (3, "boss: Effekt [warmes Glühen] 400 ms;  pause 400 ms", "sprite"),
    (3, "Feuerball: vx = Richtung × (70 + 20 × Phase)", "sprite"),
], w_min=4.4, size=10)
tag(sl, 9.7, 1.45, "Feuerball trifft", fill=CAT["sprite"], w=2.0)
blocks(sl, 9.7, 1.83, [
    (0, "wenn Player  berührt  Projektil", "sprite", "hat"),
    (1, "zerstöre otherSprite", "sprite"),
    (1, "rufe  hurtPlayer", "func"),
], w_min=3.2, size=10)
note_box(sl, 9.7, 3.65, 3.35, 3.25,
         ["Blinken vor dem Schuss (400 ms) = Warnung für den Spieler.",
          "Ohne Wände in der Arena? Dann prallt der Boss mit vx = −vx an den Rändern ab.",
          "Mehr Moves: Schockwelle beim Landen, Minions rufen …"], size=12, title="Feinschliff:", rot=-0.8)

# ---------------------------------------------------------------- 18 Gesamtbild
sl = content_slide("10", "Das Gesamtbild: Wer ruft wen?",
                   "So fügt sich alles zusammen: Der Start ruft starteLevel, die Funktion erzeugt Münzen, "
                   "Gegner und – im letzten Level – den Boss. Events laufen ständig mit!",
                   dict(larm=30, rarm=140, mouth="grin"),
                   notes=("Struktur:\nbeim Start -> level = 1; startLevel(level)\n"
                          "startLevel -> Tilemap laden, Spieler setzen, spawnCoins(), spawnEnemies(), (nur Level 3) spawnBoss()\n"
                          "Events: A-Taste, onUpdate (Boden, Sturz, Gegner-KI), Überlappungen (Münze, Gegner, Boss, Feuerball, Ziel)."))
box = lambda x, y, w, h, t, c, sz=13: settext(shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, fill=c, lw=3.5), t, size=sz,
                                              bold=True, color="FFFFFF", align=PP_ALIGN.CENTER)
box(3.8, 1.5, 2.2, 0.8, "beim Start", CAT["start"])
arrow(sl, 6.1, 1.65, 0.6, 0.5, fill="FFE14D")
box(6.8, 1.4, 3.0, 1.0, "starteLevel (nr)", CAT["func"], 16)
for i, (t, c) in enumerate((("erzeugeMünzen", CAT["anim"]), ("erzeugeGegner", CAT["info"]), ("erzeugeBoss\n(nur letztes Level)", CAT["var"]))):
    x = 6.0 + i * 2.35
    arrow(sl, x + 1.0, 2.5, 0.4, 0.55, rot=90, fill="FFE14D")
    box(x, 3.1, 2.2, 0.9, t, c, 12)
tag(sl, 3.8, 4.35, "Events, die ständig lauschen:", fill="1A1A1A", w=3.4)
evs = [("A-Taste", "Einfach-/Doppelsprung", CAT["event"]), ("Update", "Boden-Reset, Sturz, Gegner-KI", CAT["game"]),
       ("Überlappung", "Münze · Gegner · Boss · Feuerball", CAT["sprite"]), ("Ziel-Kachel", "Level +1", CAT["scene"]),
       ("Intervall 1,5 s", "Boss-Angriffe", CAT["game"])]
for i, (a, b2, c) in enumerate(evs):
    x = 3.8 + i * 1.85
    s = shp(sl, MSO_SHAPE.RECTANGLE, x, 4.8, 1.75, 1.7, fill=c, lw=3.5, rot=(-1, 1)[i % 2] * 0.8)
    settext(s, [[(a, {"size": 14, "bold": True})], [(b2, {"size": 11})]], color="FFFFFF", align=PP_ALIGN.CENTER)
note_box(sl, 3.8, 6.55, 9.2, 0.7, ["Tipp: Jede Funktion klein halten – testen, dann weiter!"], size=13, rot=0)

# ---------------------------------------------------------------- 19 Tipps
sl = content_slide("11", "Typische Fehler – und die Lösung",
                   "Keine Panik! Fast jeder Bug im Jump & Run kommt aus dieser Liste. "
                   "Erst hier nachschauen, dann verzweifeln. 😄",
                   dict(larm=20, rarm=105, mouth="smile"),
                   notes="Fehlersuche-Tabelle.", size=13)
rows = [("Paule fällt durch den Boden", "Kachel im Editor als „Wand“ markieren"),
        ("Unendlich viele Sprünge", "Reset nur bei Boden UND vy ≥ 0 (Folie 3b)"),
        ("Münzen/Gegner bleiben im neuen Level", "Am Funktionsanfang alte Sprites zerstören"),
        ("Gegner stehen still an der Wand", "Richtung in Daten speichern, nicht aus vx lesen"),
        ("Mehrere Leben auf einmal weg", "Unverwundbar-Flag + Pause im Hintergrund"),
        ("Level startet doppelt", "Kachel-Treffer nur einmal: Flag setzen oder Spieler kurz „Ghost“"),
        ("Spiel ruckelt", "Weniger Sprites (< 100); Münzen außerhalb der Kamera nicht animieren")]
for i, (p, l) in enumerate(rows):
    y = 1.5 + i * 0.78
    a = shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, 3.75, y, 4.2, 0.66, fill="FF8A80", lw=3)
    settext(a, p, size=13, bold=True, align=PP_ALIGN.CENTER)
    arrow(sl, 8.0, y + 0.1, 0.5, 0.46, fill="FFE14D")
    b2 = shp(sl, MSO_SHAPE.ROUNDED_RECTANGLE, 8.55, y, 4.5, 0.66, fill="9BE37F", lw=3)
    settext(b2, l, size=12, bold=True, align=PP_ALIGN.CENTER)

# ---------------------------------------------------------------- 20 Challenges
sl = content_slide("12", "Deine Challenges – mach das Spiel zu deinem!",
                   "Jetzt bist du dran! Such dir 1–2 Aufgaben aus, baue sie ein und zeig sie deinen "
                   "Freunden. Sterne zeigen die Schwierigkeit.",
                   dict(larm=165, rarm=165, mouth="grin"),
                   notes=("Ideen:\n- Coyote Time: nach dem Verlassen der Kante noch 0,1 s springen dürfen\n"
                          "- Wandsprung: an Wand vy = -150 und vx wegdrücken\n- Checkpoint-Kachel\n"
                          "- Bewegliche Plattform: Sprite mit vx, Spieler fährt mit (player.x += plat.vx*dt)\n"
                          "- Schlüssel & Tür, Power-Ups (Pilz = Doppelsprung nur kurz)"), size=13)
ch = [("★", "Münzen schweben leicht auf und ab"), ("★", "Checkpoint-Kachel: neu starten ab Fahne"),
      ("★★", "Coyote Time: kurz nach der Kante noch springen"), ("★★", "Power-Up: Pilz = 10 s Dreifachsprung"),
      ("★★", "Schlüssel sammeln, Tür öffnet das Ziel"), ("★★★", "Wandsprung wie bei Mega Man"),
      ("★★★", "Bewegliche Plattform, auf der man mitfährt"), ("★★★", "Zweiter Boss mit eigener Phase 4")]
for i, (st, t) in enumerate(ch):
    x = 3.75 + (i % 2) * 4.7
    y = 1.5 + (i // 2) * 1.35
    s = shp(sl, MSO_SHAPE.RECTANGLE, x, y, 4.5, 1.15, fill=("FFE14D", "FFFFFF")[(i + i // 2) % 2], lw=3.5, rot=(-1, 1)[i % 2] * 0.8)
    tbox(sl, x + 0.1, y + 0.1, 1.0, 0.9, st, size=15, bold=True, color="E03030")
    tbox(sl, x + 1.1, y + 0.1, 3.3, 0.95, t, size=13, bold=True)
tbox(sl, 3.75, 6.95, 9.3, 0.4, "Alle Bausteine stehen in den Folien-Notizen auch als JavaScript-Code.", size=11, italic=True, color="555555")

# ---------------------------------------------------------------- 21 Ende
sl = new_slide("FFD6E0", notes="Abschluss.")
halftone(sl, 6.0, 0.2, 26, 9, "FFFFFF", step=0.28, maxd=0.2)
hx, hy = paule(sl, 3.0, 7.3, 1.28, larm=170, rarm=170, mouth="grin", brow=1)
for i, c in enumerate(["FFE14D", "FF6B35", "9BE37F", "4B7BEC"]):
    shp(sl, MSO_SHAPE.STAR_5_POINT, 6.3 + i * 1.7, 2.75 + (i % 2) * 0.4, 0.7, 0.7, fill=c, lw=3, rot=i * 15)
for dx, dy, col in ((0.07, 0.07, BLACK), (0, 0, "FFE14D")):
    tbox(sl, 6.0 + dx, 0.9 + dy, 7.0, 1.6, "VIEL SPASS\nBEIM HÜPFEN!", size=50, bold=True, color=col, align=PP_ALIGN.CENTER)
bubble(sl, 6.2, 3.9, 6.7, 1.6, "Und denk dran: Fehler sind nur Level, die du noch nicht geschafft hast. "
       "Bis zum nächsten Boss!", (hx + 0.9, hy + 0.2), size=18)
pic(sl, A["coin0"], 7.2, 5.8, h=1.0, frame=False)
pic(sl, A["p_jump"], 9.0, 5.7, h=1.2, frame=False)
pic(sl, A["boss"], 11.0, 5.5, h=1.5, frame=False)

# ------------------------------------------------------------------ Speichern
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
pptx_path = os.path.join(TMP, "course.pptx")
prs.save(pptx_path)
subprocess.run(["soffice", "--headless", "--convert-to", "odp", "--outdir", TMP, pptx_path],
               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
shutil.copy(os.path.join(TMP, "course.odp"), OUT)
print("geschrieben:", os.path.abspath(OUT), "-", state["n"], "Folien")
shutil.rmtree(TMP, ignore_errors=True)
