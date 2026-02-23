import httpx

SHOTSTACK_BASE = "https://api.shotstack.io/edit/stage"  # sandbox tier

MUSIC_TRACKS = {
    "hype": {
        "name": "🔥 Hype",
        "url": "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/lit.mp3",
    },
    "chill": {
        "name": "❄️ Chill",
        "url": "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/palmtrees.mp3",
    },
    "motivational": {
        "name": "💪 Motivational",
        "url": "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/sugar.mp3",
    },
    "corporate": {
        "name": "💼 Corporate",
        "url": "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/dreams.mp3",
    },
    "dramatic": {
        "name": "🎬 Dramatic",
        "url": "https://shotstack-assets.s3-ap-southeast-2.amazonaws.com/music/unminus/ambition.mp3",
    },
}


def get_music_tracks():
    """Return list of available music tracks for the frontend."""
    return [{"id": k, "name": v["name"]} for k, v in MUSIC_TRACKS.items()]


def _build_caption_clips(script: str, duration: float, words_per_chunk: int = 4) -> list:
    """
    Split the spoken script into evenly-timed subtitle caption clips.
    Each chunk of ~words_per_chunk words gets an equal slice of the total duration,
    with fade-in / fade-out transitions between chunks.
    """
    words = script.strip().split()
    if not words:
        return []
    chunks = [
        " ".join(words[i:i + words_per_chunk])
        for i in range(0, len(words), words_per_chunk)
    ]
    chunk_dur = round(duration / len(chunks), 2)
    clips = []
    for idx, chunk in enumerate(chunks):
        clips.append({
            "asset": {
                "type": "html",
                "html": (
                    f'<p style="font-family:\'Open Sans\',sans-serif;'
                    f'color:#ffffff;font-size:40px;font-weight:800;'
                    f'text-shadow:2px 2px 8px rgba(0,0,0,1),'
                    f'-1px -1px 0 #000,1px -1px 0 #000,'
                    f'-1px 1px 0 #000,1px 1px 0 #000;'
                    f'text-align:center;margin:0;padding:6px 14px;'
                    f'line-height:1.2;">{chunk}</p>'
                ),
                "width": 640,
                "height": 130,
                "background": "transparent",
            },
            "start": round(idx * chunk_dur, 2),
            "length": chunk_dur,
            "position": "bottom",
            "offset": {"x": 0, "y": 0.08},
            "transition": {"in": "fade", "out": "fade"},
        })
    return clips


def submit_composite(
    api_key: str,
    heygen_video_url: str,
    background_video_url: str,
    hook_text: str,
    music_track_id: str = "hype",
    duration: float = 10.0,
    spoken_script: str = None,
) -> dict:
    """
    Submit a Shotstack render job to composite:
      - Background video (looped via multiple clips, muted)
      - HeyGen avatar video (chroma-keyed green screen, full audio)
      - Hook text caption (bottom third, first 3.5 seconds, fades out)
      - Background music (low volume, full duration)
    Output: 720x1280 (9:16) MP4
    """
    music_url = MUSIC_TRACKS.get(music_track_id, MUSIC_TRACKS["hype"])["url"]

    # Build background clips — loop 10-sec clip to fill the full duration
    bg_duration = 10.0  # Runway/Kling clips are 10 seconds
    bg_clips = []
    t = 0.0
    while t < duration:
        clip_len = min(bg_duration, duration - t)
        bg_clips.append({
            "asset": {
                "type": "video",
                "src": background_video_url,
                "volume": 0,
            },
            "start": round(t, 2),
            "length": round(clip_len, 2),
            "fit": "cover",
        })
        t += clip_len

    timeline = {
        "background": "#000000",
        "tracks": [
            # Track 1 (bottom): Background video, looped
            {"clips": bg_clips},

            # Track 2: HeyGen avatar, chroma-keyed from green screen
            # threshold: int 0-255 (colour distance), halo: int pixels (edge feather)
            {
                "clips": [
                    {
                        "asset": {
                            "type": "video",
                            "src": heygen_video_url,
                            "volume": 1.0,
                            "chromaKey": {
                                "color": "#00FF00",
                                "threshold": 80,
                                "halo": 5,
                            },
                        },
                        "start": 0,
                        "length": duration,
                        "fit": "contain",
                        "position": "center",
                    }
                ]
            },

            # Track 3: Captions — subtitle chunks (if spoken_script) or hook text fallback
            {
                "clips": _build_caption_clips(spoken_script, duration)
                if spoken_script and spoken_script.strip()
                else [
                    {
                        "asset": {
                            "type": "html",
                            "html": (
                                f"<p style=\"font-family:'Open Sans',sans-serif;"
                                f"color:#ffffff;font-size:38px;font-weight:800;"
                                f"text-shadow:2px 2px 6px rgba(0,0,0,0.9);"
                                f"text-align:center;padding:12px 20px;"
                                f"line-height:1.3;margin:0;\">{hook_text}</p>"
                            ),
                            "width": 640,
                            "height": 220,
                            "background": "transparent",
                        },
                        "start": 0,
                        "length": 3.5,
                        "position": "bottom",
                        "offset": {"x": 0, "y": 0.1},
                        "transition": {"out": "fade"},
                    }
                ]
            },

            # Track 4: Background music (low volume, full duration)
            {
                "clips": [
                    {
                        "asset": {
                            "type": "audio",
                            "src": music_url,
                            "volume": 0.12,
                        },
                        "start": 0,
                        "length": duration,
                    }
                ]
            },
        ],
    }

    # Use explicit size only — mixing resolution+aspectRatio+size causes conflicts
    output = {
        "format": "mp4",
        "size": {"width": 720, "height": 1280},
        "fps": 25,
    }

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{SHOTSTACK_BASE}/render",
                headers=headers,
                json={"timeline": timeline, "output": output},
            )
            # Capture body before raise so we see Shotstack's error detail
            if not resp.is_success:
                try:
                    detail = resp.json()
                except Exception:
                    detail = resp.text
                return {
                    "render_id": None,
                    "status": "error",
                    "video_url": None,
                    "error": f"Shotstack {resp.status_code}: {detail}",
                }
            data = resp.json()
            render_id = data.get("response", {}).get("id")

        return {"render_id": render_id, "status": "pending", "video_url": None}

    except Exception as e:
        return {"render_id": None, "status": "error", "video_url": None, "error": str(e)}


def poll_composite(api_key: str, render_id: str) -> dict:
    """
    Poll a Shotstack render job by render_id.
    Shotstack statuses: queued, rendering, saving, done, failed
    """
    headers = {
        "x-api-key": api_key,
        "Accept": "application/json",
    }

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{SHOTSTACK_BASE}/render/{render_id}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json().get("response", {})

        status = data.get("status", "queued")

        if status == "done":
            return {"render_id": render_id, "status": "succeeded", "video_url": data.get("url")}
        elif status in ("failed", "cancelled"):
            return {
                "render_id": render_id,
                "status": "failed",
                "video_url": None,
                "error": data.get("error", "Render failed"),
            }
        else:
            # queued, rendering, saving
            return {
                "render_id": render_id,
                "status": "pending",
                "video_url": None,
                "shotstack_status": status,
            }

    except Exception as e:
        return {"render_id": render_id, "status": "error", "video_url": None, "error": str(e)}
