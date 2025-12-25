# AI Playground App
![irobot](irobot.jpg)

## Overview
A high-performance, cross-platform Electron application designed for experimenting with local AI models. The app features a modular architecture that separates the UI thread from heavy AI inference tasks, ensuring a smooth 60 FPS camera preview even while running complex neural networks in the background.

The app is designed to support AI integration in both modes with a clean separation of raw data and user interface.



## Features

#### Video Mode (Vision)
- Real-time object detection powered by TensorFlow.js, running entirely locally on your machine.
- Model: SSD MobileNet V2 (trained on COCO Dataset - 90 Classes).

##### Performance Architecture:

* Off-Main-Thread Inference: Heavy AI processing runs in a dedicated Electron Utility Process (Worker). This prevents the main application window from freezing or stuttering during inference.

* Smart Downscaling: High-res (1080p) video is displayed to the user, while a downscaled (640px) buffer is sent to the AI worker to maximize speed without sacrificing visual quality.

##### Advanced Post-Processing:

* Non-Max Suppression (NMS): The worker filters raw model output (1,900+ tensors) to remove overlapping boxes and noise before sending data back to the UI.

* Client-Side Filtering: Includes a responsive "Show Person" toggle to instantly filter out specific classes without needing to re-run the AI.

### Text Generation Mode (Planned)
- Integration with AI text generation models (e.g. local models, or API-based)
- Will include:
    - Input text area for user prompts
    - Output display with history
    - Model selection or settings panel
- Future integration will follow the same modular architecture as video mode

# Installation 

1. Install Dependencies 

```
npm install
```

##### Note: This utilizes native Node.js modules. Ensure you have Python and C++ build tools installed if required by your OS.

2. Model Setup The app requires the SSD MobileNet V2 model converted for TensorFlow.js.

- [Download: SSD MobileNet V2 on Kaggle](https://www.kaggle.com/models/tensorflow/ssd-mobilenet-v2/tfJs)
    

- Placement: Extract the model files (model.json + binary shards) into: models/image/

3. Run the Application

```
npm start
```


## Usage Tips

- Vision Mode: Click "Vision Mode" to start the camera.

- Toggle Person: Use the switch in the top right to hide "Person" detections. This is useful when holding objects up to the camera, so the bounding box around your body doesn't obscure the item labels.




