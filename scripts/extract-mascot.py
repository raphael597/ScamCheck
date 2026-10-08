"""Extract mascot poses and scenes from the brand sheet (brand/scamcheck-brand-sheet.png).

Pose cut-outs use rembg (ISNet) for segmentation, optionally intersected with a
gradient-tolerant flood fill of the light studio background to remove stray
fragments. Scenes are plain crops. Output goes to web/public/mascot/.

Usage (one-off, output is committed):
    pip install "rembg[cpu]" pillow numpy
    python3 scripts/extract-mascot.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "brand" / "scamcheck-brand-sheet.png"
OUT = ROOT / "web" / "public" / "mascot"
BG = (245, 247, 251)

# name: (crop box on sheet, erase boxes in sheet coordinates, intersect with flood fill)
POSES = {
    "hero": ((40, 10, 592, 640), [(522, 388, 600, 640)], False),
    "friendly": ((528, 325, 790, 612), [(528, 325, 580, 388)], True),
    "curious": ((800, 325, 1020, 612), [], True),
    "protect": ((1030, 325, 1275, 612), [], True),
    "reliable": ((1278, 325, 1520, 612), [], True),
}
SCENES = {
    "scene-laptop": (3, 664, 618, 996),
    "scene-peek": (631, 664, 946, 996),
    "scene-warning": (960, 664, 1533, 996),
}


def flood_foreground(im: Image.Image) -> np.ndarray:
    a = np.asarray(im).astype(np.int32)
    h, w, _ = a.shape
    lum = a.sum(axis=2)
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            bg[y, x] = True
            q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            bg[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        c = a[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx]:
                if lum[ny, nx] > 188 * 3 and np.abs(a[ny, nx] - c).max() <= 4:
                    bg[ny, nx] = True
                    q.append((ny, nx))
    fg = Image.fromarray((~bg).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))
    return np.asarray(fg) > 0


def cutout(session, sheet: Image.Image, box, erase, intersect: bool) -> Image.Image:
    im = sheet.crop(box)
    draw = ImageDraw.Draw(im)
    for e in erase:
        draw.rectangle((e[0] - box[0], e[1] - box[1], e[2] - box[0], e[3] - box[1]), fill=BG)
    cut = remove(im, session=session, post_process_mask=True)
    if intersect:
        alpha = np.asarray(cut.getchannel("A")).copy()
        alpha[~flood_foreground(im)] = 0
        cut.putalpha(Image.fromarray(alpha))
    bbox = cut.getbbox()
    pad = 4
    return cut.crop((max(bbox[0] - pad, 0), max(bbox[1] - pad, 0),
                     min(bbox[2] + pad, cut.width), min(bbox[3] + pad, cut.height)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SHEET).convert("RGB")
    session = new_session("isnet-general-use")
    for name, (box, erase, intersect) in POSES.items():
        img = cutout(session, sheet, box, erase, intersect)
        img.save(OUT / f"{name}.webp", "WEBP", quality=92, method=6)
        print(f"{name}.webp {img.size}")
    for name, box in SCENES.items():
        img = sheet.crop(box)
        img.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
        print(f"{name}.webp {img.size}")


if __name__ == "__main__":
    main()
