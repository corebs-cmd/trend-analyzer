import httpx
import asyncio
from typing import List

APIFY_BASE_URL = "https://api.apify.com/v2"
TIKTOK_ACTOR_ID = "clockworks/tiktok-scraper"


async def run_tiktok_scraper(
    api_token: str,
    hashtags: List[str],
    results_per_page: int = 15,
) -> List[dict]:
    """
    Run the Apify TikTok scraper for each hashtag, merge and deduplicate results.
    Returns raw TikTok post dicts.
    """
    all_posts = []
    for tag in hashtags:
        run_id = await _start_tiktok_run(api_token, tag, results_per_page)
        dataset_id = await _poll_until_finished(api_token, run_id)
        posts = await _fetch_dataset(api_token, dataset_id)
        all_posts.extend(posts)

    # Deduplicate by id, skip error entries
    seen = set()
    valid = []
    for p in all_posts:
        if "error" in p:
            continue
        pid = str(p.get("id", ""))
        if pid and pid in seen:
            continue
        if pid:
            seen.add(pid)
        valid.append(p)

    return valid


async def _start_tiktok_run(
    api_token: str, hashtag: str, results_per_page: int
) -> str:
    input_payload = {
        "hashtags": [hashtag.strip().lstrip("#")],
        "resultsPerPage": results_per_page,
        "proxyConfiguration": {"useApifyProxy": True},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{APIFY_BASE_URL}/acts/{TIKTOK_ACTOR_ID}/runs",
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
            raise RuntimeError(f"Apify TikTok run ended with status: {status}")

        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    raise TimeoutError(f"Apify TikTok run did not finish within {max_wait} seconds")


async def _fetch_dataset(api_token: str, dataset_id: str) -> List[dict]:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            f"{APIFY_BASE_URL}/datasets/{dataset_id}/items",
            params={"token": api_token, "format": "json", "clean": "true"},
        )
        resp.raise_for_status()
        return resp.json()
