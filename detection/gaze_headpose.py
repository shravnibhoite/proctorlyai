
import cv2
import mediapipe as mp
import numpy as np


class GazeHeadposeDetector:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            min_detection_confidence=0.2,
            min_tracking_confidence=0.2,
            refine_landmarks=True
        )

    def detect(self, frame) -> tuple[bool, str]:
        """
        Returns (is_looking_away, direction_or_description)
        """
        image = cv2.cvtColor(cv2.flip(frame, 1), cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = self.face_mesh.process(image)
        image.flags.writeable = True

        if not results.multi_face_landmarks:
            return False, "No face"

        img_h, img_w, img_c = frame.shape

        for face_landmarks in results.multi_face_landmarks:
            face_3d = []
            face_2d = []
            eye_pts = {}

            for idx, lm in enumerate(face_landmarks.landmark):
                if idx in [33, 263, 1, 61, 291, 199]:
                    if idx == 1:
                        nose_2d = (lm.x * img_w, lm.y * img_h)
                        nose_3d = (lm.x * img_w, lm.y * img_h, lm.z * 3000)

                    x, y = int(lm.x * img_w), int(lm.y * img_h)
                    face_2d.append([x, y])
                    face_3d.append([x, y, lm.z])

                if idx in [33, 133, 159, 145, 468]:
                    eye_pts[idx] = (lm.x * img_w, lm.y * img_h)

            face_2d = np.array(face_2d, dtype=np.float64)
            face_3d = np.array(face_3d, dtype=np.float64)

            focal_length = img_w
            cam_matrix = np.array([
                [focal_length, 0, img_h / 2],
                [0, focal_length, img_w / 2],
                [0, 0, 1]
            ], dtype=np.float64)

            dist_matrix = np.zeros((4, 1), dtype=np.float64)

            success, rot_vec, trans_vec = cv2.solvePnP(
                face_3d, face_2d, cam_matrix, dist_matrix
            )

            if not success:
                continue

            rmat, jac = cv2.Rodrigues(rot_vec)
            angles, mtxR, mtxQ, Qx, Qy, Qz = cv2.RQDecomp3x3(rmat)

            x = angles[0] * 360
            y = angles[1] * 360

            if y < -10:
                return True, "Looking Left"
            elif y > 10:
                return True, "Looking Right"
            elif x < -10:
                return True, "Looking Down"
            elif x > 15:
                return True, "Looking Up"
            else:
                if 468 in eye_pts and 33 in eye_pts and 133 in eye_pts:
                    l_iris_x = eye_pts[468][0]
                    l_inner_x = eye_pts[133][0]
                    l_outer_x = eye_pts[33][0]

                    if l_inner_x != l_outer_x:
                        l_ratio_x = (
                            (l_iris_x - l_outer_x) /
                            (l_inner_x - l_outer_x)
                        )

                        if l_ratio_x > 0.70:
                            return True, "Looking Right"
                        elif l_ratio_x < 0.30:
                            return True, "Looking Left"

                if 468 in eye_pts and 159 in eye_pts and 145 in eye_pts:
                    l_iris_y = eye_pts[468][1]
                    l_top_y = eye_pts[159][1]
                    l_bot_y = eye_pts[145][1]

                    if l_bot_y != l_top_y:
                        l_ratio_y = (
                            (l_iris_y - l_top_y) /
                            (l_bot_y - l_top_y)
                        )

                        if l_ratio_y > 0.75:
                            return True, "Looking Down"
                        elif l_ratio_y < 0.25:
                            return True, "Looking Up"

                return False, "Forward"

        return False, "Forward"


gaze_detector = GazeHeadposeDetector()
