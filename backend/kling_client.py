import os
import fal_client

# Kling 2.6 Pro via fal.ai
# Supports 9:16, audio included, 5 or 10 seconds
FAL_MODEL = "fal-ai/kling-video/v2.6/pro/text-to-video"

# Pika 2.2 via fal.ai
PIKA_MODEL = "fal-ai/pika/v2.2/text-to-video"

# Hailuo 02 Pro via fal.ai (MiniMax)
HAILUO_MODEL = "fal-ai/minimax/hailuo-02/pro/text-to-video"


def submit_kling_task(fal_key: str, concept: dict, duration: str = "10") -> dict:
    """
    Submit a Kling 2.6 Pro text-to-video task via fal.ai.
    Returns immediately with a request_id for polling.
    duration: "5" or "10"
    """
    os.environ["FAL_KEY"] = fal_key

    try:
        handler = fal_client.submit(
            FAL_MODEL,
            arguments={
                "prompt": concept["runway_prompt"],
                "aspect_ratio": "9:16",
                "duration": duration,
            },
        )
        return {
            **concept,
            "task_id": handler.request_id,
            "video_url": None,
            "status": "pending",
            "platform": "fal.ai",
            "model": "kling-2.6-pro",
        }
    except Exception as e:
        return {
            **concept,
            "task_id": None,
            "video_url": None,
            "status": "error",
            "error": str(e),
            "platform": "fal.ai",
            "model": "kling-2.6-pro",
        }


def poll_kling_task(fal_key: str, request_id: str) -> dict:
    """
    Poll a fal.ai Kling task by request_id.
    Returns current status and video_url when done.
    """
    os.environ["FAL_KEY"] = fal_key

    try:
        status = fal_client.status(FAL_MODEL, request_id, with_logs=False)
        status_type = type(status).__name__  # Queued, InProgress, Completed

        if status_type == "Completed":
            result = fal_client.result(FAL_MODEL, request_id)
            video_url = None
            # fal returns {"video": {"url": "..."}} or {"videos": [...]}
            if isinstance(result, dict):
                if "video" in result and isinstance(result["video"], dict):
                    video_url = result["video"].get("url")
                elif "videos" in result and result["videos"]:
                    video_url = result["videos"][0].get("url")
            return {"task_id": request_id, "status": "succeeded", "video_url": video_url}

        elif status_type in ("Failed",):
            return {"task_id": request_id, "status": "failed", "video_url": None, "error": str(status)}

        else:
            # Queued or InProgress
            return {"task_id": request_id, "status": "pending", "video_url": None}

    except Exception as e:
        return {"task_id": request_id, "status": "error", "video_url": None, "error": str(e)}


def submit_pika_task(fal_key: str, concept: dict) -> dict:
    """
    Submit a Pika 2.2 text-to-video task via fal.ai.
    Returns immediately with a request_id for polling.
    """
    os.environ["FAL_KEY"] = fal_key

    try:
        handler = fal_client.submit(
            PIKA_MODEL,
            arguments={
                "prompt": concept["runway_prompt"],
                "aspect_ratio": "9:16",
            },
        )
        return {
            **concept,
            "task_id": handler.request_id,
            "video_url": None,
            "status": "pending",
            "platform": "Pika",
            "model": "pika-2.2",
        }
    except Exception as e:
        return {
            **concept,
            "task_id": None,
            "video_url": None,
            "status": "error",
            "error": str(e),
            "platform": "Pika",
            "model": "pika-2.2",
        }


def poll_pika_task(fal_key: str, request_id: str) -> dict:
    """
    Poll a fal.ai Pika task by request_id.
    Returns current status and video_url when done.
    """
    os.environ["FAL_KEY"] = fal_key

    try:
        status = fal_client.status(PIKA_MODEL, request_id, with_logs=False)
        status_type = type(status).__name__

        if status_type == "Completed":
            result = fal_client.result(PIKA_MODEL, request_id)
            video_url = None
            if isinstance(result, dict):
                if "video" in result and isinstance(result["video"], dict):
                    video_url = result["video"].get("url")
                elif "videos" in result and result["videos"]:
                    video_url = result["videos"][0].get("url")
            return {"task_id": request_id, "status": "succeeded", "video_url": video_url}

        elif status_type == "Failed":
            return {"task_id": request_id, "status": "failed", "video_url": None, "error": str(status)}

        else:
            return {"task_id": request_id, "status": "pending", "video_url": None}

    except Exception as e:
        return {"task_id": request_id, "status": "error", "video_url": None, "error": str(e)}


def submit_hailuo_task(fal_key: str, concept: dict) -> dict:
    """
    Submit a Hailuo 02 Pro text-to-video task via fal.ai (MiniMax).
    Returns immediately with a request_id for polling.
    """
    os.environ["FAL_KEY"] = fal_key

    try:
        handler = fal_client.submit(
            HAILUO_MODEL,
            arguments={
                "prompt": concept["runway_prompt"],
                "prompt_optimizer": True,
            },
        )
        return {
            **concept,
            "task_id": handler.request_id,
            "video_url": None,
            "status": "pending",
            "platform": "Hailuo",
            "model": "hailuo-02-pro",
        }
    except Exception as e:
        return {
            **concept,
            "task_id": None,
            "video_url": None,
            "status": "error",
            "error": str(e),
            "platform": "Hailuo",
            "model": "hailuo-02-pro",
        }


def poll_hailuo_task(fal_key: str, request_id: str) -> dict:
    """
    Poll a fal.ai Hailuo 02 task by request_id.
    Returns current status and video_url when done.
    """
    os.environ["FAL_KEY"] = fal_key

    try:
        status = fal_client.status(HAILUO_MODEL, request_id, with_logs=False)
        status_type = type(status).__name__

        if status_type == "Completed":
            result = fal_client.result(HAILUO_MODEL, request_id)
            video_url = None
            if isinstance(result, dict):
                if "video" in result and isinstance(result["video"], dict):
                    video_url = result["video"].get("url")
                elif "videos" in result and result["videos"]:
                    video_url = result["videos"][0].get("url")
            return {"task_id": request_id, "status": "succeeded", "video_url": video_url}

        elif status_type == "Failed":
            return {"task_id": request_id, "status": "failed", "video_url": None, "error": str(status)}

        else:
            return {"task_id": request_id, "status": "pending", "video_url": None}

    except Exception as e:
        return {"task_id": request_id, "status": "error", "video_url": None, "error": str(e)}
