// ============================================
// YOLO26n FACE DETECTION - PROFESSIONAL FRONTEND
// ============================================


// ============================================
// DOM ELEMENTS
// ============================================

const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const captureCanvas = document.getElementById("captureCanvas");

const startCameraButton =
    document.getElementById("startCamera");

const stopCameraButton =
    document.getElementById("stopCamera");

const status =
    document.getElementById("status");

const faceCount =
    document.getElementById("faceCount");

const confidence =
    document.getElementById("confidence");

const detectionBadge =
    document.getElementById("detectionBadge");

const cameraMessage =
    document.getElementById("cameraMessage");


// ============================================
// CONFIGURATION
// ============================================

const API_URL =
    "http://127.0.0.1:8000/detect";

// API request interval
const DETECTION_INTERVAL = 400;

// Maximum image width sent to API
const MAX_CAPTURE_WIDTH = 640;

// JPEG quality
const JPEG_QUALITY = 0.80;


// ============================================
// GLOBAL VARIABLES
// ============================================

let stream = null;

let detectionRunning = false;

let isDetecting = false;

// FPS calculation
let frameCount = 0;
let fps = 0;
let fpsStartTime = performance.now();

// Detection latency
let detectionTime = 0;


// ============================================
// START CAMERA
// ============================================

startCameraButton.addEventListener(
    "click",
    startCamera
);


async function startCamera() {

    try {

        status.textContent =
            "Requesting camera access...";

        updateBadge("scanning");


        // ========================================
        // CHECK CAMERA SUPPORT
        // ========================================

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Camera API is not supported by this browser."
            );

        }


        // ========================================
        // REQUEST CAMERA
        // ========================================

        stream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: "user",

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }

                },

                audio: false

            });


        // ========================================
        // CONNECT CAMERA
        // ========================================

        camera.srcObject = stream;

        await camera.play();


        // ========================================
        // CAMERA DIMENSIONS
        // ========================================

        if (
            camera.readyState >= 2
        ) {

            setupCanvas();

        }

        else {

            camera.addEventListener(
                "loadedmetadata",
                setupCanvas,
                { once: true }
            );

        }


        // ========================================
        // UPDATE UI
        // ========================================

        startCameraButton.disabled = true;

        stopCameraButton.disabled = false;

        cameraMessage.style.display =
            "none";

        status.textContent =
            "Camera active — scanning for faces...";

        updateBadge("scanning");


        // ========================================
        // RESET FPS
        // ========================================

        frameCount = 0;

        fps = 0;

        fpsStartTime =
            performance.now();


        // ========================================
        // START DETECTION
        // ========================================

        detectionRunning = true;

        detectionLoop();


    }

    catch (error) {

        console.error(
            "Camera Error:",
            error
        );


        status.textContent =
            "Camera access denied or unavailable.";

        updateBadge("error");


        stream = null;

    }

}


// ============================================
// STOP CAMERA
// ============================================

stopCameraButton.addEventListener(
    "click",
    stopCamera
);


function stopCamera() {

    // Stop detection loop
    detectionRunning = false;

    isDetecting = false;


    // ========================================
    // STOP CAMERA STREAM
    // ========================================

    if (stream) {

        stream
            .getTracks()
            .forEach(track => {

                track.stop();

            });

        stream = null;

    }


    // Remove video source
    camera.srcObject = null;


    // ========================================
    // CLEAR DETECTIONS
    // ========================================

    clearCanvas();


    // ========================================
    // RESET UI
    // ========================================

    faceCount.textContent =
        "0";

    confidence.textContent =
        "-";


    // ========================================
    // SHOW CAMERA MESSAGE
    // ========================================

    cameraMessage.style.display =
        "block";


    // ========================================
    // BUTTONS
    // ========================================

    startCameraButton.disabled =
        false;

    stopCameraButton.disabled =
        true;


    // ========================================
    // STATUS
    // ========================================

    status.textContent =
        "System ready. Start the camera.";


    updateBadge("waiting");

}


// ============================================
// CANVAS SETUP
// ============================================

function setupCanvas() {

    if (
        !camera.videoWidth ||
        !camera.videoHeight
    ) {

        return;

    }


    // Match canvas to actual camera resolution
    canvas.width =
        camera.videoWidth;

    canvas.height =
        camera.videoHeight;

}


// ============================================
// DETECTION LOOP
// ============================================

async function detectionLoop() {

    while (
        detectionRunning &&
        stream &&
        stream.active
    ) {


        // ========================================
        // PREVENT OVERLAPPING REQUESTS
        // ========================================

        if (!isDetecting) {

            await detectFace();

        }


        // ========================================
        // WAIT BEFORE NEXT REQUEST
        // ========================================

        await sleep(
            DETECTION_INTERVAL
        );

    }

}


// ============================================
// DETECT FACE
// ============================================

async function detectFace() {

    if (
        !camera.videoWidth ||
        !camera.videoHeight
    ) {

        return;

    }


    isDetecting = true;


    // Start latency timer
    const detectionStart =
        performance.now();


    try {


        // ========================================
        // CAPTURE FRAME
        // ========================================

        const scale =
            Math.min(
                1,
                MAX_CAPTURE_WIDTH /
                    camera.videoWidth
            );


        const captureWidth =
            Math.round(
                camera.videoWidth *
                    scale
            );


        const captureHeight =
            Math.round(
                camera.videoHeight *
                    scale
            );


        captureCanvas.width =
            captureWidth;

        captureCanvas.height =
            captureHeight;


        const context =
            captureCanvas.getContext(
                "2d"
            );


        // ========================================
        // DRAW VIDEO FRAME
        // ========================================

        context.drawImage(

            camera,

            0,
            0,

            captureWidth,
            captureHeight

        );


        // ========================================
        // CONVERT TO JPEG
        // ========================================

        const blob =
            await new Promise(
                resolve => {

                    captureCanvas.toBlob(

                        resolve,

                        "image/jpeg",

                        JPEG_QUALITY

                    );

                }
            );


        if (!blob) {

            return;

        }


        // ========================================
        // CREATE FORM DATA
        // ========================================

        const formData =
            new FormData();


        formData.append(

            "file",

            blob,

            "camera_frame.jpg"

        );


        // ========================================
        // SEND TO FASTAPI
        // ========================================

        const response =
            await fetch(

                API_URL,

                {

                    method: "POST",

                    body: formData

                }

            );


        // ========================================
        // CHECK RESPONSE
        // ========================================

        if (!response.ok) {

            throw new Error(

                `API Error: ${response.status}`

            );

        }


        // ========================================
        // READ JSON
        // ========================================

        const data =
            await response.json();


        // ========================================
        // CALCULATE DETECTION TIME
        // ========================================

        detectionTime =
            Math.round(
                performance.now() -
                detectionStart
            );


        // ========================================
        // UPDATE FPS
        // ========================================

        updateFPS();


        // ========================================
        // UPDATE FACE COUNT
        // ========================================

        faceCount.textContent =
            data.face_count;


        // ========================================
        // NO FACE DETECTED
        // ========================================

        if (
            !data.detections ||
            data.detections.length === 0
        ) {


            confidence.textContent =
                "-";


            clearCanvas();


            status.textContent =
                "Camera active — no face detected";


            updateBadge(
                "scanning"
            );


            return;

        }


        // ========================================
        // FIND HIGHEST CONFIDENCE
        // ========================================

        const highestConfidence =
            Math.max(

                ...data.detections.map(

                    detection =>
                        detection.confidence

                )

            );


        // ========================================
        // DISPLAY CONFIDENCE
        // ========================================

        confidence.textContent =
            `${(
                highestConfidence *
                100
            ).toFixed(1)}%`;


        // ========================================
        // STATUS
        // ========================================

        status.textContent =
            `${data.face_count} face${
                data.face_count > 1
                    ? "s"
                    : ""
            } detected`;


        // ========================================
        // BADGE
        // ========================================

        updateBadge(
            "detected"
        );


        // ========================================
        // DRAW DETECTIONS
        // ========================================

        drawDetections(

            data.detections,

            captureWidth,

            captureHeight

        );


    }

    catch (error) {

        console.error(

            "Detection Error:",

            error

        );


        status.textContent =
            "Unable to connect to Face Detection API";


        updateBadge(
            "error"
        );


        clearCanvas();

    }


    finally {

        isDetecting = false;

    }

}


// ============================================
// DRAW PROFESSIONAL FACE DETECTIONS
// ============================================

function drawDetections(

    detections,

    captureWidth,

    captureHeight

) {


    clearCanvas();


    const context =
        canvas.getContext(
            "2d"
        );


    // ========================================
    // SCALE COORDINATES
    // ========================================

    const scaleX =
        canvas.width /
        captureWidth;


    const scaleY =
        canvas.height /
        captureHeight;


    // ========================================
    // DRAW EACH FACE
    // ========================================

    detections.forEach(

        (detection, index) => {


            const box =
                detection.box;


            const x =
                box.x1 *
                scaleX;


            const y =
                box.y1 *
                scaleY;


            const width =
                (
                    box.x2 -
                    box.x1
                ) *
                scaleX;


            const height =
                (
                    box.y2 -
                    box.y1
                ) *
                scaleY;


            // ====================================
            // GLOW
            // ====================================

            context.save();


            context.shadowColor =
                "rgba(34, 197, 94, 0.85)";


            context.shadowBlur =
                18;


            context.strokeStyle =
                "#22c55e";


            context.lineWidth =
                2;


            context.strokeRect(

                x,
                y,
                width,
                height

            );


            context.restore();


            // ====================================
            // MAIN BOX
            // ====================================

            context.save();


            context.strokeStyle =
                "#22c55e";


            context.lineWidth =
                2;


            context.strokeRect(

                x,
                y,
                width,
                height

            );


            context.restore();


            // ====================================
            // CORNER MARKERS
            // ====================================

            drawCornerMarkers(

                context,

                x,
                y,

                width,
                height

            );


            // ====================================
            // CONFIDENCE
            // ====================================

            const percentage =
                (
                    detection.confidence *
                    100
                ).toFixed(1);


            const label =
                `FACE ${percentage}%`;


            // ====================================
            // LABEL FONT
            // ====================================

            context.font =
                "bold 13px Arial";


            const textWidth =
                context.measureText(
                    label
                ).width;


            const labelWidth =
                textWidth + 20;


            const labelHeight =
                27;


            // ====================================
            // LABEL POSITION
            // ====================================

            let labelY =
                y -
                labelHeight -
                6;


            if (
                labelY < 4
            ) {

                labelY =
                    y + 5;

            }


            // ====================================
            // LABEL BACKGROUND
            // ====================================

            context.fillStyle =
                "rgba(15, 23, 40, 0.96)";


            context.fillRect(

                x,

                labelY,

                labelWidth,

                labelHeight

            );


            // ====================================
            // GREEN INDICATOR
            // ====================================

            context.fillStyle =
                "#22c55e";


            context.fillRect(

                x,

                labelY,

                4,

                labelHeight

            );


            // ====================================
            // LABEL TEXT
            // ====================================

            context.fillStyle =
                "#ffffff";


            context.fillText(

                label,

                x + 10,

                labelY + 18

            );


            // ====================================
            // FACE NUMBER
            // ====================================

            if (
                detections.length > 1
            ) {

                context.font =
                    "bold 11px Arial";


                context.fillStyle =
                    "#22c55e";


                context.fillText(

                    `#${index + 1}`,

                    x + width - 25,

                    y + 17

                );

            }

        }

    );

}


// ============================================
// CORNER MARKERS
// ============================================

function drawCornerMarkers(

    context,

    x,
    y,

    width,
    height

) {


    const cornerSize =
        18;


    context.save();


    context.strokeStyle =
        "#ffffff";


    context.lineWidth =
        4;


    context.lineCap =
        "square";


    // ========================================
    // TOP LEFT
    // ========================================

    context.beginPath();


    context.moveTo(

        x,

        y + cornerSize

    );


    context.lineTo(

        x,

        y

    );


    context.lineTo(

        x + cornerSize,

        y

    );


    context.stroke();


    // ========================================
    // TOP RIGHT
    // ========================================

    context.beginPath();


    context.moveTo(

        x + width -
            cornerSize,

        y

    );


    context.lineTo(

        x + width,

        y

    );


    context.lineTo(

        x + width,

        y + cornerSize

    );


    context.stroke();


    // ========================================
    // BOTTOM LEFT
    // ========================================

    context.beginPath();


    context.moveTo(

        x,

        y + height -
            cornerSize

    );


    context.lineTo(

        x,

        y + height

    );


    context.lineTo(

        x + cornerSize,

        y + height

    );


    context.stroke();


    // ========================================
    // BOTTOM RIGHT
    // ========================================

    context.beginPath();


    context.moveTo(

        x + width -
            cornerSize,

        y + height

    );


    context.lineTo(

        x + width,

        y + height

    );


    context.lineTo(

        x + width,

        y + height -
            cornerSize

    );


    context.stroke();


    context.restore();

}


// ============================================
// CLEAR CANVAS
// ============================================

function clearCanvas() {

    const context =
        canvas.getContext(
            "2d"
        );


    context.clearRect(

        0,

        0,

        canvas.width,

        canvas.height

    );

}


// ============================================
// UPDATE FPS
// ============================================

function updateFPS() {

    frameCount++;


    const now =
        performance.now();


    const elapsed =
        now -
        fpsStartTime;


    if (
        elapsed >= 1000
    ) {

        fps =
            Math.round(

                frameCount /
                (elapsed / 1000)

            );


        frameCount = 0;


        fpsStartTime =
            now;

    }

}


// ============================================
// UPDATE DETECTION BADGE
// ============================================

function updateBadge(state) {


    if (
        state === "detected"
    ) {


        detectionBadge.innerHTML =
            '<span class="badge-dot"></span> Face Detected';


        setBadgeDot(
            "#22c55e"
        );


    }


    else if (
        state === "scanning"
    ) {


        detectionBadge.innerHTML =
            '<span class="badge-dot"></span> Scanning';


        setBadgeDot(
            "#f59e0b"
        );


    }


    else if (
        state === "error"
    ) {


        detectionBadge.innerHTML =
            '<span class="badge-dot"></span> Connection Error';


        setBadgeDot(
            "#ef4444"
        );


    }


    else {


        detectionBadge.innerHTML =
            '<span class="badge-dot"></span> Waiting';


        setBadgeDot(
            "#64748b"
        );

    }

}


// ============================================
// SET BADGE DOT
// ============================================

function setBadgeDot(
    color
) {


    const dot =
        detectionBadge.querySelector(
            ".badge-dot"
        );


    if (!dot) {

        return;

    }


    dot.style.background =
        color;


    dot.style.boxShadow =
        `0 0 10px ${color}`;

}


// ============================================
// SLEEP
// ============================================

function sleep(ms) {

    return new Promise(

        resolve =>
            setTimeout(
                resolve,
                ms
            )

    );

}


// ============================================
// PAGE LOAD
// ============================================

window.addEventListener(
    "load",
    () => {

        updateBadge(
            "waiting"
        );

        status.textContent =
            "System ready. Start the camera.";

    }
);


// ============================================
// PAGE CLOSE
// ============================================

window.addEventListener(
    "beforeunload",
    () => {

        if (stream) {

            stream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }

    }
);