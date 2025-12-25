const tf = require("@tensorflow/tfjs-node");
const path = require("path");

let model = null;

// COCO Label Map
const LABEL_MAP = {
  1: 'person', 2: 'bicycle', 3: 'car', 4: 'motorcycle', 5: 'airplane',
  6: 'bus', 7: 'train', 8: 'truck', 9: 'boat', 10: 'traffic light',
  11: 'fire hydrant', 13: 'stop sign', 14: 'parking meter', 15: 'bench',
  16: 'bird', 17: 'cat', 18: 'dog', 19: 'horse', 20: 'sheep',
  21: 'cow', 22: 'elephant', 23: 'bear', 24: 'zebra', 25: 'giraffe',
  27: 'backpack', 28: 'umbrella', 31: 'handbag', 32: 'tie', 33: 'suitcase',
  34: 'frisbee', 35: 'skis', 36: 'snowboard', 37: 'sports ball', 38: 'kite',
  39: 'baseball bat', 40: 'baseball glove', 41: 'skateboard', 42: 'surfboard',
  43: 'tennis racket', 44: 'bottle', 46: 'wine glass', 47: 'cup', 48: 'fork',
  49: 'knife', 50: 'spoon', 51: 'bowl', 52: 'banana', 53: 'apple',
  54: 'sandwich', 55: 'orange', 56: 'broccoli', 57: 'carrot', 58: 'hot dog',
  59: 'pizza', 60: 'donut', 61: 'cake', 62: 'chair', 63: 'couch',
  64: 'potted plant', 65: 'bed', 67: 'dining table', 70: 'toilet', 72: 'tv',
  73: 'laptop', 74: 'mouse', 75: 'remote', 76: 'keyboard', 77: 'cell phone',
  78: 'microwave', 79: 'oven', 80: 'toaster', 81: 'sink', 82: 'refrigerator',
  84: 'book', 85: 'clock', 86: 'vase', 87: 'scissors', 88: 'teddy bear',
  89: 'hair drier', 90: 'toothbrush'
};

async function loadModel() {
  const modelDir = path.join(__dirname, "..", "models/image");

  const modelUrl = `file://${modelDir}/model.json`;

  try {
    model = await tf.loadGraphModel(modelUrl);
    console.log(`Object Detection Loaded: ${tf.getBackend().toUpperCase()}`);
  } catch (error) {
    console.error("Failed to load model:", error.message);
  }
}

loadModel();

process.parentPort.on("message", async (e) => {
  const msg = e.data;
  if (!model || msg.type !== "FRAME_DATA") return;

  // Variables to hold tensors that must survive until the end
  let inputTensor, results, nmsIndices;
  let boxes2D, maxScores, classes1D; 
  let finalBoxes, finalScores, finalClasses;

  try {

    // 1. PREPARE INPUT (Sync Tidy)

    inputTensor = tf.tidy(() => {
      const rgba = tf.tensor3d(msg.data, [msg.height, msg.width, 4], 'int32');
      const rgb = rgba.slice([0, 0, 0], [-1, -1, 3]);
      const batched = rgb.expandDims(0);
      return tf.image.resizeBilinear(batched, [320, 320]).toInt(); 
    });


    // 2. EXECUTE MODEL (Async)

    results = await model.executeAsync(inputTensor);

    // Identify outputs based on shape
    let scoresTensorRaw, boxesTensorRaw;
    const outputArray = Array.isArray(results) ? results : Object.values(results);
    
    outputArray.forEach(t => {
        if (t.shape.length === 4 && t.shape[3] === 4) boxesTensorRaw = t; // [1, 1917, 1, 4]
        else if (t.shape.length === 3 && t.shape[2] === 90) scoresTensorRaw = t; // [1, 1917, 90]
    });

    if (!boxesTensorRaw || !scoresTensorRaw) throw new Error("Output shape mismatch");


    // 3. PREPARE FOR NMS (Sync Tidy)
    // We process raw output into the flat 1D/2D arrays NMS needs.
    // We return these tensors to keep them alive for the async NMS step.

    ({ boxes2D, maxScores, classes1D } = tf.tidy(() => {
        const b = boxesTensorRaw.squeeze(); // [1917, 4] (removes batch & single dims)
        const s = scoresTensorRaw.squeeze(); // [1917, 90]
        return {
            boxes2D: b,
            maxScores: s.max(1), // Best score for each box [1917]
            classes1D: s.argMax(1) // Class index for each box [1917]
        };
    }));


    // 4. RUN NMS

    // Keeps up to 20 boxes with > 50% confidence, removing overlaps
    nmsIndices = await tf.image.nonMaxSuppressionAsync(
        boxes2D, maxScores, 20, 0.5, 0.5
    );


    // 5. GATHER FINAL RESULTS (Sync Tidy)

    const finalData = tf.tidy(() => {
        return {
            boxes: boxes2D.gather(nmsIndices),
            scores: maxScores.gather(nmsIndices),
            classes: classes1D.gather(nmsIndices)
        };
    });
    
    finalBoxes = finalData.boxes;
    finalScores = finalData.scores;
    finalClasses = finalData.classes;


    // 6. DOWNLOAD TO CPU (Async)

    const [b, s, c] = await Promise.all([
        finalBoxes.array(),
        finalScores.array(),
        finalClasses.array()
    ]);

    // Renderer format
    const detectedObjects = b.map((box, i) => ({
        class: LABEL_MAP[c[i] + 1] || 'unknown',
        score: s[i],
        bbox: {
            yMin: box[0],
            xMin: box[1],
            yMax: box[2],
            xMax: box[3]
        }
    }));

    process.parentPort.postMessage({
      type: "OBJECT_RESULT",
      timestamp: msg.timestamp,
      objects: detectedObjects
    });

  } catch (err) {
    console.error("Worker Error:", err);
  } finally {

    // 7. CLEANUP

    if (inputTensor) inputTensor.dispose();
    if (results) {
        if (Array.isArray(results)) results.forEach(t => t.dispose());
        else Object.values(results).forEach(t => t.dispose());
    }
    // Intermediate NMS inputs
    if (boxes2D) boxes2D.dispose();
    if (maxScores) maxScores.dispose();
    if (classes1D) classes1D.dispose();
    if (nmsIndices) nmsIndices.dispose();
    // Final outputs
    if (finalBoxes) finalBoxes.dispose();
    if (finalScores) finalScores.dispose();
    if (finalClasses) finalClasses.dispose();
  }
});