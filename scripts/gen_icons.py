"""Generate vivid blue BitDown app icons."""
from PIL import Image, ImageDraw, ImageFilter
import struct, io, os

def render_icon(target_size):
    """Render at 4x for anti-aliasing, then downscale."""
    s = max(target_size * 4, 64)

    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))

    # ── 1. Background: vivid blue gradient (#60A5FA → #1D4ED8) ──────────────
    pad = max(2, s // 18)
    radius = s * 22 // 100
    bg = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    for y in range(s):
        t = y / max(s - 1, 1)
        r = int(96  + (29  - 96)  * t)   # 96  → 29
        g = int(165 + (78  - 165) * t)   # 165 → 78
        b = int(250 + (216 - 250) * t)   # 250 → 216
        bg.paste((r, g, b, 255), [0, y, s, y + 1])
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [pad, pad, s - pad - 1, s - pad - 1], radius=radius, fill=255)
    img.paste(bg, (0, 0), mask)

    # ── 2. Glass sheen (top ~30%) ────────────────────────────────────────────
    hi = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    hi_draw = ImageDraw.Draw(hi)
    hi_h = s * 32 // 100
    for y in range(hi_h):
        t = y / max(hi_h, 1)
        alpha = int(50 * (1.0 - t))
        x0 = pad + y // 8 + 2
        x1 = s - pad - y // 8 - 3
        if x1 > x0:
            hi_draw.line([(x0, pad + y), (x1, pad + y)],
                         fill=(255, 255, 255, alpha))
    img = Image.alpha_composite(img, hi)

    # ── 3. Bold solid download arrow ─────────────────────────────────────────
    cx = s // 2
    sx1 = s * 37 // 100   # shaft left
    sx2 = s * 63 // 100   # shaft right
    sy1 = s * 10 // 100   # shaft top
    sy2 = s * 52 // 100   # arrowhead shoulder row
    hx1 = s * 10 // 100   # arrowhead left
    hx2 = s * 90 // 100   # arrowhead right
    tip = s * 84 // 100   # arrow tip

    arrow = [(sx1, sy1), (sx2, sy1), (sx2, sy2),
             (hx2, sy2), (cx, tip), (hx1, sy2), (sx1, sy2)]

    # Soft glow
    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon(arrow, fill=(200, 230, 255, 140))
    glow = glow.filter(ImageFilter.GaussianBlur(s * 4 // 100))
    img = Image.alpha_composite(img, glow)

    # Solid white arrow
    a_layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(a_layer).polygon(arrow, fill=(255, 255, 255, 255))
    img = Image.alpha_composite(img, a_layer)

    # Subtle inner top-of-shaft highlight
    hi2 = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    stripe_h = max(2, s * 5 // 100)
    hi2_mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(hi2_mask).polygon(
        [(sx1, sy1), (sx2, sy1), (sx2, sy1 + stripe_h), (sx1, sy1 + stripe_h)], fill=255)
    hi2.paste((255, 255, 255, 60), (0, 0), hi2_mask)
    img = Image.alpha_composite(img, hi2)

    # ── 4. Bottom floor bar ──────────────────────────────────────────────────
    bar_y = s * 88 // 100
    bar_h = max(3, s * 5 // 100)
    bar_layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(bar_layer).rounded_rectangle(
        [s * 16 // 100, bar_y, s * 84 // 100, bar_y + bar_h],
        radius=bar_h // 2, fill=(255, 255, 255, 180))
    img = Image.alpha_composite(img, bar_layer)

    # ── 5. Outer border ring ─────────────────────────────────────────────────
    ring = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle(
        [pad, pad, s - pad - 1, s - pad - 1], radius=radius,
        outline=(255, 255, 255, 55), width=max(2, s // 64))
    img = Image.alpha_composite(img, ring)

    # ── Downscale with Lanczos for clean anti-aliasing ───────────────────────
    if s != target_size:
        img = img.resize((target_size, target_size), Image.LANCZOS)
    return img


def make_ico(output_path):
    sizes = [256, 128, 64, 48, 32, 24, 16]
    print(f"  Rendering {len(sizes)} ICO sizes...", end='', flush=True)
    images = [render_icon(sz) for sz in sizes]
    print(" done")

    icon_data = []
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        icon_data.append(buf.getvalue())

    num = len(sizes)
    header_size = 6 + num * 16

    with open(output_path, 'wb') as f:
        f.write(struct.pack('<HHH', 0, 1, num))
        offset = header_size
        for i, sz in enumerate(sizes):
            w = sz if sz < 256 else 0
            h = sz if sz < 256 else 0
            f.write(struct.pack('BBBB', w, h, 0, 0))
            f.write(struct.pack('<HH', 1, 32))
            f.write(struct.pack('<II', len(icon_data[i]), offset))
            offset += len(icon_data[i])
        for data in icon_data:
            f.write(data)
    print(f"  icon.ico → {output_path}")


out = r'C:\Users\H661893\Downloads\perf\bitdown\src-tauri\icons'
os.makedirs(out, exist_ok=True)

print("Generating BitDown icons (vivid blue design)...")

for sz, name in [(512, 'icon.png'), (128, '128x128.png'),
                 (256, '128x128@2x.png'), (32, '32x32.png')]:
    render_icon(sz).save(os.path.join(out, name))
    print(f"  {name} ({sz}px)")

make_ico(os.path.join(out, 'icon.ico'))
print("All icons done!")
