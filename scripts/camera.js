// Camera Elements
const video = document.getElementById("video"); // hidden raw camera feed
const rawCanvas = document.getElementById("rawCanvas"); // offscreen buffer for AI
const rawCtx = rawCanvas.getContext("2d");

const previewCanvas = document.getElementById("previewCanvas"); // visible preview
const previewCtx = previewCanvas.getContext("2d");

const backBtn = document.getElementById("backBtn");
backBtn.onclick = () => {
  window.location.href = "../index.html";
};

// Camera Initialization

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user", // front camera
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: false
    });

    video.srcObject = stream;

    video.onloadedmetadata = () => {
      // Raw canvas = camera resolution (AI input)
      rawCanvas.width = video.videoWidth;
      rawCanvas.height = video.videoHeight;

      // Preview canvas = UI resolution
      const rect = previewCanvas.getBoundingClientRect();
      previewCanvas.width = rect.width;
      previewCanvas.height = rect.height;

      // Start main loop
      loop();
    };
  } catch (err) {
    console.error("Camera access denied:", err);
  }
}


// Main Loop

function loop() {
  // 1️⃣ Draw raw camera frame (full resolution, unmodified)
  rawCtx.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);

  // AI integration placeholder
  // const rawFrame = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
  // const aiResult = await runInference(rawFrame);
  // preprocess(rawFrame); etc.

  // 2️⃣ Render preview canvas (center-cropped + mirrored)
  drawPreview();

  requestAnimationFrame(loop);
}


// Preview rendering (post-AI)

function drawPreview() {
  const srcW = rawCanvas.width;
  const srcH = rawCanvas.height;

  const dstW = previewCanvas.width;
  const dstH = previewCanvas.height;

  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;

  let sx, sy, sw, sh;

  if (srcAspect > dstAspect) {
    // Source too wide → crop left/right
    sh = srcH;
    sw = sh * dstAspect;
    sx = (srcW - sw) / 2;
    sy = 0;
  } else {
    // Source too tall → crop top/bottom
    sw = srcW;
    sh = sw / dstAspect;
    sx = 0;
    sy = (srcH - sh) / 2;
  }

  previewCtx.save();

  // Mirror for user-facing preview
  previewCtx.scale(-1, 1);
  previewCtx.translate(-dstW, 0);

  // Draw the cropped raw frame
  previewCtx.drawImage(rawCanvas, sx, sy, sw, sh, 0, 0, dstW, dstH);

  previewCtx.restore();

  // 🔮 AI overlay placeholder
  // drawBoxes(previewCtx, aiResult);
  // drawMasks(previewCtx, aiResult);
  // drawHeatmap(previewCtx, aiResult);
}

// -----------------------------------------------------------------------------
// Start camera
// -----------------------------------------------------------------------------
startCamera();