import httpx

HEYGEN_BASE = "https://api.heygen.com"


def fetch_heygen_config(api_key: str) -> dict:
    """
    Fetch Avatar IV avatars and English voices from HeyGen.
    Returns {"avatars": [...], "voices": [...]}
    """
    headers = {"x-api-key": api_key, "accept": "application/json"}

    with httpx.Client(timeout=30) as client:
        # Fetch avatars
        resp = client.get(f"{HEYGEN_BASE}/v2/avatars", headers=headers)
        resp.raise_for_status()
        avatar_data = resp.json().get("data", {})
        all_avatars = avatar_data.get("avatars", [])

        # Return all avatars; tag any that are identified as Avatar IV style
        def _is_avatar_iv(a):
            style = a.get("avatar_style") or a.get("style") or a.get("type") or ""
            return "IV" in style.upper() or "4" in style

        avatars = [
            {
                "avatar_id": a.get("avatar_id"),
                "name": a.get("avatar_name") or a.get("name", ""),
                "thumbnail": a.get("preview_image_url") or a.get("preview_url"),
                "gender": a.get("gender", ""),
                "is_avatar_iv": _is_avatar_iv(a),
            }
            for a in all_avatars
        ]

        # Fetch voices
        resp = client.get(f"{HEYGEN_BASE}/v2/voices", headers=headers)
        resp.raise_for_status()
        voice_data = resp.json().get("data", {})
        all_voices = voice_data.get("voices", [])

        # Filter for English voices
        voices = [
            {
                "voice_id": v.get("voice_id"),
                "name": v.get("name", ""),
                "language": v.get("language", ""),
                "gender": v.get("gender", ""),
            }
            for v in all_voices
            if (v.get("language") or "").lower().startswith("en")
        ]

    return {"avatars": avatars, "voices": voices}


def submit_heygen_task(
    api_key: str,
    concept: dict,
    avatar_id: str,
    voice_id: str,
) -> dict:
    """
    Submit a HeyGen Avatar IV video generation task.
    Builds a spoken script from hook + script_outline and submits to HeyGen.
    Returns video card dict with task_id for polling.
    """
    # Build spoken script from hook + script outline actions
    # Cap at 65 words ≈ 30 seconds of speech at normal TTS pace (~130 wpm)
    script_parts = []
    hook = concept.get("hook", "")
    if hook:
        script_parts.append(hook)
    for step in concept.get("script_outline", []):
        action = step.get("action", "")
        if action:
            script_parts.append(action)
    words = " ".join(script_parts).split()
    if len(words) > 65:
        words = words[:65]
    spoken_script = " ".join(words)

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
        "accept": "application/json",
    }

    payload = {
        "video_inputs": [
            {
                "character": {
                    "type": "avatar",
                    "avatar_id": avatar_id,
                    "avatar_style": "normal",
                },
                "voice": {
                    "type": "text",
                    "input_text": spoken_script,
                    "voice_id": voice_id,
                },
                "background": {
                    "type": "color",
                    "value": "#00FF00",  # Green screen for Shotstack chroma key
                },
            }
        ],
        "dimension": {"width": 720, "height": 1280},
    }

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{HEYGEN_BASE}/v2/video/generate",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})
            video_id = data.get("video_id")

        return {
            **concept,
            "task_id": video_id,
            "video_url": None,
            "status": "pending",
            "platform": "HeyGen",
            "model": "Avatar IV",
            "spoken_script": spoken_script,
        }
    except Exception as e:
        return {
            **concept,
            "task_id": None,
            "video_url": None,
            "status": "error",
            "error": str(e),
            "platform": "HeyGen",
            "model": "Avatar IV",
        }


def poll_heygen_task(api_key: str, video_id: str) -> dict:
    """
    Poll a HeyGen video generation task by video_id.
    HeyGen statuses: pending, processing, completed, waiting, failed
    """
    headers = {"x-api-key": api_key, "accept": "application/json"}

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{HEYGEN_BASE}/v1/video_status.get",
                headers=headers,
                params={"video_id": video_id},
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})

        status = data.get("status", "pending")

        if status == "completed":
            return {
                "task_id": video_id,
                "status": "succeeded",
                "video_url": data.get("video_url"),
            }
        elif status == "failed":
            raw_err = data.get("error") or "Generation failed"
            # HeyGen may return error as dict — extract message or stringify
            if isinstance(raw_err, dict):
                err_str = raw_err.get("message") or raw_err.get("msg") or str(raw_err)
            else:
                err_str = str(raw_err)
            return {
                "task_id": video_id,
                "status": "failed",
                "video_url": None,
                "error": err_str,
            }
        else:
            # pending, processing, waiting
            return {"task_id": video_id, "status": "pending", "video_url": None}

    except Exception as e:
        return {"task_id": video_id, "status": "error", "video_url": None, "error": str(e)}
