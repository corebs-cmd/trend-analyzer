import anthropic
import runwayml
import asyncio
import json
from typing import List
from kling_client import submit_kling_task, submit_pika_task, submit_hailuo_task
from luma_client import submit_luma_task


def generate_prompt_proposals(
    anthropic_key: str,
    analysis: dict,
    hashtags: List[str],
    platform: str = "instagram",
) -> List[dict]:
    """
    Ask Claude to produce 3 distinct runway_prompt variations based on the trend analysis.
    Returns a list of 3 prompt objects with a label and the prompt text.
    """
    client = anthropic.Anthropic(api_key=anthropic_key)

    trend_patterns = analysis.get("trend_patterns", [])
    key_insights = analysis.get("key_insights", "")
    vp = analysis.get("video_proposal", {})

    patterns_text = "\n".join(
        f"- {p.get('pattern')}: {p.get('description')} ({p.get('frequency')})"
        for p in trend_patterns
    )

    platform_label = "TikTok" if platform == "tiktok" else "Instagram"

    prompt = f"""You are an expert AI video prompt engineer specializing in RunwayML text-to-video generation.

Based on this {platform_label} trend analysis for hashtags: {', '.join(hashtags)}

KEY INSIGHTS:
{key_insights}

TOP PATTERNS:
{patterns_text}

ORIGINAL VIDEO PROPOSAL:
Title: {vp.get('title', '')}
Hook: {vp.get('hook', '')}
Visual Style: {json.dumps(vp.get('visual_style', {}), indent=2)}

Generate exactly 7 distinct RunwayML video prompt variations for this trend. Each variation must use one of the following creative angles, in this exact order:

1. Cinematic & Moody — dramatic shadows, slow push-in, desaturated tones, tense atmosphere
2. Energetic & Raw — handheld follow, fast cuts implied through motion blur, kinetic energy
3. Minimal & Clean — white or neutral backgrounds, single hero object, deliberate pacing
4. Macro & Texture — extreme close-up of surfaces, fabric, food, skin, or material detail; shallow depth of field
5. Aerial Drift — slow overhead or high-angle glide across landscapes, crowds, or architecture
6. Golden Hour / Backlit — warm backlit subjects at magic hour, lens flare, long shadows, rim lighting
7. Product / Object Story — single hero object with dramatic studio lighting, slow rotation or reveal, intentional composition

Respond ONLY with a valid JSON array of exactly 7 objects:
[
  {{
    "label": "short 2-4 word label matching the angle (e.g. 'Macro & Texture')",
    "description": "one sentence explaining what makes this prompt unique and why it fits this trend",
    "prompt": "A detailed cinematic video generation prompt for RunwayML. Must be vivid, specific, and describe motion, lighting, camera movement, and mood. 50-80 words. No human faces. Focus on environments, objects, textures, and movement."
  }}
]

Rules for each prompt:
- Describe ONLY visuals — no dialogue or text overlays
- Include specific camera movement (slow push in, aerial drift, handheld follow, macro pull-focus, etc.)
- Include precise lighting conditions (golden hour, soft diffused, neon glow, rim light, studio key light, etc.)
- Include mood, texture, and material details
- NO human faces (Runway restriction) — use hands, silhouettes, landscapes, objects
- Keep each prompt under 80 words
- Make all 7 variations meaningfully different from each other
- Ground each prompt in the specific trend/hashtag topic

Return ONLY the JSON array. No markdown, no extra text."""

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


def _generate_video_concepts(
    anthropic_key: str,
    analysis: dict,
    hashtags: List[str],
    selected_prompt: str = None,
    platform: str = "instagram",
) -> List[dict]:
    """
    Ask Claude to produce 3 distinct video concepts with RunwayML-optimized prompts.
    Each concept has a different hook, style, and angle.
    """
    client = anthropic.Anthropic(api_key=anthropic_key)

    trend_patterns = analysis.get("trend_patterns", [])
    key_insights = analysis.get("key_insights", "")
    vp = analysis.get("video_proposal", {})

    patterns_text = "\n".join(
        f"- {p.get('pattern')}: {p.get('description')} ({p.get('frequency')})"
        for p in trend_patterns
    )

    if selected_prompt:
        runway_prompt_instruction = f"""Use EXACTLY this runway_prompt (do not modify it):
"{selected_prompt}"
"""
    else:
        runway_prompt_instruction = """Generate a "runway_prompt": "A detailed cinematic video generation prompt for RunwayML. Must be vivid, specific, and describe motion, lighting, camera movement, and mood. 50-80 words. No human faces. Focus on environments, objects, textures, and movement."

Rules for runway_prompt:
- Describe ONLY visuals — no dialogue or text overlays
- Include camera movement (slow push in, aerial drift, handheld follow, etc.)
- Include lighting conditions (golden hour, soft diffused light, neon glow, etc.)
- Include mood and texture details
- NO human faces (Runway restriction) — use hands, silhouettes, landscapes, objects
- Keep it under 80 words"""

    platform_label = "TikTok" if platform == "tiktok" else "Instagram"

    prompt = f"""You are an expert social media video director and AI video prompt engineer.

Based on this {platform_label} trend analysis for hashtags: {', '.join(hashtags)}

KEY INSIGHTS:
{key_insights}

TOP PATTERNS:
{patterns_text}

ORIGINAL VIDEO PROPOSAL:
Title: {vp.get('title', '')}
Hook: {vp.get('hook', '')}
Visual Style: {json.dumps(vp.get('visual_style', {}), indent=2)}

Generate exactly 1 video reel concept targeting these trends.

Respond ONLY with a valid JSON array of exactly 1 object, each with this structure:
[
  {{
    "concept_number": 1,
    "title": "short punchy concept title",
    "angle": "what makes this concept unique vs the others (e.g. emotional, educational, comedic, aspirational)",
    "hook": "the exact opening line or visual description for the first 3 seconds",
    "script_outline": [
      {{"timestamp": "0-3s", "action": "what happens on screen"}},
      {{"timestamp": "3-10s", "action": "what happens on screen"}},
      {{"timestamp": "10-20s", "action": "what happens on screen"}},
      {{"timestamp": "20-30s", "action": "CTA and closing"}}
    ],
    "runway_prompt": "placeholder — see instruction below",
    "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  }}
]

{runway_prompt_instruction}

Return ONLY the JSON array. No markdown, no extra text."""

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)


def _submit_runway_task(
    runway_key: str,
    concept: dict,
    ratio: str = "720:1280",
    duration: int = 8,
) -> dict:
    """
    Submit a text-to-video task to RunwayML using veo3.1.
    veo3.1 supports: 4, 6, or 8 seconds.
    """
    client = runwayml.RunwayML(api_key=runway_key)

    try:
        task = client.text_to_video.create(
            model="veo3.1",
            prompt_text=concept["runway_prompt"],
            ratio=ratio,
            duration=duration,
        )
        return {**concept, "task_id": task.id, "video_url": None, "status": "pending", "model": "veo3.1", "platform": "RunwayML"}
    except Exception as e:
        return {**concept, "task_id": None, "video_url": None, "status": "error", "error": str(e), "model": "veo3.1", "platform": "RunwayML"}


def _submit_runway_task_gen4(
    runway_key: str,
    concept: dict,
    ratio: str = "720:1280",
    duration: int = 10,
) -> dict:
    """
    Submit a text-to-video task to RunwayML using gen4.5.
    Valid models: gen3a_turbo, gen4.5, veo3, veo3.1, veo3.1_fast
    gen4.5 supports up to 10 seconds.
    """
    client = runwayml.RunwayML(api_key=runway_key)

    try:
        task = client.text_to_video.create(
            model="gen4.5",
            prompt_text=concept["runway_prompt"],
            ratio=ratio,
            duration=duration,
        )
        return {**concept, "task_id": task.id, "video_url": None, "status": "pending", "model": "gen4.5", "platform": "RunwayML"}
    except Exception as e:
        return {**concept, "task_id": None, "video_url": None, "status": "error", "error": str(e), "model": "gen4.5", "platform": "RunwayML"}


def poll_runway_task(runway_key: str, task_id: str) -> dict:
    """
    Poll a single Runway task by ID and return its current status.
    Called by the /video-status endpoint.
    """
    client = runwayml.RunwayML(api_key=runway_key)
    result = client.tasks.retrieve(task_id)
    status = result.status  # PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED

    if status == "SUCCEEDED":
        video_url = None
        if result.output:
            video_url = result.output[0] if isinstance(result.output, list) else result.output
        return {"task_id": task_id, "status": "succeeded", "video_url": video_url}
    elif status in ("FAILED", "CANCELLED"):
        return {
            "task_id": task_id,
            "status": status.lower(),
            "video_url": None,
            "error": getattr(result, "failure", "Generation failed"),
        }
    else:
        # Still PENDING or RUNNING
        return {"task_id": task_id, "status": "pending", "video_url": None}


async def generate_videos(
    anthropic_key: str,
    runway_key: str,
    fal_key: str,
    luma_key: str,
    analysis: dict,
    hashtags: List[str],
    selected_prompt: str = None,
    platform: str = "instagram",
) -> List[dict]:
    """
    Full pipeline: generate 1 concept via Claude, then submit to all providers in parallel.
    Providers: RunwayML veo3.1, RunwayML gen4_turbo, Kling 2.6 Pro, Pika 2.2, Luma ray-3-14.
    Returns immediately with task_ids — frontend polls each card separately.
    """
    loop = asyncio.get_event_loop()

    # Step 1: Generate 1 concept via Claude (using selected_prompt if provided)
    concepts = await loop.run_in_executor(
        None, _generate_video_concepts, anthropic_key, analysis, hashtags, selected_prompt, platform
    )
    concept = concepts[0]

    # Step 2: Submit to all providers concurrently
    submit_tasks = []

    if runway_key:
        submit_tasks.append(
            loop.run_in_executor(None, _submit_runway_task, runway_key, concept)
        )
        submit_tasks.append(
            loop.run_in_executor(None, _submit_runway_task_gen4, runway_key, concept)
        )
    if fal_key:
        submit_tasks.append(
            loop.run_in_executor(None, submit_kling_task, fal_key, concept)
        )
        submit_tasks.append(
            loop.run_in_executor(None, submit_pika_task, fal_key, concept)
        )
        submit_tasks.append(
            loop.run_in_executor(None, submit_hailuo_task, fal_key, concept)
        )
    if luma_key:
        submit_tasks.append(
            loop.run_in_executor(None, submit_luma_task, luma_key, concept)
        )

    results = await asyncio.gather(*submit_tasks)
    return list(results)
