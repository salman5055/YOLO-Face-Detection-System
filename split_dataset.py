import random
import shutil
from pathlib import Path

# ==========================================
# PATHS
# ==========================================

ROOT = Path(__file__).resolve().parent

IMAGE_DIR = ROOT / "dataset" / "raw" / "salman"
LABEL_DIR = ROOT / "dataset" / "labels" / "all"

OUTPUT_IMAGE_DIR = ROOT / "dataset" / "images"
OUTPUT_LABEL_DIR = ROOT / "dataset" / "labels"


# ==========================================
# SETTINGS
# ==========================================

TRAIN_RATIO = 0.70
VAL_RATIO = 0.20
TEST_RATIO = 0.10

RANDOM_SEED = 42

random.seed(RANDOM_SEED)


# ==========================================
# GET IMAGES
# ==========================================

image_extensions = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp"
}

images = [
    p for p in IMAGE_DIR.iterdir()
    if p.is_file() and p.suffix.lower() in image_extensions
]

images.sort()


# ==========================================
# SHUFFLE
# ==========================================

random.shuffle(images)


# ==========================================
# CALCULATE SPLIT
# ==========================================

total = len(images)

train_count = int(total * TRAIN_RATIO)
val_count = int(total * VAL_RATIO)

train_images = images[:train_count]

val_images = images[
    train_count:
    train_count + val_count
]

test_images = images[
    train_count + val_count:
]


# ==========================================
# CREATE / CLEAN FOLDERS
# ==========================================

for split in ["train", "val", "test"]:

    image_split_dir = OUTPUT_IMAGE_DIR / split
    label_split_dir = OUTPUT_LABEL_DIR / split

    # Remove old split data
    if image_split_dir.exists():
        shutil.rmtree(image_split_dir)

    if label_split_dir.exists():
        shutil.rmtree(label_split_dir)

    # Create fresh folders
    image_split_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    label_split_dir.mkdir(
        parents=True,
        exist_ok=True
    )


# ==========================================
# COPY FUNCTION
# ==========================================

def copy_dataset(image_list, split):

    copied = 0
    missing_labels = 0

    for image_path in image_list:

        # ----------------------------------
        # Image destination
        # ----------------------------------

        destination_image = (
            OUTPUT_IMAGE_DIR
            / split
            / image_path.name
        )

        # ----------------------------------
        # Corresponding YOLO label
        # ----------------------------------

        label_path = (
            LABEL_DIR
            / f"{image_path.stem}.txt"
        )

        destination_label = (
            OUTPUT_LABEL_DIR
            / split
            / f"{image_path.stem}.txt"
        )

        # ----------------------------------
        # Copy image
        # ----------------------------------

        shutil.copy2(
            image_path,
            destination_image
        )

        # ----------------------------------
        # Copy label
        # ----------------------------------

        if label_path.exists():

            shutil.copy2(
                label_path,
                destination_label
            )

        else:

            print(
                f"[WARNING] Label missing: "
                f"{image_path.name}"
            )

            missing_labels += 1

        copied += 1

    return copied, missing_labels


# ==========================================
# COPY DATA
# ==========================================

train_copied, train_missing = copy_dataset(
    train_images,
    "train"
)

val_copied, val_missing = copy_dataset(
    val_images,
    "val"
)

test_copied, test_missing = copy_dataset(
    test_images,
    "test"
)


# ==========================================
# FINAL REPORT
# ==========================================

print()
print("=" * 50)
print("DATASET SPLIT COMPLETE")
print("=" * 50)

print(f"Total images : {total}")
print()

print(f"Train : {train_copied}")
print(f"Val   : {val_copied}")
print(f"Test  : {test_copied}")

print()

print(f"Train percentage : {train_copied / total * 100:.2f}%")
print(f"Val percentage   : {val_copied / total * 100:.2f}%")
print(f"Test percentage  : {test_copied / total * 100:.2f}%")

print()

print(f"Missing train labels : {train_missing}")
print(f"Missing val labels   : {val_missing}")
print(f"Missing test labels  : {test_missing}")

print()
print("Images:")
print(OUTPUT_IMAGE_DIR)

print()
print("Labels:")
print(OUTPUT_LABEL_DIR)