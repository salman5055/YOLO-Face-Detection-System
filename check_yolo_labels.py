from pathlib import Path
from PIL import Image, ImageDraw

# ==========================================
# PATHS
# ==========================================

ROOT = Path(__file__).resolve().parent

IMAGE_DIR = ROOT / "dataset" / "raw" / "salman"
LABEL_DIR = ROOT / "dataset" / "labels" / "all"
OUTPUT_DIR = ROOT / "dataset" / "preview"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ==========================================
# NUMBER OF IMAGES TO PREVIEW
# ==========================================

MAX_PREVIEWS = 10


# ==========================================
# GET IMAGE FILES
# ==========================================

image_extensions = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp"
}

images = [
    p for p in IMAGE_DIR.iterdir()
    if p.suffix.lower() in image_extensions
]

images = sorted(images)[:MAX_PREVIEWS]


# ==========================================
# PROCESS IMAGES
# ==========================================

for image_path in images:

    label_path = LABEL_DIR / f"{image_path.stem}.txt"

    if not label_path.exists():
        print(f"[NO LABEL] {image_path.name}")
        continue

    try:
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        print(f"[ERROR] {image_path.name}: {e}")
        continue

    draw = ImageDraw.Draw(image)

    image_width, image_height = image.size

    # Read YOLO labels
    lines = label_path.read_text(
        encoding="utf-8"
    ).strip().splitlines()

    for line in lines:

        if not line.strip():
            continue

        parts = line.split()

        if len(parts) != 5:
            print(f"[BAD LABEL] {label_path.name}")
            continue

        class_id, center_x, center_y, box_width, box_height = map(
            float, parts
        )

        # ----------------------------------
        # YOLO normalized → pixel coordinates
        # ----------------------------------

        center_x *= image_width
        center_y *= image_height

        box_width *= image_width
        box_height *= image_height

        x1 = center_x - box_width / 2
        y1 = center_y - box_height / 2

        x2 = center_x + box_width / 2
        y2 = center_y + box_height / 2

        # ----------------------------------
        # Draw bounding box
        # ----------------------------------

        draw.rectangle(
            [x1, y1, x2, y2],
            outline="red",
            width=5
        )

        # Class label
        draw.text(
            (x1, max(0, y1 - 20)),
            f"face ({class_id:.0f})",
            fill="red"
        )

    # --------------------------------------
    # Save preview
    # --------------------------------------

    output_path = OUTPUT_DIR / image_path.name

    image.save(output_path)

    print(f"[OK] {output_path}")


# ==========================================
# COMPLETE
# ==========================================

print()
print("=" * 50)
print("LABEL VERIFICATION COMPLETE")
print("=" * 50)

print(f"Preview images saved in:")
print(OUTPUT_DIR)