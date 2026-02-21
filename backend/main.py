import os
import asyncio
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from apify_client import run_instagram_scraper
from tiktok_client import run_tiktok_scraper
from analyzer import analyze_posts
from video_generator import generate_videos, poll_runway_task, generate_prompt_proposals, generate_concept, submit_background_runway
from kling_client import poll_kling_task, poll_pika_task, poll_hailuo_task, submit_background_kling
from luma_client import poll_luma_task
from heygen_client import fetch_heygen_config, submit_heygen_task, poll_heygen_task, build_spoken_script
from shotstack_client import submit_composite, poll_composite, get_music_tracks

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

app = FastAPI(title="Instagram Trend Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScrapeRequest(BaseModel):
    hashtags: List[str] = Field(..., min_length=1, description="List of hashtags (without #)")
    min_likes: int = Field(0, ge=0, description="Minimum likes threshold")
    max_posts: int = Field(50, ge=1, le=200, description="Max posts to scrape per hashtag")
    content_types: List[str] = Field(["posts", "reels"], description="Content types to scrape")


class TikTokScrapeRequest(BaseModel):
    hashtags: List[str] = Field(..., min_length=1, description="List of hashtags (without #)")
    results_per_page: int = Field(15, ge=1, le=50, description="Results per hashtag")


class ProposePromptsRequest(BaseModel):
    analysis: dict = Field(..., description="The analysis object from /analyze")
    hashtags: List[str] = Field(..., description="The hashtags used in the analysis")


class VideoRequest(BaseModel):
    analysis: dict = Field(..., description="The analysis object from /analyze")
    hashtags: List[str] = Field(..., description="The hashtags used in the analysis")
    selected_prompt: Optional[str] = Field(None, description="The user-selected runway prompt from propose-prompts")


class PostSummary(BaseModel):
    id: Optional[str] = None
    shortCode: Optional[str] = None
    type: Optional[str] = None
    likesCount: Optional[int] = None
    commentsCount: Optional[int] = None
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    displayUrl: Optional[str] = None
    timestamp: Optional[str] = None
    url: Optional[str] = None


class AnalyzeResponse(BaseModel):
    posts: List[PostSummary]
    total_scraped: int
    analysis: dict


class VideoResponse(BaseModel):
    videos: List[dict]


class BackgroundRequest(BaseModel):
    prompt_a: str = Field(..., description="Visual prompt for background slot A")
    prompt_b: str = Field(..., description="Visual prompt for background slot B")
    model: str = Field("kling", description="Video model: 'kling' or 'runway'")


class CompositeRequest(BaseModel):
    heygen_video_url: str = Field(..., description="HeyGen avatar video URL (green screen)")
    background_video_url: str = Field(..., description="Background video URL to composite behind avatar")
    hook_text: str = Field(..., description="Hook text displayed as caption overlay")
    music_track_id: str = Field("hype", description="Music track ID from /pipeline/music-tracks")
    duration: float = Field(30.0, description="Total video duration in seconds")


class HeyGenScriptRequest(BaseModel):
    analysis: dict = Field(..., description="The analysis object from /analyze")
    hashtags: List[str] = Field(..., description="The hashtags used in the analysis")
    platform: str = Field("instagram", description="Source platform: instagram or tiktok")


class HeyGenRequest(BaseModel):
    analysis: dict = Field(..., description="The analysis object from /analyze")
    hashtags: List[str] = Field(..., description="The hashtags used in the analysis")
    selected_prompt: Optional[str] = Field(None, description="Selected runway prompt for concept direction")
    avatar_id: str = Field(..., description="HeyGen Avatar IV avatar ID")
    voice_id: str = Field(..., description="HeyGen voice ID")
    platform: str = Field("instagram", description="Source platform: instagram or tiktok")
    spoken_script: Optional[str] = Field(None, description="User-edited spoken script — if provided skips Claude generation")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: ScrapeRequest):
    apify_token = os.getenv("APIFY_TOKEN", "")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")

    if not apify_token:
        raise HTTPException(status_code=500, detail="APIFY_TOKEN not configured")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    try:
        raw_posts = await run_instagram_scraper(
            api_token=apify_token,
            hashtags=req.hashtags,
            min_likes=req.min_likes,
            max_posts=req.max_posts,
            content_types=req.content_types,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Apify scrape failed: {str(e)}")

    if not raw_posts:
        raise HTTPException(
            status_code=404,
            detail="No posts found matching the criteria. Try lowering min_likes or adding more hashtags.",
        )

    posts = [
        PostSummary(
            id=p.get("id"),
            shortCode=p.get("shortCode"),
            type=p.get("type"),
            likesCount=p.get("likesCount"),
            commentsCount=p.get("commentsCount"),
            caption=(p.get("caption") or "")[:500],
            hashtags=p.get("hashtags") or [],
            displayUrl=p.get("displayUrl"),
            timestamp=p.get("timestamp"),
            url=p.get("url") or (f"https://www.instagram.com/p/{p.get('shortCode')}/" if p.get("shortCode") else None),
        )
        for p in raw_posts
    ]

    try:
        analysis = analyze_posts(
            api_key=anthropic_key,
            posts=raw_posts,
            hashtags=req.hashtags,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Analysis failed: {str(e)}")

    return AnalyzeResponse(
        posts=posts,
        total_scraped=len(posts),
        analysis=analysis,
    )


@app.post("/tiktok/analyze", response_model=AnalyzeResponse)
async def tiktok_analyze(req: TikTokScrapeRequest):
    apify_token = os.getenv("APIFY_TOKEN", "")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")

    if not apify_token:
        raise HTTPException(status_code=500, detail="APIFY_TOKEN not configured")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    try:
        raw_posts = await run_tiktok_scraper(
            api_token=apify_token,
            hashtags=req.hashtags,
            results_per_page=req.results_per_page,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Apify TikTok scrape failed: {str(e)}")

    if not raw_posts:
        raise HTTPException(
            status_code=404,
            detail="No TikTok posts found. Try different hashtags or increase results per page.",
        )

    # Normalize TikTok fields → PostSummary shape
    def _get_cover(p):
        covers = p.get("covers")
        if isinstance(covers, dict):
            return covers.get("default")
        if isinstance(covers, list) and covers:
            return covers[0]
        return p.get("videoMeta", {}).get("coverUrl") if isinstance(p.get("videoMeta"), dict) else None

    posts = [
        PostSummary(
            id=str(p.get("id", "")),
            shortCode=None,
            type="Video",
            likesCount=p.get("diggCount") or 0,
            commentsCount=p.get("commentCount") or 0,
            caption=(p.get("text") or "")[:500],
            hashtags=[
                h.get("name", "") if isinstance(h, dict) else str(h)
                for h in (p.get("hashtags") or [])
            ],
            displayUrl=_get_cover(p),
            timestamp=str(p.get("createTime", "")),
            url=p.get("webVideoUrl"),
        )
        for p in raw_posts
    ]

    try:
        analysis = analyze_posts(
            api_key=anthropic_key,
            posts=raw_posts,
            hashtags=req.hashtags,
            platform="tiktok",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Analysis failed: {str(e)}")

    return AnalyzeResponse(
        posts=posts,
        total_scraped=len(posts),
        analysis=analysis,
    )


@app.post("/tiktok/propose-prompts")
async def tiktok_propose_prompts(req: ProposePromptsRequest):
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        proposals = await loop.run_in_executor(
            None, generate_prompt_proposals, anthropic_key, req.analysis, req.hashtags, "tiktok"
        )
        return {"proposals": proposals}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Prompt proposal failed: {str(e)}")


@app.post("/tiktok/generate-videos", response_model=VideoResponse)
async def tiktok_generate_videos(req: VideoRequest):
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    runway_key = os.getenv("RUNWAYML_API_KEY", "")
    fal_key = os.getenv("FAL_KEY", "")
    luma_key = os.getenv("LUMAAI_API_KEY", "")

    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    try:
        videos = await generate_videos(
            anthropic_key=anthropic_key,
            runway_key=runway_key,
            fal_key=fal_key,
            luma_key=luma_key,
            analysis=req.analysis,
            hashtags=req.hashtags,
            selected_prompt=req.selected_prompt,
            platform="tiktok",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Video generation failed: {str(e)}")

    return VideoResponse(videos=videos)


@app.post("/propose-prompts")
async def propose_prompts_endpoint(req: ProposePromptsRequest):
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        proposals = await loop.run_in_executor(
            None, generate_prompt_proposals, anthropic_key, req.analysis, req.hashtags
        )
        return {"proposals": proposals}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Prompt proposal failed: {str(e)}")


@app.post("/generate-videos", response_model=VideoResponse)
async def generate_videos_endpoint(req: VideoRequest):
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    runway_key = os.getenv("RUNWAYML_API_KEY", "")
    fal_key = os.getenv("FAL_KEY", "")
    luma_key = os.getenv("LUMAAI_API_KEY", "")

    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    try:
        videos = await generate_videos(
            anthropic_key=anthropic_key,
            runway_key=runway_key,
            fal_key=fal_key,
            luma_key=luma_key,
            analysis=req.analysis,
            hashtags=req.hashtags,
            selected_prompt=req.selected_prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Video generation failed: {str(e)}")

    return VideoResponse(videos=videos)


@app.get("/video-status/runway/{task_id}")
async def video_status_runway(task_id: str):
    runway_key = os.getenv("RUNWAYML_API_KEY", "")
    if not runway_key:
        raise HTTPException(status_code=500, detail="RUNWAYML_API_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, poll_runway_task, runway_key, task_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Status check failed: {str(e)}")


@app.get("/video-status/kling/{request_id}")
async def video_status_kling(request_id: str):
    fal_key = os.getenv("FAL_KEY", "")
    if not fal_key:
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, poll_kling_task, fal_key, request_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Status check failed: {str(e)}")


@app.get("/video-status/luma/{generation_id}")
async def video_status_luma(generation_id: str):
    luma_key = os.getenv("LUMAAI_API_KEY", "")
    if not luma_key:
        raise HTTPException(status_code=500, detail="LUMAAI_API_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, poll_luma_task, luma_key, generation_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Status check failed: {str(e)}")


@app.get("/video-status/pika/{request_id}")
async def video_status_pika(request_id: str):
    fal_key = os.getenv("FAL_KEY", "")
    if not fal_key:
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, poll_pika_task, fal_key, request_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Status check failed: {str(e)}")


@app.get("/video-status/hailuo/{request_id}")
async def video_status_hailuo(request_id: str):
    fal_key = os.getenv("FAL_KEY", "")
    if not fal_key:
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, poll_hailuo_task, fal_key, request_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Status check failed: {str(e)}")


@app.get("/video-status/heygen/{video_id}")
async def video_status_heygen(video_id: str):
    heygen_key = os.getenv("HEYGEN_API_KEY", "")
    if not heygen_key:
        raise HTTPException(status_code=500, detail="HEYGEN_API_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, poll_heygen_task, heygen_key, video_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Status check failed: {str(e)}")


@app.post("/heygen/preview-script")
async def heygen_preview_script(req: HeyGenScriptRequest):
    """
    Generate a concept via Claude and return the pre-built spoken script for preview/editing.
    Does NOT submit to HeyGen — just returns the text so the user can review and edit.
    """
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        concept = await loop.run_in_executor(
            None, generate_concept, anthropic_key, req.analysis, req.hashtags, None, req.platform
        )
        spoken_script = build_spoken_script(concept)
        return {
            "spoken_script": spoken_script,
            "hook": concept.get("hook", ""),
            "word_count": len(spoken_script.split()),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Script generation failed: {str(e)}")


@app.get("/heygen/config")
async def heygen_config():
    heygen_key = os.getenv("HEYGEN_API_KEY", "")
    if not heygen_key:
        raise HTTPException(status_code=500, detail="HEYGEN_API_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        config = await loop.run_in_executor(None, fetch_heygen_config, heygen_key)
        return config
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"HeyGen config fetch failed: {str(e)}")


@app.post("/heygen/generate", response_model=VideoResponse)
async def heygen_generate(req: HeyGenRequest):
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    heygen_key = os.getenv("HEYGEN_API_KEY", "")

    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")
    if not heygen_key:
        raise HTTPException(status_code=500, detail="HEYGEN_API_KEY not configured")

    try:
        loop = asyncio.get_event_loop()
        if req.spoken_script and req.spoken_script.strip():
            # User provided/edited script — skip Claude, use an empty concept shell
            concept = {"hook": "", "script_outline": [], "runway_prompt": "", "hashtags": []}
        else:
            concept = await loop.run_in_executor(
                None,
                generate_concept,
                anthropic_key,
                req.analysis,
                req.hashtags,
                req.selected_prompt,
                req.platform,
            )
        result = await loop.run_in_executor(
            None,
            submit_heygen_task,
            heygen_key,
            concept,
            req.avatar_id,
            req.voice_id,
            req.spoken_script,  # None → auto-build from concept; str → use directly
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"HeyGen generation failed: {str(e)}")

    return VideoResponse(videos=[result])


@app.get("/pipeline/music-tracks")
def pipeline_music_tracks():
    """Return the list of available background music tracks."""
    return {"tracks": get_music_tracks()}


@app.post("/pipeline/generate-backgrounds")
async def pipeline_generate_backgrounds(req: BackgroundRequest):
    """
    Generate 2 background scene videos (slot A + slot B) using Runway or Kling.
    Submits both in parallel and returns immediately with task_ids for polling.
    """
    runway_key = os.getenv("RUNWAYML_API_KEY", "")
    fal_key = os.getenv("FAL_KEY", "")

    loop = asyncio.get_event_loop()

    if req.model == "runway":
        if not runway_key:
            raise HTTPException(status_code=500, detail="RUNWAYML_API_KEY not configured")
        results = await asyncio.gather(
            loop.run_in_executor(None, submit_background_runway, runway_key, req.prompt_a, "A"),
            loop.run_in_executor(None, submit_background_runway, runway_key, req.prompt_b, "B"),
        )
    else:
        # Default: Kling
        if not fal_key:
            raise HTTPException(status_code=500, detail="FAL_KEY not configured")
        results = await asyncio.gather(
            loop.run_in_executor(None, submit_background_kling, fal_key, req.prompt_a, "A"),
            loop.run_in_executor(None, submit_background_kling, fal_key, req.prompt_b, "B"),
        )

    return {"backgrounds": list(results)}


@app.post("/pipeline/composite")
async def pipeline_composite(req: CompositeRequest):
    """
    Submit a Shotstack render job to composite:
    avatar (green screen) + background + caption + music → 9:16 MP4.
    """
    shotstack_key = os.getenv("SHOTSTACK_API_KEY", "")
    if not shotstack_key:
        raise HTTPException(status_code=500, detail="SHOTSTACK_API_KEY not configured")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        submit_composite,
        shotstack_key,
        req.heygen_video_url,
        req.background_video_url,
        req.hook_text,
        req.music_track_id,
        req.duration,
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=502, detail=result.get("error", "Composite submission failed"))

    return result


@app.get("/pipeline/composite-status/{render_id}")
async def pipeline_composite_status(render_id: str):
    """Poll a Shotstack render job by render_id."""
    shotstack_key = os.getenv("SHOTSTACK_API_KEY", "")
    if not shotstack_key:
        raise HTTPException(status_code=500, detail="SHOTSTACK_API_KEY not configured")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, poll_composite, shotstack_key, render_id)
    return result


# Keep old endpoint working for backwards compat (routes to runway)
@app.get("/video-status/{task_id}")
async def video_status_legacy(task_id: str):
    runway_key = os.getenv("RUNWAYML_API_KEY", "")
    if not runway_key:
        raise HTTPException(status_code=500, detail="RUNWAYML_API_KEY not configured")
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, poll_runway_task, runway_key, task_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Status check failed: {str(e)}")

