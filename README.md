

# Real-Time ASL Alphabet Detection

## Project Overview
This project aims to detect the American Sign Language (ASL) alphabet in real-time using trained neural network. The project's scope includes data preprocessing, model training, and a prototype application. This project was made as a part of my studies at University of Gdańsk.

## Table of Contents
1. Techonology
2. Data Preprocessing
3. Model Training
4. Prototype Application
5. Usage

## Technologies
The entirety of this project was written in Python using Tensorflow library for creating the model and OpenCV for capturing video from the device. For hand detection and landmark extraction MediaPipe was used. 

## Data Preprocessing
Core data set used was [Synthetic ASL Alphabet](https://www.kaggle.com/datasets/lexset/synthetic-asl-alphabet) containing over 7 Gigabytes worth of data spread over 26,000 images of hand signs plus 1,000 of "Blank" images containing no hands. 

In ASL 24 out of 26 signs included in the alphabet are static, while two - letters J and Z - are dynamic gestures. This data set simplified them to static signs containing the position of the hand roughly in the middle of the gesture. 

I've decided to convert the unwieldy images into a sleek data structure containing landmarks (x and y values to be specific) extracted via MediaPipe, which shrunk down the 7GB into 20MB .csv file.

During later testing and training, I kept coming back to improve on the data processing process. At first I've decided to include the 'z' axis in training, in hopes of achieving a more accurate read during RTP (Real-Time Prediction). Which surprisingly dropped the accuracy into single digits. Later on I've noticed the issue with missing landmarks which caused the problems. 

asl-datav2.csv is one file I've preserved that contains an example of a dropped landmark, letter 'W' misses one of its columns. That was also the point I've decided to augment images in the dataset to expand it, which proved to be invaluable in reaching higher preformance in RTP later on.

Around this point, after fixing the issue by correctly filling in missing data, I've noticed high jitter during RTP, which turned out to be a fault of data normalization. Previously I've normalized data between 0 and 1, but that caused very small movement on camera to translate to big changes in collected data. I've decided to change this by using x = x - min(arr_x) in place of the old approach.

This success caused me to revisit the 'z' axis, which arguably worked this time, but the results were hardly better (many dropped landmarks) so I've decided to leave this axis for good. The asl-datav3.csv and asl-datav3-augmented.csv contain the forementioned data.

Datafiles v4 are the final preprocessed datafiles used in the best performing model.

## Model Training
Luckily, training the model was very simple, perhaps as compensation for problems with preprocessing. It is a Sequential model made using keras.
The structure is as follows:

1. Input layer, 128 Neurons, ReLU activation. Nothing fancy.
2. Dropout layer, 0.2. Prevents overfitting.
3. Two hidden layers with 64 and 32 Neurons respecively, ReLU activation and another Dropout between them. Nothing fancy
4. Output layer, 27 possible outputs (26 for letters + 1 for Blank), Softmax activation, works well for multi-classification problems.

The model is set to train for a hundred epochs with an early stop set up to halt the training process if no improvement is made on validation loss for 10 epochs.

## Prototype Application
Once the model was up and running, this was basically a home run. The application uses OpenCV to capture frames from a video device, detects a hand using MediaPipe and feeds the landmarks to a loaded model. Next it displays the landmarks with connections and the model's prediction. RTP achieved!

## Usage

### Option A — Original desktop prototype (OpenCV window)
Install requirements from `requirements.txt`, run `real-time-prediciton.py` and start signing. Quit with `q`.

### Option B — Web application (recommended)
The web app reuses the exact same trained model (`model/asl_classifierv4.h5`) but exposes it through a browser UI: webcam preview, live letter prediction, and a sentence builder where each sign is committed after being held steady for ~1.5 s. MediaPipe runs in the browser, so only the 42-feature vector travels to the backend per prediction.

Architecture: **FastAPI** (Python) + **React + Vite + TypeScript** (browser).

**Backend** (Python ≥ 3.10):
```
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Endpoints: `GET /health`, `GET /labels`, `POST /predict`.

**Frontend** (Node ≥ 18):
```
cd frontend
npm install
npm run dev
```
Open <http://127.0.0.1:5173>, allow camera access, and start signing.

Controls inside the web app:
- Hold a sign for ~1.5 s → letter is appended to the sentence.
- `Space`, `Backspace`, `Clear`, `Copy` buttons.
- Keyboard shortcuts: `Space` / `Backspace` / `Esc` / `Ctrl+C`.
