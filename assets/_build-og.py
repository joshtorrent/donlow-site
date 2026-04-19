#!/usr/bin/env python3
"""
Build /assets/og-preview.jpg — 1200x630 OpenGraph preview for the EPK.

Pipeline:
  1. Take the masked-silhouette hero poster.
  2. Scale + centre-crop to 1200x630 (the OG canonical size).
  3. Lay a bottom gradient for text legibility.
  4. Stamp "DON LOW" + tagline + meta in the bottom-left.

Re-runnable. Outputs to assets/og-preview.jpg.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC  = ROOT / "assets" / "worldwide" / "bg-video-poster.jpg"
OUT  = ROOT / "assets" / "og-preview.jpg"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Impact.ttf"

W, H = 1200, 630

# 1. Source scaled so the short side covers the canvas, then centre-cropped.
img = Image.open(SRC).convert("RGB")
src_w, src_h = img.size

# Fit the source to W=1200 (scale up the 720-wide poster). The result is
# 1200×2133 — way taller than H=630 — so we centre-crop vertically on the
# silhouette head.
scale = W / src_w
new_w, new_h = int(src_w * scale), int(src_h * scale)
img = img.resize((new_w, new_h), Image.LANCZOS)

# Head centre in the source is around y≈720; position it roughly 45% from
# the top of the OG (leaves room for the text stamp below).
head_cy = int(720 * scale)
crop_y = max(0, min(new_h - H, head_cy - int(H * 0.45)))
canvas = img.crop((0, crop_y, W, crop_y + H))

# 2. Bottom gradient for text legibility.
gradient = Image.new("L", (1, H), 0)
for y in range(H):
    #  start fading ~60% down, fully dark at the bottom
    t = max(0, (y - int(H * 0.55)) / (H * 0.45))
    gradient.putpixel((0, y), int(min(1, t) * 220))
gradient = gradient.resize((W, H))
overlay = Image.new("RGB", (W, H), (8, 8, 8))
canvas = Image.composite(overlay, canvas, gradient)

# 3. Text stamps.
draw = ImageDraw.Draw(canvas)
font_title    = ImageFont.truetype(FONT_BOLD, 120)
font_tagline  = ImageFont.truetype(FONT_BOLD, 30)
font_meta     = ImageFont.truetype(FONT_BOLD, 20)

x_stamp = 48
y_title = H - 240
draw.text((x_stamp, y_title),
          "DON LOW",
          font=font_title, fill=(232, 224, 208))

# Thin red underscore under the title
title_w = draw.textlength("DON LOW", font=font_title)
draw.rectangle([x_stamp, y_title + 135, x_stamp + int(title_w), y_title + 142],
               fill=(168, 48, 48))

draw.text((x_stamp, y_title + 160),
          "BRAZILIAN FUNK · BASS · BAILE",
          font=font_tagline, fill=(232, 224, 208))

draw.text((x_stamp, y_title + 200),
          "DJ / PRODUCER  ·  RIO · PARIS · WORLD",
          font=font_meta, fill=(150, 150, 150))

# 4. Save as optimised JPEG.
canvas.save(OUT, "JPEG", quality=86, optimize=True, progressive=True)
print(f"wrote {OUT}  ({OUT.stat().st_size // 1024} KB)")
