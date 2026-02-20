import lumaai


def submit_luma_task(luma_key: str, concept: dict) -> dict:
    """
    Submit a Luma Dream Machine text-to-video task.
    Returns immediately with a generation ID for polling.
    """
    client = lumaai.LumaAI(auth_token=luma_key)
    try:
        generation = client.generations.video.create(
            prompt=concept["runway_prompt"],
            aspect_ratio="9:16",
            duration="5s",
            model="ray-2",
        )
        return {
            **concept,
            "task_id": generation.id,
            "video_url": None,
            "status": "pending",
            "platform": "Luma",
            "model": "ray-2",
        }
    except Exception as e:
        return {
            **concept,
            "task_id": None,
            "video_url": None,
            "status": "error",
            "error": str(e),
            "platform": "Luma",
            "model": "ray-2",
        }


def poll_luma_task(luma_key: str, generation_id: str) -> dict:
    """
    Poll a Luma generation by ID.
    Returns current status and video_url when completed.
    """
    client = lumaai.LumaAI(auth_token=luma_key)
    try:
        generation = client.generations.get(generation_id)
        state = generation.state  # "pending", "dreaming", "completed", "failed"

        if state == "completed":
            video_url = None
            if generation.assets and generation.assets.video:
                video_url = generation.assets.video
            return {"task_id": generation_id, "status": "succeeded", "video_url": video_url}

        elif state == "failed":
            reason = getattr(generation, "failure_reason", None) or "Generation failed"
            return {"task_id": generation_id, "status": "failed", "video_url": None, "error": reason}

        else:
            return {"task_id": generation_id, "status": "pending", "video_url": None}

    except Exception as e:
        return {"task_id": generation_id, "status": "error", "video_url": None, "error": str(e)}
