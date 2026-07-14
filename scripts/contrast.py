"""WCAG contrast checker for design-token pairs (audit.md step 3).

Purpose: compute WCAG 2.x contrast ratios for foreground/background hex pairs.
Inputs:  hex color pairs as CLI args: python3 contrast.py '#fdf5e8' '#0b1e2d' ...
Outputs: ratio and body (>=4.5:1) / large-text (>=3:1) pass-fail per pair, to stdout.
Dependencies: Python standard library only.
"""
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")
LOG = logging.getLogger(__name__)

BODY_MIN = 4.5
LARGE_MIN = 3.0


def lum(hex_color: str) -> float:
    h = hex_color.lstrip("#")

    def lin(c: int) -> float:
        s = c / 255
        return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = (lin(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg: str, bg: str) -> float:
    hi, lo = sorted((lum(fg), lum(bg)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("colors", nargs="+", help="fg bg fg bg ... hex pairs")
    args = parser.parse_args()
    if len(args.colors) % 2:
        parser.error("colors must come in fg/bg pairs")
    for fg, bg in zip(args.colors[0::2], args.colors[1::2]):
        r = ratio(fg, bg)
        LOG.info("%s on %s: %5.2f:1  body=%s large=%s", fg, bg, r,
                 "PASS" if r >= BODY_MIN else "FAIL",
                 "PASS" if r >= LARGE_MIN else "FAIL")


if __name__ == "__main__":
    main()
