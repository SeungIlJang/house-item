"""Play 스토어 등록용 이미지 생성. 사용법: python make_assets.py <icon.png> <출력 폴더>"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

icon_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)

src = Image.open(icon_path).convert("RGBA")
# 아이콘 배경색: 가운데 위쪽(그림이 없는 곳)의 색을 그대로 쓴다.
blue = src.getpixel((src.width // 2, src.height // 8))[:3]

# ── 1) 앱 아이콘 512x512: 모서리까지 배경색으로 채운 정사각형(투명 없음) ──
square = Image.new("RGBA", src.size, blue + (255,))
square.alpha_composite(src)
icon = square.resize((512, 512), Image.LANCZOS).convert("RGB")
icon.save(out_dir / "icon-512.png", optimize=True)

# ── 2) 그래픽 이미지 1024x500 ──
W, H = 1024, 500
SCALE = 2  # 2배로 그린 뒤 줄여 글자와 가장자리를 매끄럽게 한다.
w, h = W * SCALE, H * SCALE


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


dark = lerp(blue, (10, 30, 90), 0.45)
bg = Image.new("RGB", (w, h))
px = bg.load()
for y in range(h):
    for x in range(w):
        # 왼쪽 위(밝음) → 오른쪽 아래(어두움) 대각선 그라데이션
        px[x, y] = lerp(blue, dark, (x / w * 0.6 + y / h * 0.4))
canvas = bg.convert("RGBA")

# 은은한 원 장식
deco = Image.new("RGBA", (w, h), (0, 0, 0, 0))
d = ImageDraw.Draw(deco)
d.ellipse((w * 0.62, -h * 0.55, w * 1.18, h * 0.55), fill=(255, 255, 255, 18))
d.ellipse((w * 0.78, h * 0.45, w * 1.12, h * 1.25), fill=(255, 255, 255, 14))
canvas.alpha_composite(deco)

# 아이콘에서 흰 그림(집 + 돋보기)만 뽑는다: 배경 파랑과의 차이를 투명도로 쓴다.
r = src.split()[0]
alpha = r.point(lambda v: max(0, min(255, round((v - blue[0]) * 255 / (255 - blue[0])))))
alpha = Image.composite(alpha, Image.new("L", src.size, 0), src.split()[3])
glyph = Image.new("RGBA", src.size, (255, 255, 255, 0))
glyph.putalpha(alpha)
bbox = alpha.getbbox()
glyph = glyph.crop(bbox)

glyph_h = round(h * 0.46)
glyph_w = round(glyph.width * glyph_h / glyph.height)
glyph = glyph.resize((glyph_w, glyph_h), Image.LANCZOS)
gx, gy = round(w * 0.06), (h - glyph_h) // 2
canvas.alpha_composite(glyph, (gx, gy))

draw = ImageDraw.Draw(canvas)
bold = "C:/Windows/Fonts/malgunbd.ttf"
regular = "C:/Windows/Fonts/malgun.ttf"
title_font = ImageFont.truetype(bold, 68 * SCALE)
tag_font = ImageFont.truetype(regular, 29 * SCALE)
chip_font = ImageFont.truetype(bold, 21 * SCALE)

tx = gx + glyph_w + round(w * 0.045)
title, tagline = "집안의 모든것", "사진만 찍으면, 물건 위치를 바로 찾아요"
chips = ["사진으로 등록", "위치 바로 찾기", "유통기한 알림"]

title_box = draw.textbbox((0, 0), title, font=title_font)
tag_box = draw.textbbox((0, 0), tagline, font=tag_font)
chip_h = round(44 * SCALE)
gap1, gap2 = round(22 * SCALE), round(30 * SCALE)
block_h = (title_box[3] - title_box[1]) + gap1 + (tag_box[3] - tag_box[1]) + gap2 + chip_h
ty = (h - block_h) // 2

draw.text((tx, ty - title_box[1]), title, font=title_font, fill=(255, 255, 255, 255))
ty += (title_box[3] - title_box[1]) + gap1
draw.text((tx, ty - tag_box[1]), tagline, font=tag_font, fill=(255, 255, 255, 235))
ty += (tag_box[3] - tag_box[1]) + gap2

# 반투명 알약은 별도 레이어에 그려 합성한다(ImageDraw 는 RGBA 위에 알파를 섞지 않고 덮어쓴다).
pills = Image.new("RGBA", (w, h), (0, 0, 0, 0))
pd = ImageDraw.Draw(pills)
labels = []
cx = tx
for chip in chips:
    cb = draw.textbbox((0, 0), chip, font=chip_font)
    cw = (cb[2] - cb[0]) + round(34 * SCALE)
    pd.rounded_rectangle((cx, ty, cx + cw, ty + chip_h), radius=chip_h // 2, fill=(255, 255, 255, 46), outline=(255, 255, 255, 150), width=SCALE)
    labels.append((cx + round(17 * SCALE), ty + (chip_h - (cb[3] - cb[1])) // 2 - cb[1], chip))
    cx += cw + round(12 * SCALE)
cx -= round(12 * SCALE)
canvas.alpha_composite(pills)
draw = ImageDraw.Draw(canvas)
for lx, ly, chip in labels:
    draw.text((lx, ly), chip, font=chip_font, fill=(255, 255, 255, 255))

right_edge = max(tx + title_box[2], tx + tag_box[2], cx)
canvas.resize((W, H), Image.LANCZOS).convert("RGB").save(out_dir / "feature-graphic-1024x500.png", optimize=True)

print("blue", blue, "| text right edge", round(right_edge / SCALE), "of", W)
for name in ("icon-512.png", "feature-graphic-1024x500.png"):
    im = Image.open(out_dir / name)
    print(name, im.size, im.mode, f"{(out_dir / name).stat().st_size / 1024:.0f}KB")
