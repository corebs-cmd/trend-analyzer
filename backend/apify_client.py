import httpx
import asyncio
from typing import List

APIFY_BASE_URL = "https://api.apify.com/v2"
ACTOR_ID = "apify~instagram-scraper"


async def run_instagram_scraper(
    api_token: str,
    hashtags: List[str],
    min_likes: int,
    max_posts: int,
    content_types: List[str],  # e.g. ["posts", "reels"] or ["posts"] or ["reels"]
) -> List[dict]:
    """
    Run one Apify actor run per content type, merge results, filter by min_likes.
    """
    all_posts = []
    for content_type in content_types:
        run_id = await _start_actor_run(api_token, hashtags, max_posts, content_type)
        dataset_id = await _poll_until_finished(api_token, run_id)
        posts = await _fetch_dataset(api_token, dataset_id)
        all_posts.extend(posts)

    # Deduplicate by id, filter errors and min_likes
    seen = set()
    valid = []
    for p in all_posts:
        if "error" in p:
            continue
        if (p.get("likesCount") or 0) < min_likes:
            continue
        pid = p.get("id") or p.get("shortCode")
        if pid and pid in seen:
            continue
        if pid:
            seen.add(pid)
        valid.append(p)

    return valid


async def _start_actor_run(
    api_token: str, hashtags: List[str], max_posts: int, results_type: str
) -> str:
    direct_urls = [
        f"https://www.instagram.com/explore/tags/{tag.strip().lstrip('#')}/"
        for tag in hashtags
    ]

    input_payload = {
        "directUrls": direct_urls,
        "resultsType": results_type,
        "resultsLimit": max_posts,
        "proxy": {"useApifyProxy": True},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{APIFY_BASE_URL}/acts/{ACTOR_ID}/runs",
            params={"token": api_token},
            json=input_payload,
        )
        resp.raise_for_status()
        return resp.json()["data"]["id"]


async def _poll_until_finished(
    api_token: str, run_id: str, poll_interval: int = 5, max_wait: int = 300
) -> str:
    elapsed = 0
    while elapsed < max_wait:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{APIFY_BASE_URL}/actor-runs/{run_id}",
                params={"token": api_token},
            )
            resp.raise_for_status()
            run_data = resp.json()["data"]
            status = run_data["status"]

        if status == "SUCCEEDED":
            return run_data["defaultDatasetId"]
        elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise RuntimeError(f"Apify run ended with status: {status}")

        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    raise TimeoutError(f"Apify run did not finish within {max_wait} seconds")


async def _fetch_dataset(api_token: str, dataset_id: str) -> List[dict]:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            f"{APIFY_BASE_URL}/datasets/{dataset_id}/items",
            params={"token": api_token, "format": "json", "clean": "true"},
        )
        resp.raise_for_status()
        return resp.json()
