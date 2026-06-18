import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import math
import collections

# Basic helper to calculate distance
def calculate_distance(p1, p2):
    return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)

def detect_activity(landmarks):
    # Left wrist index: 15, Right wrist: 16
    # Left shoulder: 11, Right shoulder: 12
    left_wrist = landmarks[15]
    right_wrist = landmarks[16]
    left_shoulder = landmarks[11]
    right_shoulder = landmarks[12]

    # Arms raised if wrists are above shoulders (y is inverted in image coordinates)
    if left_wrist.y < left_shoulder.y and right_wrist.y < right_shoulder.y:
        return "Arms Raised"
    
    return "Active"

def main():
    # 1. Initialize the PoseLandmarker using the Tasks API
    base_options = python.BaseOptions(model_asset_path='pose_landmarker_lite.task')
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        output_segmentation_masks=False)
    detector = vision.PoseLandmarker.create_from_options(options)
    
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    # To track movement over time
    prev_center = None
    motion_history = collections.deque(maxlen=10)

    print("Press 'q' or 'ESC' to exit.")

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            continue
            
        # Convert to RGB and then to MediaPipe Image format
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
        
        # Run inference
        detection_result = detector.detect(mp_image)
        
        activity = "No Person Detected"
        motion_status = "Idle"
        
        if detection_result.pose_landmarks:
            # We assume one person detected for simplicity
            landmarks = detection_result.pose_landmarks[0]
            
            activity = detect_activity(landmarks)
            
            # Nose index is 0
            nose = landmarks[0]
            
            if prev_center is not None:
                dist = calculate_distance(nose, prev_center)
                motion_history.append(dist)
                avg_motion = sum(motion_history) / len(motion_history)
                
                if avg_motion > 0.02: # Arbitrary threshold for motion
                    motion_status = "Moving"
                else:
                    motion_status = "Still"
            prev_center = nose
            
            # Draw simple dots on key body parts
            for landmark in landmarks:
                x = int(landmark.x * image.shape[1])
                y = int(landmark.y * image.shape[0])
                cv2.circle(image, (x, y), 5, (0, 255, 0), -1)

        # Display info
        cv2.putText(image, f"Activity: {activity}", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.putText(image, f"Motion: {motion_status}", (10, 70), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)

        cv2.imshow('MediaPipe Pose Detection', image)
        
        key = cv2.waitKey(5) & 0xFF
        if key == 27 or key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
