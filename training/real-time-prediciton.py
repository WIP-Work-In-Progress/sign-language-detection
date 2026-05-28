import cv2
import mediapipe as mp
import numpy as np
from tensorflow.keras.models import load_model
import pandas as pd


model = load_model('./model/asl_classifierv4.h5')

df = pd.read_csv('./data/asl-data.csv')

# Create a dictionary for the labels
labels_dict = {i: label for i, label in enumerate(df['label'].unique())}

cap = cv2.VideoCapture(1)

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

hands = mp_hands.Hands(static_image_mode=True, min_detection_confidence=0.3)

while True:
    data_aux = [0] * 42
    x_ = []
    y_ = []

    ret, frame = cap.read()

    H, W, _ = frame.shape

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    results = hands.process(frame_rgb)
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            mp_drawing.draw_landmarks(
                frame, 
                hand_landmarks,  
                mp_hands.HAND_CONNECTIONS, 
                mp_drawing_styles.get_default_hand_landmarks_style(),
                mp_drawing_styles.get_default_hand_connections_style()
                )

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

        # Ensure data_aux is the correct length
        if len(data_aux) < 42:
            data_aux += [0] * (42 - len(data_aux))

        prediction = model.predict([np.asarray(data_aux).reshape(1, -1)])

        predicted_character = labels_dict[np.argmax(prediction[0])]

        x1 = int(min(x_) * W) - 10
        y1 = int(min(y_) * H) - 10

        x2 = int(max(x_) * W) + 10
        y2 = int(max(y_) * H) + 10

        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 0), 4)
        cv2.putText(frame, predicted_character, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (255, 255, 255), 3,
                    cv2.LINE_AA)

    cv2.imshow('frame', frame)
    key = cv2.waitKey(1) & 0xFF

    # exit thingy
    if key == ord('q'):
        break


cap.release()
cv2.destroyAllWindows()