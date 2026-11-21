// GENERATED FILE, DO NOT EDIT.
// Source: credflare sdk-spec 1.0.0 (ef15c85fc748). Regenerate with scripts/generate.mjs.
/* eslint-disable */

export const specVersion = "1.0.0" as const;
export const specHash = "ef15c85fc748" as const;

export const liveness = {
  "version": 1,
  "challenge_ttl_s": 120,
  "gesture_timeout_ms": 10000,
  "sample_interval_ms": 66,
  "video": {
    "max_seconds": 8,
    "max_height": 480
  },
  "position": {
    "face_area_min": 0.15,
    "face_area_max": 0.65,
    "center_tolerance": 0.2,
    "faces": 1
  },
  "face_lost_reset_ms": 1000,
  "thresholds": {
    "default": {
      "eye_open_baseline": 0.6,
      "eye_closed": 0.3,
      "eye_reopened": 0.5,
      "smile": 0.6,
      "smile_hold_frames": 5,
      "turn": 20,
      "nod": 15,
      "return": 10
    },
    "mediapipe": {
      "smile": 0.4
    },
    "mlkit": {
      "smile": 0.7
    },
    "vision": {}
  },
  "gestures": {
    "blink": [
      {
        "signal": "eye_open",
        "op": "gt",
        "value": "eye_open_baseline"
      },
      {
        "signal": "eye_open",
        "op": "lt",
        "value": "eye_closed"
      },
      {
        "signal": "eye_open",
        "op": "gt",
        "value": "eye_reopened"
      }
    ],
    "smile": [
      {
        "signal": "smile",
        "op": "gt",
        "value": "smile",
        "hold_frames": "smile_hold_frames"
      }
    ],
    "turn_left": [
      {
        "signal": "yaw",
        "op": "gt",
        "value": "turn"
      },
      {
        "signal": "yaw",
        "op": "abs_lt",
        "value": "return"
      }
    ],
    "turn_right": [
      {
        "signal": "yaw",
        "op": "lt_neg",
        "value": "turn"
      },
      {
        "signal": "yaw",
        "op": "abs_lt",
        "value": "return"
      }
    ],
    "nod": [
      {
        "signal": "pitch",
        "op": "lt_neg",
        "value": "nod"
      },
      {
        "signal": "pitch",
        "op": "abs_lt",
        "value": "return"
      }
    ]
  }
} as const;

export const location = {
  "version": 1,
  "clock_skew_s": 30,
  "fix_timeout_s": 30,
  "retry_attempts": 3
} as const;

export const settings = {
  "version": 1,
  "facial_verification": {
    "gestures": {
      "type": "set",
      "of": [
        "blink",
        "smile",
        "turn_left",
        "turn_right",
        "nod"
      ],
      "min": 1,
      "default": [
        "blink",
        "smile",
        "turn_left",
        "turn_right",
        "nod"
      ]
    },
    "gesture_count": {
      "type": "int",
      "min": 1,
      "max": 5,
      "default": 3
    },
    "record_video": {
      "type": "bool",
      "default": true
    },
    "video_retention_days": {
      "type": "int",
      "min": 1,
      "max": 365,
      "default": 30
    }
  },
  "location_verification": {
    "max_accuracy_m": {
      "type": "int",
      "min": 5,
      "max": 5000,
      "default": 100
    },
    "max_age_s": {
      "type": "int",
      "min": 5,
      "max": 3600,
      "default": 60
    },
    "mock_location": {
      "type": "enum",
      "of": [
        "reject",
        "flag",
        "allow"
      ],
      "default": "reject"
    },
    "ip_country": {
      "type": "enum",
      "of": [
        "reject",
        "flag",
        "off"
      ],
      "default": "flag"
    },
    "reference": {
      "type": "object",
      "optional": true,
      "default": null,
      "fields": {
        "places": {
          "type": "list",
          "min": 1,
          "max": 50,
          "item": {
            "id": {
              "type": "string",
              "max": 64
            },
            "label": {
              "type": "string",
              "max": 120
            },
            "latitude": {
              "type": "number",
              "min": -90,
              "max": 90
            },
            "longitude": {
              "type": "number",
              "min": -180,
              "max": 180
            },
            "radius_m": {
              "type": "int",
              "min": 0,
              "max": 100000
            }
          }
        },
        "rule": {
          "type": "enum",
          "of": [
            "within",
            "outside"
          ],
          "default": "within"
        },
        "match": {
          "type": "enum",
          "of": [
            "any",
            "all"
          ],
          "default": "any"
        },
        "confidence": {
          "type": "enum",
          "of": [
            "strict",
            "lenient"
          ],
          "default": "strict"
        },
        "on_mismatch": {
          "type": "enum",
          "of": [
            "reject",
            "flag"
          ],
          "default": "reject"
        }
      }
    }
  }
} as const;

export const copy = {
  "en": {
    "common.back": "Back",
    "common.cancel": "Cancel",
    "common.change": "Change",
    "common.close": "Close",
    "common.continue": "Continue",
    "common.done": "Done",
    "common.loading": "Getting ready…",
    "common.return_to_app": "Return to app",
    "common.secured_by": "Secured by Credflare",
    "common.start": "Start",
    "common.step_progress": "Step {current} of {total}",
    "common.test_mode": "Test mode",
    "common.try_again": "Try again",
    "common.verifier_fallback": "your verifier",
    "intro.title": "Verify your identity",
    "intro.body": "Follow the steps requested by {verifier}. Review each item before you send it.",
    "intro.start": "Start",
    "intro.checking": "Checking what is still needed…",
    "exit.title": "Leave for now?",
    "exit.body": "Evidence you already sent is kept. Unsent photos and files will be discarded. You can come back through the app that sent you here.",
    "exit.stay": "Keep going",
    "exit.leave": "Leave for now",
    "exit.discard_title": "Discard these photos and files?",
    "exit.discard_body": "You have not sent this document yet.",
    "exit.discard_stay": "Keep editing",
    "exit.discard_leave": "Discard",
    "documents.title": "Documents requested",
    "documents.requested_by": "Requested by {verifier}.",
    "documents.back": "Documents",
    "documents.section_required": "Required",
    "documents.section_one_of": "Provide one of these",
    "documents.section_count_of": "Provide {count} of these",
    "documents.method_camera": "Camera photos",
    "documents.method_upload": "Saved files",
    "documents.method_either": "Photo or file",
    "documents.method_both": "Photo and saved file",
    "documents.unavailable": "Not available in this app. Contact {verifier}.",
    "documents.selfie_next": "After your documents, you will take a selfie.",
    "documents.location_next": "After your documents, you will share your location.",
    "documents.selfie_location_next": "After your documents, you will take a selfie and share your location.",
    "documents.location_selfie_next": "After your documents, you will share your location and take a selfie.",
    "documents.host_steps_next": "After your documents, the app will guide you through the remaining steps.",
    "capture.side_front": "Front",
    "capture.side_back": "Back",
    "capture.source_camera": "Camera photo",
    "capture.source_upload": "Saved file",
    "capture.instruction_camera": "Place the {document} on a flat surface. Keep all four corners visible and avoid glare.",
    "capture.instruction_either": "Take a photo or choose a saved file of the {side}.",
    "capture.instruction_upload": "Choose a clear photo or scan of the {side}.",
    "capture.instruction_upload_pdf": "Choose a clear photo, scan or PDF of the {side}.",
    "capture.also_saved_file": "You also need to add a saved file of each side.",
    "capture.check_photo": "Check that all four corners are visible, the text is sharp and there is no glare.",
    "capture.take_photo": "Take photo",
    "capture.choose_file": "Choose a file",
    "capture.retake_photo": "Retake photo",
    "capture.change_file": "Change file",
    "capture.use_file_instead": "Use a file instead",
    "capture.use_photo_instead": "Take a photo instead",
    "capture.file_limits": "{types}, up to {size}",
    "capture.preview_pdf": "PDF",
    "capture.preview_document": "Document",
    "capture.preview_label": "Preview of the {side}",
    "review.title": "Review before sending",
    "review.body": "Check each photo and file before you send them.",
    "review.item": "{side} · {source}",
    "review.change": "Change",
    "review.send": "Send document",
    "sending.uploading": "Uploading…",
    "sending.uploading_progress": "Uploading {current} of {total}…",
    "sending.sending": "Sending…",
    "sending.sent_title": "Your evidence was sent",
    "sending.sent_body": "We are checking that everything arrived.",
    "sending.check_again": "Check again",
    "receipt.title": "Evidence received",
    "receipt.body": "Your evidence will be reviewed by {verifier}. You can close this screen.",
    "receipt.document": "{document} received",
    "receipt.selfie": "Selfie received",
    "receipt.location": "Location received",
    "receipt.host_steps": "The app will guide you through the remaining steps.",
    "receipt.done": "Done",
    "selfie.title": "Take a selfie",
    "selfie.guidance": "Face the camera in even light. Keep your whole face visible and remove anything covering it.",
    "selfie.tip_face_camera": "Face the camera directly.",
    "selfie.tip_light": "Find even light on your face.",
    "selfie.tip_neutral": "Keep a neutral expression.",
    "selfie.tip_glasses": "Take off glasses if you can.",
    "selfie.open_camera": "Open front camera",
    "selfie.starting_camera": "Starting the camera…",
    "selfie.take": "Take selfie",
    "selfie.review_title": "Review your selfie",
    "selfie.review_body": "Make sure your face is clear and fully visible before you send it.",
    "selfie.retake": "Retake selfie",
    "selfie.send": "Send selfie",
    "selfie.sending": "Sending your selfie…",
    "selfie.preview_label": "Your selfie preview",
    "selfie.privacy": "Your selfie will be sent to {verifier} for review.",
    "liveness.title": "Follow the prompts",
    "liveness.body": "You will be asked to make {total} simple movements. Keep your face inside the frame.",
    "liveness.start": "Start",
    "liveness.progress": "Movement {current} of {total}",
    "liveness.position.no_face": "Look at the camera",
    "liveness.position.move_closer": "Move closer",
    "liveness.position.move_further": "Move back a little",
    "liveness.position.center": "Center your face in the frame",
    "liveness.position.one_face": "Make sure only your face is in the frame",
    "liveness.position.hold_still": "Hold still",
    "liveness.position.more_light": "Move to a brighter place",
    "liveness.position.ready": "Good. Hold still",
    "liveness.gesture.blink": "Blink",
    "liveness.gesture.smile": "Smile",
    "liveness.gesture.turn_left": "Slowly turn your head to your left, then back",
    "liveness.gesture.turn_right": "Slowly turn your head to your right, then back",
    "liveness.gesture.nod": "Nod: look down, then back up",
    "liveness.gesture_done": "Done",
    "liveness.face_lost": "We lost sight of your face. Look at the camera.",
    "liveness.success": "All movements recorded",
    "liveness.timeout": "Time ran out for this movement.",
    "liveness.expired": "This step timed out. Start it again.",
    "liveness.retry": "Try again",
    "liveness.sending": "Sending your recording…",
    "video.consent": "This step records a short video of your face. It is sent to {verifier} for review.",
    "video.recording": "Recording",
    "location.title": "Share your location",
    "location.why": "{verifier} asks where you are right now. Your location is used only for this request.",
    "location.what_shared": "We send your coordinates, how accurate they are and when they were taken.",
    "location.permission_prompt": "Your device will ask for permission. Choose Allow.",
    "location.share": "Share location",
    "location.waiting": "Finding your location…",
    "location.waiting_accuracy": "Getting a more accurate reading. Stay where you are, near a window or outside if you can.",
    "location.found_title": "Location found",
    "location.found_body": "Check it looks right, then send it.",
    "location.accuracy_label": "Accuracy",
    "location.accuracy_value": "Within {meters} m",
    "location.coordinates_label": "Coordinates",
    "location.time_label": "Taken at",
    "location.send": "Send location",
    "location.permission_denied": "Location access is off. Turn it on in Settings, then try again.",
    "location.permission_denied_browser": "Location access is blocked. Allow it for this site in your browser settings, then reload the page.",
    "location.unavailable": "Location is not available on this device.",
    "location.timeout": "We could not find your location in time. Try again.",
    "location.low_accuracy": "Your location is not accurate enough yet. Move near a window or outside, then try again.",
    "location.mock_detected": "An app or setting is changing your device location. Turn it off, then try again.",
    "location.stale": "Your location reading is out of date. Try again to take a new one.",
    "location.ip_country_mismatch": "Your internet connection seems to be in a different country from your location. Turn off any VPN or proxy, then try again.",
    "location.retry": "Try again",
    "location.retries_exhausted": "We could not get your location. Contact {verifier}.",
    "location.place.title_within": "Share your location at {place}",
    "location.place.title_outside": "Share your location away from {place}",
    "location.place.need_within": "You need to be at {place}.",
    "location.place.need_within_any": "You need to be at one of these places: {places}.",
    "location.place.need_within_all": "You need to be at each of these places: {places}.",
    "location.place.need_outside": "You need to be away from {place}.",
    "location.place.need_outside_all": "You need to be away from these places: {places}.",
    "location.place.need_outside_any": "You need to be away from at least one of these places: {places}.",
    "location.place.not_matched_within": "You do not seem to be at {place} yet. Move closer, then try again.",
    "location.place.not_matched_outside": "You seem to be too close to {place}. Move away, then try again.",
    "location.place.not_precise": "Your location is not precise enough to check this place. Move near a window or outside, then try again.",
    "location.place.rejected": "Your location does not match the place requested by {verifier}. Try again from the right place.",
    "location.place.retry": "Try again",
    "errors.generic": "Something went wrong. Try again.",
    "errors.network": "Could not connect. Check your connection and try again.",
    "errors.session_expired": "Your session has expired. Close this screen and start again.",
    "errors.start_failed": "We could not start. Check your connection and try again.",
    "errors.refresh_failed": "We could not check what is still needed. Try again.",
    "errors.camera_denied": "Camera access is off. Turn it on in Settings, then try again.",
    "errors.camera_denied_browser": "Camera access is blocked. Allow it in your browser settings, then try again.",
    "errors.camera_unavailable": "The camera is unavailable. Try again on a device with a camera.",
    "errors.front_camera_required": "This step needs a front camera. Try another device.",
    "errors.camera_no_photo": "The camera did not return a readable photo. Try again.",
    "errors.file_unreadable": "This file could not be read. Choose another file.",
    "errors.file_type": "Choose a {types} file.",
    "errors.file_too_large": "This file is larger than {size}. Choose a smaller file.",
    "errors.file_empty": "This file is empty. Choose another file.",
    "errors.photo_format": "This photo format is not accepted by {verifier}.",
    "errors.photo_invalid": "This photo is empty or too large. Retake it.",
    "errors.document_unsupported": "This document cannot be collected in this app. Contact {verifier}.",
    "errors.add_file_failed": "Could not add this file. Try again.",
    "errors.send_document_failed": "Could not send this document. Check your connection and try again.",
    "errors.selfie_failed": "Could not take your selfie. Try again.",
    "errors.send_selfie_failed": "Could not send your selfie. Check your connection and try again.",
    "errors.challenge_failed": "We could not start this step. Check your connection and try again.",
    "errors.send_location_failed": "Could not send your location. Check your connection and try again."
  }
} as const;

export const copyPlaceholders = {
  "verifier": "Name of the organisation that asked for the evidence. Use common.verifier_fallback when it is unknown.",
  "document": "Document type name, for example Passport.",
  "side": "capture.side_front or capture.side_back, lower cased inside a sentence.",
  "source": "capture.source_camera or capture.source_upload.",
  "current": "1 based position.",
  "total": "Total count.",
  "count": "How many items to provide.",
  "types": "Allowed file types, upper cased and joined with a comma and a space.",
  "size": "Maximum file size, formatted as megabytes, for example 10 MB.",
  "meters": "Accuracy radius in whole meters.",
  "place": "Label of a reference place, for example Head office. Never coordinates.",
  "places": "Labels of several reference places, joined with a comma and a space."
} as const;

export const errorCodes = {
  "location.accuracy": "Accuracy is missing or larger than max_accuracy_m",
  "location.stale": "fix_time is missing, older than max_age_s plus clock_skew_s, or in the future",
  "location.mock": "is_mock is true and mock_location is reject",
  "location.ip_country": "The IP country does not match and ip_country is reject",
  "location.reference_not_matched": "The place rule failed and on_mismatch is reject",
  "liveness.challenge_invalid": "The challenge is unknown, belongs to another case or was replaced",
  "liveness.challenge_expired": "The challenge expired",
  "liveness.challenge_used": "The challenge was already used",
  "liveness.gesture_mismatch": "A gesture frame is missing, extra, out of order or for a gesture the challenge does not include",
  "liveness.frame_out_of_window": "A file was uploaded before the challenge was issued or after it expired",
  "liveness.not_camera": "Evidence was not uploaded with capture_source=camera for this challenge",
  "liveness.video_missing": "record_video is on and no video for this challenge was sent",
  "liveness.video_too_long": "The video is longer than max_video_seconds plus one second",
  "liveness.video_unreadable": "The server cannot read the video duration"
} as const;

export const tokens = {
  "version": 1,
  "color": {
    "light": {
      "primary": "#20315F",
      "on_primary": "#FFFFFF",
      "surface": "#FFFFFF",
      "ink": "#18233C",
      "muted": "#52617A",
      "soft": "#F0F3FA",
      "border": "#CAD4E5",
      "accent": "#DC6E11",
      "success": "#126749",
      "error": "#AA2525",
      "warning_soft": "#FDF1E6",
      "warning_ink": "#7A3B06"
    },
    "dark": {
      "primary": "#B9CDFF",
      "on_primary": "#16294E",
      "surface": "#111C31",
      "ink": "#F4F7FE",
      "muted": "#B7C4DA",
      "soft": "#1A2942",
      "border": "#566983",
      "accent": "#FFB579",
      "success": "#8FE0B8",
      "error": "#FFB4AB",
      "warning_soft": "#3A2A1A",
      "warning_ink": "#FFD3AE"
    }
  },
  "font": {
    "family": "Ubuntu",
    "weights": {
      "regular": 400,
      "medium": 500,
      "bold": 700
    }
  },
  "type": {
    "title": {
      "size": 24,
      "line_height": 30,
      "weight": 700
    },
    "subtitle": {
      "size": 17,
      "line_height": 24,
      "weight": 500
    },
    "body": {
      "size": 16,
      "line_height": 24,
      "weight": 400
    },
    "button": {
      "size": 16,
      "line_height": 22,
      "weight": 500
    },
    "label": {
      "size": 14,
      "line_height": 20,
      "weight": 500
    },
    "small": {
      "size": 13,
      "line_height": 19,
      "weight": 400
    },
    "eyebrow": {
      "size": 13,
      "line_height": 18,
      "weight": 500
    },
    "chip": {
      "size": 12,
      "line_height": 16,
      "weight": 500
    }
  },
  "text_align": "center",
  "spacing": {
    "xxs": 2,
    "xs": 4,
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 24,
    "xxl": 32,
    "gutter": 24,
    "gap": 16,
    "section": 10
  },
  "radius": {
    "xs": 3,
    "sm": 6,
    "md": 10,
    "lg": 14,
    "xl": 16,
    "sheet": 24,
    "pill": 999
  },
  "size": {
    "button_height": 56,
    "link_height": 48,
    "option_height": 72,
    "header_height": 56,
    "max_content_width": 600,
    "mark": 30,
    "icon": 24,
    "illustration": 64,
    "icon_stroke": 1.75
  }
} as const;

export interface SpecIconPath {
  readonly d: string;
  readonly stroke: boolean;
  readonly fill: boolean;
  readonly strokeWidth: number;
  readonly strokeOpacity: number;
  readonly fillOpacity: number;
}

export interface SpecIcon {
  readonly viewBox: number;
  readonly strokeWidth: number;
  readonly paths: readonly SpecIconPath[];
}

export const icons = {
  "camera": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 4 8.5 C 4 7.395 4.895 6.5 6 6.5 L 7.6 6.5 C 7.915 6.5 8.211 6.352 8.4 6.1 L 9.6 4.4 C 9.789 4.148 10.085 4 10.4 4 L 13.6 4 C 13.915 4 14.211 4.148 14.4 4.4 L 15.6 6.1 C 15.789 6.352 16.085 6.5 16.4 6.5 L 18 6.5 C 19.105 6.5 20 7.395 20 8.5 L 20 17.5 C 20 18.605 19.105 19.5 18 19.5 L 6 19.5 C 4.895 19.5 4 18.605 4 17.5 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 15.25 12.75 C 15.25 14.545 13.795 16 12 16 C 10.205 16 8.75 14.545 8.75 12.75 C 8.75 10.955 10.205 9.5 12 9.5 C 13.795 9.5 15.25 10.955 15.25 12.75 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "chevron_left": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 14.5 6 L 8.5 12 L 14.5 18",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "chevron_right": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 9.5 6 L 15.5 12 L 9.5 18",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "document": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 14 3 L 7 3 C 5.895 3 5 3.895 5 5 L 5 19 C 5 20.105 5.895 21 7 21 L 17 21 C 18.105 21 19 20.105 19 19 L 19 8 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 14 3 L 14 7 C 14 7.552 14.448 8 15 8 L 19 8",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 9 13 L 15 13",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 9 17 L 13 17",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "error": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 21 12 C 21 16.971 16.971 21 12 21 C 7.029 21 3 16.971 3 12 C 3 7.029 7.029 3 12 3 C 16.971 3 21 7.029 21 12 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 12 7.75 L 12 12.75",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 12 16.25 L 12 16.26",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "id_card": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 5 5 L 19 5 C 20.105 5 21 5.895 21 7 L 21 17 C 21 18.105 20.105 19 19 19 L 5 19 C 3.895 19 3 18.105 3 17 L 3 7 C 3 5.895 3.895 5 5 5 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 10.25 10 C 10.25 10.966 9.466 11.75 8.5 11.75 C 7.534 11.75 6.75 10.966 6.75 10 C 6.75 9.034 7.534 8.25 8.5 8.25 C 9.466 8.25 10.25 9.034 10.25 10 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 5.75 15.5 C 6.25 14.1 7.25 13.25 8.5 13.25 C 9.75 13.25 10.75 14.1 11.25 15.5",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 14 10 L 18 10",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 14 14 L 16.5 14",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "location": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 12 21.25 C 12 21.25 5.5 15.6 5.5 10 C 5.5 6.41 8.41 3.5 12 3.5 C 15.59 3.5 18.5 6.41 18.5 10 C 18.5 15.6 12 21.25 12 21.25 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 14.25 10 C 14.25 11.243 13.243 12.25 12 12.25 C 10.757 12.25 9.75 11.243 9.75 10 C 9.75 8.757 10.757 7.75 12 7.75 C 13.243 7.75 14.25 8.757 14.25 10 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "received": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 14 3 L 7 3 C 5.895 3 5 3.895 5 5 L 5 19 C 5 20.105 5.895 21 7 21 L 17 21 C 18.105 21 19 20.105 19 19 L 19 8 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 14 3 L 14 7 C 14 7.552 14.448 8 15 8 L 19 8",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 9 14.75 L 11.25 17 L 15.25 12.5",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "received_illustration": {
    "viewBox": 64,
    "strokeWidth": 2.5,
    "paths": [
      {
        "d": "M 62 32 C 62 48.569 48.569 62 32 62 C 15.431 62 2 48.569 2 32 C 2 15.431 15.431 2 32 2 C 48.569 2 62 15.431 62 32 Z",
        "stroke": false,
        "fill": true,
        "strokeWidth": 2.5,
        "strokeOpacity": 1,
        "fillOpacity": 0.08
      },
      {
        "d": "M 36 12 L 23 12 C 20.791 12 19 13.791 19 16 L 19 48 C 19 50.209 20.791 52 23 52 L 41 52 C 43.209 52 45 50.209 45 48 L 45 21 Z",
        "stroke": true,
        "fill": true,
        "strokeWidth": 2.5,
        "strokeOpacity": 1,
        "fillOpacity": 0.16
      },
      {
        "d": "M 36 12 L 36 18 C 36 19.657 37.343 21 39 21 L 45 21",
        "stroke": true,
        "fill": false,
        "strokeWidth": 2.5,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 25 24 L 31 24",
        "stroke": true,
        "fill": false,
        "strokeWidth": 2.5,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 25 30 L 39 30",
        "stroke": true,
        "fill": false,
        "strokeWidth": 2.5,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 25.5 39.5 L 30 44 L 38.5 34.5",
        "stroke": true,
        "fill": false,
        "strokeWidth": 3,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "selfie": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 4 8 L 4 6 C 4 4.895 4.895 4 6 4 L 8 4",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 16 4 L 18 4 C 19.105 4 20 4.895 20 6 L 20 8",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 20 16 L 20 18 C 20 19.105 19.105 20 18 20 L 16 20",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 8 20 L 6 20 C 4.895 20 4 19.105 4 18 L 4 16",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 15 10 C 15 11.657 13.657 13 12 13 C 10.343 13 9 11.657 9 10 C 9 8.343 10.343 7 12 7 C 13.657 7 15 8.343 15 10 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 7.5 17.5 C 8.4 15.6 10.1 14.5 12 14.5 C 13.9 14.5 15.6 15.6 16.5 17.5",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "upload": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 12 15 L 12 4",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 7.5 8.5 L 12 4 L 16.5 8.5",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 4 15 L 4 18 C 4 19.105 4.895 20 6 20 L 18 20 C 19.105 20 20 19.105 20 18 L 20 15",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  },
  "video": {
    "viewBox": 24,
    "strokeWidth": 1.75,
    "paths": [
      {
        "d": "M 3 7.5 C 3 6.395 3.895 5.5 5 5.5 L 13 5.5 C 14.105 5.5 15 6.395 15 7.5 L 15 16.5 C 15 17.605 14.105 18.5 13 18.5 L 5 18.5 C 3.895 18.5 3 17.605 3 16.5 Z",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      },
      {
        "d": "M 15 10.5 L 20.2 7.6 C 20.352 7.486 20.554 7.468 20.724 7.553 C 20.893 7.637 21 7.811 21 8 L 21 16 C 21 16.189 20.893 16.363 20.724 16.447 C 20.554 16.532 20.352 16.514 20.2 16.4 L 15 13.5",
        "stroke": true,
        "fill": false,
        "strokeWidth": 1.75,
        "strokeOpacity": 1,
        "fillOpacity": 1
      }
    ]
  }
} as const satisfies Record<string, SpecIcon>;

export const iconSvgs: Record<IconName, string> = {
  "camera": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 8.5 A2 2 0 0 1 6 6.5 H7.6 A1 1 0 0 0 8.4 6.1 L9.6 4.4 A1 1 0 0 1 10.4 4 H13.6 A1 1 0 0 1 14.4 4.4 L15.6 6.1 A1 1 0 0 0 16.4 6.5 H18 A2 2 0 0 1 20 8.5 V17.5 A2 2 0 0 1 18 19.5 H6 A2 2 0 0 1 4 17.5 Z\"/><path d=\"M15.25 12.75 A3.25 3.25 0 1 1 8.75 12.75 A3.25 3.25 0 1 1 15.25 12.75 Z\"/></svg>",
  "chevron_left": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14.5 6 L8.5 12 L14.5 18\"/></svg>",
  "chevron_right": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.5 6 L15.5 12 L9.5 18\"/></svg>",
  "document": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3 H7 A2 2 0 0 0 5 5 V19 A2 2 0 0 0 7 21 H17 A2 2 0 0 0 19 19 V8 Z\"/><path d=\"M14 3 V7 A1 1 0 0 0 15 8 H19\"/><path d=\"M9 13 H15\"/><path d=\"M9 17 H13\"/></svg>",
  "error": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12 A9 9 0 1 1 3 12 A9 9 0 1 1 21 12 Z\"/><path d=\"M12 7.75 V12.75\"/><path d=\"M12 16.25 V16.26\"/></svg>",
  "id_card": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 5 H19 A2 2 0 0 1 21 7 V17 A2 2 0 0 1 19 19 H5 A2 2 0 0 1 3 17 V7 A2 2 0 0 1 5 5 Z\"/><path d=\"M10.25 10 A1.75 1.75 0 1 1 6.75 10 A1.75 1.75 0 1 1 10.25 10 Z\"/><path d=\"M5.75 15.5 C6.25 14.1 7.25 13.25 8.5 13.25 C9.75 13.25 10.75 14.1 11.25 15.5\"/><path d=\"M14 10 H18\"/><path d=\"M14 14 H16.5\"/></svg>",
  "location": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 21.25 C12 21.25 5.5 15.6 5.5 10 A6.5 6.5 0 0 1 18.5 10 C18.5 15.6 12 21.25 12 21.25 Z\"/><path d=\"M14.25 10 A2.25 2.25 0 1 1 9.75 10 A2.25 2.25 0 1 1 14.25 10 Z\"/></svg>",
  "received": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3 H7 A2 2 0 0 0 5 5 V19 A2 2 0 0 0 7 21 H17 A2 2 0 0 0 19 19 V8 Z\"/><path d=\"M14 3 V7 A1 1 0 0 0 15 8 H19\"/><path d=\"M9 14.75 L11.25 17 L15.25 12.5\"/></svg>",
  "received_illustration": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M62 32 A30 30 0 1 1 2 32 A30 30 0 1 1 62 32 Z\" fill=\"currentColor\" fill-opacity=\"0.08\" stroke=\"none\"/><path d=\"M36 12 H23 A4 4 0 0 0 19 16 V48 A4 4 0 0 0 23 52 H41 A4 4 0 0 0 45 48 V21 Z\" fill=\"currentColor\" fill-opacity=\"0.16\"/><path d=\"M36 12 V18 A3 3 0 0 0 39 21 H45\"/><path d=\"M25 24 H31\"/><path d=\"M25 30 H39\"/><path d=\"M25.5 39.5 L30 44 L38.5 34.5\" stroke-width=\"3\"/></svg>",
  "selfie": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 8 V6 A2 2 0 0 1 6 4 H8\"/><path d=\"M16 4 H18 A2 2 0 0 1 20 6 V8\"/><path d=\"M20 16 V18 A2 2 0 0 1 18 20 H16\"/><path d=\"M8 20 H6 A2 2 0 0 1 4 18 V16\"/><path d=\"M15 10 A3 3 0 1 1 9 10 A3 3 0 1 1 15 10 Z\"/><path d=\"M7.5 17.5 C8.4 15.6 10.1 14.5 12 14.5 C13.9 14.5 15.6 15.6 16.5 17.5\"/></svg>",
  "upload": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15 V4\"/><path d=\"M7.5 8.5 L12 4 L16.5 8.5\"/><path d=\"M4 15 V18 A2 2 0 0 0 6 20 H18 A2 2 0 0 0 20 18 V15\"/></svg>",
  "video": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 7.5 A2 2 0 0 1 5 5.5 H13 A2 2 0 0 1 15 7.5 V16.5 A2 2 0 0 1 13 18.5 H5 A2 2 0 0 1 3 16.5 Z\"/><path d=\"M15 10.5 L20.2 7.6 A0.5 0.5 0 0 1 21 8 V16 A0.5 0.5 0 0 1 20.2 16.4 L15 13.5\"/></svg>"
};

export type IconName = keyof typeof icons;
export type Locale = keyof typeof copy;
export type CopyKey = keyof (typeof copy)["en"];
export type ErrorCode = keyof typeof errorCodes;
export type GestureName = keyof (typeof liveness)["gestures"];
export type LivenessProvider = keyof (typeof liveness)["thresholds"];
export type ThresholdKey = keyof (typeof liveness)["thresholds"]["default"];
