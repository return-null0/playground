// Camera Elements
const video = document.getElementById("video"); // hidden raw camera feed
const rawCanvas = document.getElementById("rawCanvas"); // offscreen buffer for AI
const rawCtx = rawCanvas.getContext("2d");

// Small offscreen canvas for AI processing (Resizing to 640px improves performance)
const aiCanvas = document.createElement("canvas");
const aiCtx = aiCanvas.getContext('2d', { willReadFrequently: true });
const AI_WIDTH = 640; 
let AI_HEIGHT = 480; // Calculated dynamically

const previewCanvas = document.getElementById("previewCanvas"); // visible preview
const previewCtx = previewCanvas.getContext("2d");

const backBtn = document.getElementById("backBtn");
backBtn.onclick = () => {
  window.location.href = "../index.html";
};

// State for AI Results
let lastDetections = [];
let lastSentTime = 0;
const DETECTION_INTERVAL = 100; // Send frame to worker every 100ms (10 FPS)


// Camera Initialization


async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: false
    });

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      // 1. Raw canvas = camera resolution
      rawCanvas.width = video.videoWidth;
      rawCanvas.height = video.videoHeight;

      // 2. AI Canvas = Scaled down resolution (faster inference)
      const aspectRatio = video.videoHeight / video.videoWidth;
      aiCanvas.width = AI_WIDTH;
      aiCanvas.height = AI_WIDTH * aspectRatio;
      AI_HEIGHT = aiCanvas.height;

      // 3. Preview canvas = UI resolution
      const rect = previewCanvas.getBoundingClientRect();
      previewCanvas.width = rect.width;
      previewCanvas.height = rect.height;

      // Start the main loop
      loop();
    };

    // Start the new Object Worker
    window.electron.startObjectWorker();

    window.electron.onObjectResult((data) => {
      lastDetections = data.objects;
    });

  } catch (err) {
    console.error("Camera access denied:", err);
  }
}


// Main Loop


function loop() {
  if (video.paused || video.ended) return;

  rawCtx.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);

  const now = performance.now();
  if (now - lastSentTime > DETECTION_INTERVAL) {
    sendFrameToWorker();
    lastSentTime = now;
  }
  drawPreview();

  requestAnimationFrame(loop);
}

function sendFrameToWorker() {

  aiCtx.drawImage(rawCanvas, 0, 0, aiCanvas.width, aiCanvas.height);

  const imageData = aiCtx.getImageData(0, 0, aiCanvas.width, aiCanvas.height);

  window.electron.sendObjectFrame({
    type: "FRAME_DATA",
    data: imageData.data, 
    width: aiCanvas.width,
    height: aiCanvas.height,
    timestamp: performance.now()
  });
}


// Preview Rendering


function drawPreview() {
  const srcW = rawCanvas.width;
  const srcH = rawCanvas.height;
  const dstW = previewCanvas.width;
  const dstH = previewCanvas.height;

  // Calculate crop to fill (object-fit: cover logic)
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  let sx, sy, sw, sh;

  if (srcAspect > dstAspect) {
    sh = srcH;
    sw = sh * dstAspect;
    sx = (srcW - sw) / 2;
    sy = 0;
  } else {
    sw = srcW;
    sh = sw / dstAspect;
    sx = 0;
    sy = (srcH - sh) / 2;
  }

  previewCtx.save();

  // 1. Mirror and draw the video feed
  previewCtx.scale(-1, 1);
  previewCtx.translate(-dstW, 0);
  previewCtx.drawImage(rawCanvas, sx, sy, sw, sh, 0, 0, dstW, dstH);

  // 2. Draw Bounding Boxes (Object Detection Overlay)
  // We need to un-mirror logic here to draw text correctly, OR draw boxes while mirrored.
  // It is easier to restore context, then draw boxes on top, but we must manually mirror coordinates.
  
  previewCtx.restore(); 

  // Draw Detections
  if (lastDetections.length > 0) {
    drawBoxes(previewCtx, lastDetections, sw, sh, sx, sy, dstW, dstH);
  }
}

// 1. Get reference to the checkbox
const togglePersonCheckbox = document.getElementById("togglePerson");

function drawBoxes(ctx, objects, cropW, cropH, cropX, cropY, canvasW, canvasH) {
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 3;
  ctx.font = "18px Arial";
  ctx.fillStyle = "#00FF00";

  objects.forEach(obj => {

    // 🆕 TOGGLE LOGIC: Skip 'person' if checkbox is off

    if (obj.class === 'person' && !togglePersonCheckbox.checked) {
      return; 
    }


    let { yMin, xMin, yMax, xMax } = obj.bbox;


    let boxX = xMin * rawCanvas.width;
    let boxY = yMin * rawCanvas.height;
    let boxW = (xMax - xMin) * rawCanvas.width;
    let boxH = (yMax - yMin) * rawCanvas.height;

    boxX = boxX - cropX;
    boxY = boxY - cropY;

    let scaleX = canvasW / cropW;
    let scaleY = canvasH / cropH;

    let finalX = boxX * scaleX;
    let finalY = boxY * scaleY;
    let finalW = boxW * scaleX;
    let finalH = boxH * scaleY;

    //because of mirroring
    finalX = canvasW - (finalX + finalW);


    ctx.beginPath();
    ctx.rect(finalX, finalY, finalW, finalH);
    ctx.stroke();

    // Draw Label
    ctx.fillText(`${obj.class} ${Math.round(obj.score * 100)}%`, finalX, finalY - 5);
  });
}


startCamera();