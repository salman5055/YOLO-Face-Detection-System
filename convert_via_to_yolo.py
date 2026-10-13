import json
from pathlib import Path
from PIL import Image

# ==========================================
# PATHS
# ==========================================

ROOT = Path(__file__).resolve().parent

JSON_PATH = ROOT / "annotations" / "salman_annotations.json"
IMAGE_DIR = ROOT / "dataset" / "raw" / "salman"
LABEL_DIR = ROOT / "dataset" / "labels" / "all"

# YOLO class
FACE_CLASS_ID = 0

LABEL_DIR.mkdir(parents=True, exist_ok=True)


# ==========================================
# CHECK FILES
# ==========================================

if not JSON_PATH.exists():
    print(f"[ERROR] JSON file not found:")
    print(JSON_PATH)
    raise SystemExit

if not IMAGE_DIR.exists():
    print(f"[ERROR] Image folder not found:")
    print(IMAGE_DIR)
    raise SystemExit


# ==========================================
# LOAD VIA JSON
# ==========================================

with JSON_PATH.open("r", encoding="utf-8") as f:
    data = json.load(f)


# ==========================================
# COUNTERS
# ==========================================

processed = 0
with_faces = 0
empty_labels = 0
missing_images = 0
invalid_boxes = 0


# ==========================================
# CONVERSION
# ==========================================

for item in data.values():

    filename = item.get("filename")

    if not filename:
        continue

    image_path = IMAGE_DIR / filename

    # --------------------------------------
    # Check image exists
    # --------------------------------------

    if not image_path.exists():
        print(f"[MISSING] {filename}")
        missing_images += 1
        continue

    # --------------------------------------
    # Read actual image dimensions
    # --------------------------------------

    try:
        with Image.open(image_path) as img:
            image_width, image_height = img.size

    except Exception as e:
        print(f"[ERROR] Cannot open {filename}: {e}")
        continue

    yolo_lines = []

    # --------------------------------------
    # Read VIA regions
    # --------------------------------------

    regions = item.get("regions", [])

    for region in regions:

        shape = region.get("shape_attributes", {})

        if shape.get("name") != "rect":
            continue

        # VIA rectangle
        x = float(shape.get("x", 0))
        y = float(shape.get("y", 0))
        width = float(shape.get("width", 0))
        height = float(shape.get("height", 0))

        # ----------------------------------
        # Original box
        # ----------------------------------

        x1 = x
        y1 = y
        x2 = x + width
        y2 = y + height

        # ----------------------------------
        # Keep box inside image
        # ----------------------------------

        x1 = max(0, min(x1, image_width))
        y1 = max(0, min(y1, image_height))

        x2 = max(0, min(x2, image_width))
        y2 = max(0, min(y2, image_height))

        # ----------------------------------
        # Check valid box
        # ----------------------------------

        box_width = x2 - x1
        box_height = y2 - y1

        if box_width <= 0 or box_height <= 0:
            invalid_boxes += 1
            print(f"[INVALID BOX] {filename}")
            continue

        # ----------------------------------
        # YOLO center coordinates
        # ----------------------------------

        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2

        # ----------------------------------
        # Normalize
        # ----------------------------------

        center_x /= image_width
        center_y /= image_height

        box_width /= image_width
        box_height /= image_height

        # ----------------------------------
        # YOLO format
        #
        # class x_center y_center width height
        # ----------------------------------

        line = (
            f"{FACE_CLASS_ID} "
            f"{center_x:.6f} "
            f"{center_y:.6f} "
            f"{box_width:.6f} "
            f"{box_height:.6f}"
        )

        yolo_lines.append(line)

    # --------------------------------------
    # Create TXT filename
    # --------------------------------------

    label_filename = Path(filename).stem + ".txt"
    label_path = LABEL_DIR / label_filename

    # --------------------------------------
    # Save YOLO label
    # --------------------------------------

    label_path.write_text(
        "\n".join(yolo_lines),
        encoding="utf-8"
    )

    processed += 1

    if yolo_lines:
        with_faces += 1
    else:
        empty_labels += 1


# ==========================================
# FINAL REPORT
# ==========================================

print()
print("=" * 50)
print("VIA → YOLO CONVERSION COMPLETE")
print("=" * 50)

print(f"Images processed : {processed}")
print(f"Images with face : {with_faces}")
print(f"Empty labels     : {empty_labels}")
print(f"Missing images   : {missing_images}")
print(f"Invalid boxes    : {invalid_boxes}")

print()
print("YOLO labels saved in:")
print(LABEL_DIR)