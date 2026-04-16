#!/usr/bin/env python3
"""
Convert white pixels → transparent in all source PNGs.

Usage:
  python3 build/convert-white-to-alpha.py

Reads from assets/Animation 1/ (Photoshop exports), outputs clean
1125×2436 RGBA PNGs into assets/ with the canonical names.
"""

from PIL import Image
import os

SRC_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'Animation 1')
DST_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')

THRESHOLD = 240  # R,G,B all >= this → make transparent

MAPPING = {
    "Animation-1_0000s_0000_01-Chaine.png":       "01-chain.png",
    "Animation-1_0000s_0001_02-Eclaire.png":       "02-eclair.png",
    "Animation-1_0000s_0002_03-Feuilles.png":      "03-feuilles.png",
    "Animation-1_0000s_0003_04-Baile-Punk.png":    "04-bailepunk.png",
    "Animation-1_0000s_0004_05-Don-Low.png":       "05-donlow.png",
    "Animation-1_0000s_0009_Groupe-1-copie.png":   "06-masque.png",
    "Animation-1_0000s_0010_07-WTTJ-Red.png":      "07-wttj-red.png",
    "Animation-1_0000s_0011_08-WTTJ-Black.png":    "08-wttj-black.png",
    "Animation-1_0000s_0007_09-Carré-Rouge.png":   "09-carre-rouge.png",
    "Animation-1_0000s_0008_10-Carré-Noir.png":    "10-carre-noir.png",
}


def convert(src_path, dst_path):
    img = Image.open(src_path).convert("RGBA")
    px  = img.load()
    w, h = img.size
    count = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD:
                px[x, y] = (r, g, b, 0)
                count += 1
    img.save(dst_path, "PNG")
    pct = count / (w * h) * 100
    print(f"  {os.path.basename(dst_path):25s}  {count:>8,} px → alpha  ({pct:.1f}%)")


def main():
    print("White → Alpha conversion")
    print(f"  Source : {os.path.abspath(SRC_DIR)}")
    print(f"  Output : {os.path.abspath(DST_DIR)}")
    print()

    for src_name, dst_name in MAPPING.items():
        src = os.path.join(SRC_DIR, src_name)
        dst = os.path.join(DST_DIR, dst_name)
        if not os.path.isfile(src):
            print(f"  SKIP (not found): {src_name}")
            continue
        convert(src, dst)

    print("\nDone.")


if __name__ == "__main__":
    main()
