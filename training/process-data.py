import os
import pandas as pd
import cv2
from tensorflow.keras.preprocessing.image import ImageDataGenerator

import mediapipe as mp

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=True, min_detection_confidence=0.6)

data_paths = ['./data/test_alphabet', './data/train_alphabet']

original_data = []
augmented_data = []
labels = []

data_gen = ImageDataGenerator(
    rotation_range=5,
    width_shift_range=0.1,
    height_shift_range=0.1,
    zoom_range=0.2,
    brightness_range=[0.8, 1.2]
)

def augment_image(img):
    img = img.reshape((1,) + img.shape)  
    it = data_gen.flow(img, batch_size=1)  
    return next(it)[0].astype('uint8') 


def process_image(img_rgb):
    results = hands.process(img_rgb)
    data_aux = [0] * 42
    x_ = []
    y_ = []

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            for i in range(len(hand_landmarks.landmark)):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y

                x_.append(x)
                y_.append(y)

            for i in range(min(len(hand_landmarks.landmark), 21)):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y

                data_aux[i*2] = x - min(x_)
                data_aux[i*2 + 1] = y - min(y_)

    return data_aux

for data_path in data_paths:
    for dir in os.listdir(data_path):
        for img_path in os.listdir(os.path.join(data_path, dir)):
            img = cv2.imread(os.path.join(data_path, dir, img_path))
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

            labels.append(dir)

            original_features = process_image(img_rgb)
            original_data.append(original_features)

            augmented_img_rgb = augment_image(img_rgb)
            augmented_features = process_image(augmented_img_rgb)
            augmented_data.append(augmented_features)

original_df = pd.DataFrame(original_data)
original_df['label'] = labels

augmented_df = pd.DataFrame(augmented_data)
augmented_df['label'] = labels

mask = (original_df.loc[:, original_df.columns != 'label'] == 0).all(axis=1)


original_df.loc[original_df['label'] == 'Blank', original_df.columns != 'label'] = 0.0
augmented_df.loc[augmented_df['label'] == 'Blank', original_df.columns != 'label'] = 0.0

# Save the DataFrames to CSV
original_df.to_csv('./data/asl-datav4.csv', index=False)
augmented_df.to_csv('./data/asl-datav4-augmented.csv', index=False)