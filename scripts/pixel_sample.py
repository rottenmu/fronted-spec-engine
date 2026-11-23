#!/usr/bin/env python3
"""Pixel-level design token sampler for the frontend-spec-engineer skill.

Samples exact RGB colors from a reference screenshot at named coordinates,
so a UI can be rebuilt with pixel-accurate tokens when CSS is unavailable
(SPA bundles, anti-scraping pages, or image-only prototypes).

Usage:
    python pixel_sample.py --image <path.png|jpg> [--grid 4] [--out tokens.json]

Coordinates can be given as --points "label:x,y;label2:x,y" (pixel space) or
as --points-ratio "label:0.8,0.4" (fractions of width/height). Output is a
JSON object mapping labels to hex colors.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("PIL/Pillow is required: pip install pillow")


def _to_rgb(px) -> tuple[int, int, int]:
    if len(px) >= 3:
        return (int(px[0]), int(px[1]), int(px[2]))
    return (int(px), int(px), int(px))


def _hex(px) -> str:
    r, g, b = _to_rgb(px)
    return f"#{r:02x}{g:02x}{b:02x}"


def _parse_points(spec: str, width: int, height: int, ratio: bool) -> dict[str, tuple[int, int]]:
    points: dict[str, tuple[int, int]] = {}
    if not spec:
        return points
    for chunk in spec.split(";"):
        chunk = chunk.strip()
        if not chunk or ":" not in chunk:
            continue
        label, coord = chunk.split(":", 1)
        try:
            x, y = (float(v.strip()) for v in coord.split(","))
        except ValueError:
            continue
        if ratio:
            points[label.strip()] = (int(x * width), int(y * height))
        else:
            points[label.strip()] = (int(x), int(y))
    return points


def main() -> None:
    parser = argparse.ArgumentParser(description="Sample design tokens from a screenshot")
    parser.add_argument("--image", required=True, help="Path to screenshot (png/jpg)")
    parser.add_argument("--points", default="", help="label:x,y;label2:x,y in pixel space")
    parser.add_argument("--points-ratio", default="", help="label:0.8,0.4;... as fractions of W/H")
    parser.add_argument("--grid", type=int, default=0, help="Sample an NxN grid of the image (avg per cell)")
    parser.add_argument("--out", default="", help="Write JSON to this path")
    args = parser.parse_args()

    image = Image.open(args.image).convert("RGB")
    width, height = image.size
    print(f"image: {args.image}  {width}x{height}")

    result: dict[str, str] = {}

    for label, (x, y) in _parse_points(args.points, width, height, ratio=False).items():
        x = max(0, min(width - 1, x))
        y = max(0, min(height - 1, y))
        result[label] = _hex(image.getpixel((x, y)))
        print(f"  {label:28s} ({x},{y}) -> {result[label]}")

    for label, (x, y) in _parse_points(args.points_ratio, width, height, ratio=True).items():
        x = max(0, min(width - 1, x))
        y = max(0, min(height - 1, y))
        result[label] = _hex(image.getpixel((x, y)))
        print(f"  {label:28s} ratio({x},{y}) -> {result[label]}")

    if args.grid and args.grid > 1:
        step_x = max(1, width // args.grid)
        step_y = max(1, height // args.grid)
        for gy in range(args.grid):
            for gx in range(args.grid):
                box = (gx * step_x, gy * step_y, min(width, (gx + 1) * step_x), min(height, (gy + 1) * step_y))
                region = image.crop(box)
                pixels = list(region.getdata())
                avg = tuple(round(sum(c[i] for c in pixels) / len(pixels)) for i in range(3))
                label = f"grid_{gy}_{gx}"
                result[label] = _hex(avg)
                print(f"  {label:28s} cell({box}) -> {result[label]}")

    if args.out:
        Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"saved: {args.out}")


if __name__ == "__main__":
    main()
