#!/usr/bin/env python3
"""
Build favicons + apple-touch-icon from the jaguar mask asset.

Outputs to the project root so the browser can grab /favicon.ico and
/apple-touch-icon.png by default (no meta tag tricks needed).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC  = ROOT / "assets" / "06-masque.png"

def crop_square_around_face(img: Image.Image) -> Image.Image:
    """
    Crop the jaguar face out of the framed artwork. The artwork is
    1125×2436 with the animal face roughly centred in the black area.
    We extract a square that frames just the face for a tighter icon.
    """
    w, h = img.size
    # Artwork is 1125×2436 with the inked face around y≈900-1350.
    # Centre the crop on the snout / eyes so the icon reads as a jaguar
    # head rather than the hood above it.
    face_cx, face_cy = int(w * 0.50), int(h * 0.42)
    size = int(w * 0.55)             # square, just under the body width
    left   = max(0, face_cx - size // 2)
    top    = max(0, face_cy - size // 2)
    right  = min(w, left + size)
    bottom = min(h, top + size)
    return img.crop((left, top, right, bottom))

def main():
    src = Image.open(SRC).convert("RGBA")
    face = crop_square_around_face(src)

    # Apple touch icon — 180×180, matte dark background so it works on any
    # iOS home-screen colour.
    apple = Image.new("RGB", (180, 180), (8, 8, 8))
    resized = face.resize((180, 180), Image.LANCZOS)
    apple.paste(resized.convert("RGB"))
    apple.save(ROOT / "apple-touch-icon.png", "PNG", optimize=True)

    # Classic PNG favicons (32 for the tab, 192 for PWA / Android).
    for size in (32, 192):
        ic = face.resize((size, size), Image.LANCZOS)
        bg = Image.new("RGB", (size, size), (8, 8, 8))
        bg.paste(ic.convert("RGB"))
        bg.save(ROOT / f"favicon-{size}.png", "PNG", optimize=True)

    # Multi-resolution .ico (browsers pick the best size).
    ico = face.convert("RGBA")
    ico.save(
        ROOT / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )

    for p in [
        "apple-touch-icon.png",
        "favicon.ico",
        "favicon-32.png",
        "favicon-192.png",
    ]:
        path = ROOT / p
        print(f"wrote {p}  ({path.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
