from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from ultralytics import YOLO
from PIL import Image

from pathlib import Path
import io


# ============================================
# FASTAPI APP
# ============================================

app = FastAPI(
    title="YOLO26n Face Detection API",
    description="Face detection and face cropping using YOLO26n",
    version="1.0"
)


# ============================================
# CORS
# ============================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# YOLO MODEL
# ============================================

MODEL_PATH = "runs/detect/runs/face_detection/weights/best.pt"

model = YOLO(MODEL_PATH)


# ============================================
# FACE SAVE FOLDER
# ============================================

SAVE_DIR = Path("detected_faces")

SAVE_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================
# FACE COUNTER
# ============================================

face_counter = 0


# ============================================
# HOME ROUTE
# ============================================

@app.get("/")
def home():

    return {
        "message": "YOLO26n Face Detection API is running"
    }


# ============================================
# DETECT + CROP + SAVE FACE
# ============================================

@app.post("/detect")
async def detect_faces(
    file: UploadFile = File(...)
):

    global face_counter

    # ========================================
    # CHECK IMAGE FILE
    # ========================================

    if (
        not file.content_type
        or not file.content_type.startswith("image/")
    ):

        return JSONResponse(
            status_code=400,
            content={
                "error": "Please upload an image file"
            }
        )

    # ========================================
    # READ IMAGE
    # ========================================

    try:

        image_bytes = await file.read()

        image = Image.open(
            io.BytesIO(image_bytes)
        ).convert("RGB")

    except Exception:

        return JSONResponse(
            status_code=400,
            content={
                "error": "Invalid or corrupted image file"
            }
        )

    # ========================================
    # YOLO DETECTION
    # ========================================

    results = model.predict(
        source=image,
        conf=0.10,
        device="cpu",
        verbose=False
    )

    # ========================================
    # DETECTION LIST
    # ========================================

    detections = []

    # ========================================
    # PROCESS EACH DETECTED FACE
    # ========================================

    for result in results:

        boxes = result.boxes

        for box in boxes:

            # ==================================
            # GET BOX COORDINATES
            # ==================================

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            confidence = float(box.conf[0])

            # ==================================
            # CONVERT TO INTEGER
            # ==================================

            x1 = int(x1)
            y1 = int(y1)
            x2 = int(x2)
            y2 = int(y2)

            # ==================================
            # KEEP BOX INSIDE IMAGE
            # ==================================

            x1 = max(0, x1)
            y1 = max(0, y1)

            x2 = min(image.width, x2)
            y2 = min(image.height, y2)

            # ==================================
            # CROP FACE
            # ==================================

            if x2 > x1 and y2 > y1:

                face_crop = image.crop(
                    (
                        x1,
                        y1,
                        x2,
                        y2
                    )
                )

                # ==================================
                # CREATE UNIQUE FILE NAME
                # ==================================

                face_counter += 1

                filename = f"face_{face_counter:04d}.jpg"

                # ==================================
                # SAVE LOCATION
                # ==================================

                save_path = SAVE_DIR / filename

                # ==================================
                # SAVE CROPPED FACE
                # ==================================

                face_crop.save(
                    save_path,
                    "JPEG",
                    quality=95
                )

            else:

                filename = None

            # ==================================
            # ADD DETECTION RESULT
            # ==================================

            detections.append({

                "class": "face",

                "confidence": round(
                    confidence,
                    4
                ),

                "box": {

                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2

                },

                "cropped_file": filename

            })

    # ========================================
    # RETURN RESULT
    # ========================================

    return {

        "filename": file.filename,

        "face_count": len(detections),

        "detections": detections

    }