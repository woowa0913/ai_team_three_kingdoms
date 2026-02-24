#!/usr/bin/env python3
"""
AI Orchestra app icon generator.
Requirements: pip install Pillow
Run: python3 generate-icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def create_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(size * 0.22)
    bg_color = (20, 18, 18, 240)
    border_color = (201, 168, 76, 255)
    border_width = max(2, size // 64)

    draw.rounded_rectangle(
        [4, 4, size - 4, size - 4],
        radius=radius,
        fill=bg_color,
        outline=border_color,
        width=border_width,
    )

    symbol = "\u2694"
    font_size = int(size * 0.45)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Apple Color Emoji.ttc", font_size)
    except Exception:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), symbol, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2
    y = (size - text_h) // 2
    draw.text((x, y), symbol, font=font, fill=(201, 168, 76, 255))
    return img


def main() -> None:
    iconset_path = Path("build/icon.iconset")
    iconset_path.mkdir(parents=True, exist_ok=True)

    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for size in sizes:
        create_icon(size).save(iconset_path / f"icon_{size}x{size}.png")
        if size <= 512:
            create_icon(size * 2).save(iconset_path / f"icon_{size}x{size}@2x.png")

    create_icon(1024).save("build/icon.png")
    print("OK: generated build/icon.iconset/")
    print("Run: iconutil -c icns build/icon.iconset -o build/icon.icns")
    print("Then: npm run build")


if __name__ == "__main__":
    main()
