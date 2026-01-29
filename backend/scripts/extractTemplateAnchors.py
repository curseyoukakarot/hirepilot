#!/usr/bin/env python3
# One-time template inspection tool to extract PDF text anchors from Canva PDFs.
# This script is NOT used in production.

import json
import sys
from collections import Counter

try:
    import pdfplumber
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pdfplumber is required. Install with: pip install pdfplumber") from exc


def usage():
    return (
        "Usage: python backend/scripts/extractTemplateAnchors.py <path-to-pdf> [page]\n"
        "Example: python backend/scripts/extractTemplateAnchors.py backend/assets/resume-templates/canva/blue-gray-simple-professional.pdf 1"
    )


def word_anchor_from_chars(chars):
    if not chars:
        return None
    x0 = min(ch["x0"] for ch in chars)
    x1 = max(ch["x1"] for ch in chars)
    y0 = min(ch["y0"] for ch in chars)
    y1 = max(ch["y1"] for ch in chars)
    text = "".join(ch.get("text", "") for ch in chars).strip()
    if not text:
        return None

    fonts = [ch.get("fontname") for ch in chars if ch.get("fontname")]
    sizes = [ch.get("size") for ch in chars if ch.get("size")]
    font = Counter(fonts).most_common(1)[0][0] if fonts else ""
    size = Counter(sizes).most_common(1)[0][0] if sizes else 0

    return {
        "text": text,
        "x": round(x0, 2),
        "y": round(y0, 2),
        "w": round(x1 - x0, 2),
        "h": round(y1 - y0, 2),
        "font": font,
        "size": round(float(size), 2) if size else 0,
    }


def extract_page_items(page):
    words = page.extract_words(
        keep_blank_chars=False,
        use_text_flow=True,
        extra_attrs=["fontname", "size"],
        return_chars=True,
    )

    items = []
    for word in words:
        anchor = word_anchor_from_chars(word.get("chars") or [])
        if anchor:
            items.append(anchor)
    return items


def main():
    if len(sys.argv) < 2:
        print(usage(), file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    page_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    if page_num < 1:
        print("page must be 1 or greater", file=sys.stderr)
        sys.exit(1)

    with pdfplumber.open(pdf_path) as pdf:
        if page_num > len(pdf.pages):
            print(f"page out of range: {page_num} (total {len(pdf.pages)})", file=sys.stderr)
            sys.exit(1)
        page = pdf.pages[page_num - 1]
        items = extract_page_items(page)

    payload = {"page": page_num, "items": items}
    print(json.dumps(payload, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
