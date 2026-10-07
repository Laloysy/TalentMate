"""生成 TalentMate 伴贤 的 App 图标与启动页源图。

@capacitor/assets 需要两个源文件：
  assets/icon-only.png     1024x1024  应用图标（不含圆角，系统会自行裁切）
  assets/splash.png        2732x2732  启动页（居中留白，四周为背景色）

设计沿用 App 内已有的品牌元素：
  深色圆角方块 + 白色 TM 字母（登录页/工作台头部的同款标志）
"""
from PIL import Image, ImageDraw, ImageFont

ASSETS = "assets"

# 品牌色（与 src/App.jsx 的 antd theme 及页面样式保持一致）
NAVY = (15, 23, 42)        # slate-900，TM 标志底色
WHITE = (255, 255, 255)
BG = (238, 243, 248)       # #EEF3F8，页面背景
BLUE = (22, 119, 255)      # #1677FF，主色

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\seguisb.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arial.ttf",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_tm_badge(size, radius_ratio=0.22, bg=NAVY, fg=WHITE):
    """画一个深色圆角方块 + 居中 TM 字母的图标。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg)

    font = load_font(int(size * 0.42))
    text = "TM"
    box = draw.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text(
        ((size - w) / 2 - box[0], (size - h) / 2 - box[1]),
        text, font=font, fill=fg,
    )
    return img


def centered(base, overlay, y_ratio=0.5):
    """把 overlay 居中（可按比例上下偏移）贴到 base 上。"""
    x = (base.width - overlay.width) // 2
    y = int(base.height * y_ratio - overlay.height / 2)
    base.alpha_composite(overlay, (x, y))


def make_icon():
    """1024x1024 应用图标：满幅深色方角，交系统做自适应裁切。"""
    size = 1024
    img = Image.new("RGBA", (size, size), NAVY)
    # 稍微内缩一点，保证圆形/方形遮罩裁切后 TM 不被切到
    badge = draw_tm_badge(int(size * 0.72), radius_ratio=0.24)
    centered(img, badge)
    out = f"{ASSETS}/icon-only.png"
    img.convert("RGB").save(out, "PNG")
    print("wrote", out, img.size)


def make_adaptive_assets():
    """Adaptive Icon 前景（透明底 + 居中 TM）与背景（纯色）。"""
    size = 1024
    # 前景：安全区约为 66%，因此图标再收一些
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    badge = draw_tm_badge(int(size * 0.50), radius_ratio=0.26)
    centered(fg, badge)
    fg.save(f"{ASSETS}/icon-foreground.png", "PNG")
    print("wrote", f"{ASSETS}/icon-foreground.png")

    bg = Image.new("RGB", (size, size), NAVY)
    bg.save(f"{ASSETS}/icon-background.png", "PNG")
    print("wrote", f"{ASSETS}/icon-background.png")


def make_splash():
    """2732x2732 启动页：浅灰蓝底 + 居中 TM + 应用名。"""
    size = 2732
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)

    badge_size = int(size * 0.22)
    badge = draw_tm_badge(badge_size)
    cx = size // 2
    badge_y = int(size * 0.44)
    img.alpha_composite(badge, (cx - badge_size // 2, badge_y - badge_size // 2))

    # 应用名
    name_font = load_font(int(size * 0.045))
    name = "TalentMate 伴贤"
    box = draw.textbbox((0, 0), name, font=name_font)
    draw.text(
        (cx - (box[2] - box[0]) / 2 - box[0], badge_y + badge_size * 0.72),
        name, font=name_font, fill=NAVY,
    )

    # 副标题
    sub_font = load_font(int(size * 0.026))
    sub = "语音驱动的职场关系关怀助手"
    box2 = draw.textbbox((0, 0), sub, font=sub_font)
    draw.text(
        (cx - (box2[2] - box2[0]) / 2 - box2[0], badge_y + badge_size * 0.72 + size * 0.075),
        sub, font=sub_font, fill=(148, 163, 184),
    )

    out = f"{ASSETS}/splash.png"
    img.convert("RGB").save(out, "PNG")
    print("wrote", out, img.size)


def make_splash_dark():
    """深色启动页（夜间模式）。"""
    size = 2732
    img = Image.new("RGBA", (size, size), NAVY)
    draw = ImageDraw.Draw(img)
    badge_size = int(size * 0.22)
    badge = draw_tm_badge(badge_size, bg=WHITE, fg=NAVY)
    cx = size // 2
    badge_y = int(size * 0.44)
    img.alpha_composite(badge, (cx - badge_size // 2, badge_y - badge_size // 2))

    font = load_font(int(size * 0.045))
    name = "TalentMate 伴贤"
    box = draw.textbbox((0, 0), name, font=font)
    draw.text((cx - (box[2] - box[0]) / 2 - box[0], badge_y + badge_size * 0.72),
              name, font=font, fill=WHITE)
    out = f"{ASSETS}/splash-dark.png"
    img.convert("RGB").save(out, "PNG")
    print("wrote", out)


if __name__ == "__main__":
    import os
    os.makedirs(ASSETS, exist_ok=True)
    make_icon()
    make_adaptive_assets()
    make_splash()
    make_splash_dark()
