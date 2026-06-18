import cv2
import mediapipe as mp
import time
import math
import collections

mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_pose = mp.solutions.pose

# Basic helper to calculate distance
def calculate_distance(p1, p2):
    return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)

def detect_activity(landmarks):
    # Simple heuristics for activity
    left_wrist = landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value]
    right_wrist = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value]
    left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
    right_shoulder = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]

    # Arms raised if wrists are above shoulders (y is inverted)
    if left_wrist.y < left_shoulder.y and right_wrist.y < right_shoulder.y:
        return "Arms Raised"
    
    # Sitting vs standing heuristic (depends on hip vs knee visibility and distance)
    # This is highly simplified and relies on full body visibility.
    # We will just fall back to generic "Active" if nothing else matched.
    return "Active"

def main():
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    # To track movement over time
    prev_center = None
    motion_history = collections.deque(maxlen=10)

    print("Press 'q' or 'ESC' to exit.")

    with mp_pose.Pose(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5) as pose:
        
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                print("Ignoring empty camera frame.")
                continue

            # To improve performance, optionally mark the image as not writeable to
            # pass by reference.
            image.flags.writeable = False
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = pose.process(image)

            # Draw the pose annotation on the image.
            image.flags.writeable = True
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            activity = "No Person Detected"
            motion_status = "Idle"

            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    image,
                    results.pose_landmarks,
                    mp_pose.POSE_CONNECTIONS,
                    landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style())
                
                landmarks = results.pose_landmarks.landmark
                activity = detect_activity(landmarks)

                # Use nose as an anchor to track overall motion
                nose = landmarks[mp_pose.PoseLandmark.NOSE.value]
                
                if prev_center is not None:
                    dist = calculate_distance(nose, prev_center)
                    motion_history.append(dist)
                    avg_motion = sum(motion_history) / len(motion_history)
                    
                    if avg_motion > 0.02: # Arbitrary threshold for motion
                        motion_status = "Moving"
                    else:
                        motion_status = "Still"
                        
                prev_center = nose

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
