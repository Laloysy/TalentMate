"""按 Android 规范生成应用图标与启动页（替代 @capacitor/assets）。

为什么不用 @capacitor/assets：它依赖 sharp 0.32，而该版本在 Windows + pnpm 10
下需要本地 node-gyp 编译，安装脚本被 pnpm 拦截后无法使用。
本脚本用 Pillow 直接产出各密度资源，结果可复现、无额外原生依赖。

产出：
  mipmap-*/ic_launcher.png              传统方形图标
  mipmap-*/ic_launcher_round.png        圆形图标
  mipmap-*/ic_launcher_foreground.png   自适应图标前景
  mipmap-anydpi-v26/ic_launcher*.xml    自适应图标定义
  values/ic_launcher_background.xml    自适应图标背景色
  drawable*/splash.png                  启动页（竖屏/横屏、各密度）
"""
import os
from PIL import Image

ROOT = os.path.join("android", "app", "src", "main", "res")
ASSETS = "assets"

# 各密度的启动页尺寸（宽 x 高），与 Android 屏幕密度对应
SPLASH_SIZES = {
    "drawable": (480, 320),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
}

# 自适应图标前景：各密度尺寸（含 108dp 画布，安全区约 66%）
FOREGROUND_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

# 传统图标：48dp 基准
LEGACY_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

BG_COLOR = "#0F172A"


def cover(img, size):
    """等比缩放并居中裁切到目标尺寸（等价于 Android 的 centerCrop）。"""
    target_w, target_h = size
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new = img.resize((max(1, round(src_w * scale)), max(1, round(src_h * scale))), Image.LANCZOS)
    left = (new.width - target_w) // 2
    top = (new.height - target_h) // 2
    return new.crop((left, top, left + target_w, top + target_h))


def contain(img, size):
    """等比缩放并居中放置在目标画布上（保持透明边距）。"""
    target_w, target_h = size
    src_w, src_h = img.size
    scale = min(target_w / src_w, target_h / src_h)
    new = img.resize((max(1, round(src_w * scale)), max(1, round(src_h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(new, ((target_w - new.width) // 2, (target_h - new.height) // 2))
    return canvas


def circular(img):
    """生成圆形版本（带透明四角）。"""
    size = img.size
    mask = Image.new("L", size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).ellipse([0, 0, size[0] - 1, size[1] - 1], fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def write(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG")
    print("wrote", path, img.size)


def main():
    icon = Image.open(f"{ASSETS}/icon-only.png").convert("RGBA")
    foreground_src = Image.open(f"{ASSETS}/icon-foreground.png").convert("RGBA")
    splash = Image.open(f"{ASSETS}/splash.png").convert("RGB")

    # ---- 传统图标 + 圆形图标 ----
    for density, px in LEGACY_SIZES.items():
        square = cover(icon, (px, px))
        write(f"{ROOT}/mipmap-{density}/ic_launcher.png", square)
        write(f"{ROOT}/mipmap-{density}/ic_launcher_round.png", circular(square))

    # ---- 自适应图标前景（保持透明，按 108dp 画布缩放） ----
    for density, px in FOREGROUND_SIZES.items():
        fg = contain(foreground_src, (px, px))
        write(f"{ROOT}/mipmap-{density}/ic_launcher_foreground.png", fg)

    # ---- 启动页（竖屏 / 横屏 / 通用） ----
    for folder, size in SPLASH_SIZES.items():
        write(f"{ROOT}/{folder}/splash.png", cover(splash, size))

    # ---- 自适应图标定义（后台色由 values/ic_launcher_background.xml 提供） ----
    adaptive = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        path = f"{ROOT}/mipmap-anydpi-v26/{name}"
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(adaptive)
        print("wrote", path)

    print("\n完成。图标与启动页已写入", ROOT)


if __name__ == "__main__":
    main()
