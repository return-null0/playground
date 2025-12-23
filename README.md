# AI Playground App

## Overview

This is a cross-platform Electron-based AI application that currently supports:
	- Video Mode: Real-time camera capture with a hidden raw feed for AI inference and a mirrored, cropped user-facing preview.
	- Text Generation Mode: Planned feature for AI text generation (not yet implemented).

The app is designed to support AI integration in both modes with a clean separation of raw data and user interface.



## Features

### Video Mode (In Progress)
	- Hidden <video> element as raw camera feed
	- Raw canvas for AI input (full-resolution frames)
	- Preview canvas for user-facing display (cropped, mirrored, ready for overlays)
	- Center-crop and mirroring logic to keep the user’s face centered
	- Easy future hooks for:
	- AI inference
	- Overlays (bounding boxes, masks, heatmaps)
	- Face/object tracking
	- Modular JS structure for easy expansion

### Text Generation Mode (Planned)
	- Integration with AI text generation models (e.g., GPT, local models, or API-based)
	- Will include:
	- Input textarea for user prompts
	- Output display with history
	- Model selection or settings panel
	- Future integration will follow the same modular architecture as video mode
