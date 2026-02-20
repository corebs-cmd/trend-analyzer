import anthropic
import json


def _summarize_posts(posts: list[dict]) -> str:
    """Build a concise text summary of posts to send to Claude."""
    lines = []
    for i, p in enumerate(posts[:50], 1):  # cap at 50 to stay within token limits
        caption = (p.get("caption") or "")[:300]
        likes = p.get("likesCount", 0)
        comments = p.get("commentsCount", 0)
        post_type = p.get("type", "unknown")
        hashtags = " ".join(p.get("hashtags") or [])
        lines.append(
            f"{i}. [{post_type}] Likes: {likes} | Comments: {comments}\n"
            f"   Caption: {caption}\n"
            f"   Hashtags: {hashtags}"
        )
    return "\n\n".join(lines)


def analyze_posts(api_key: str, posts: list[dict], hashtags: list[str]) -> dict:
    """
    Send post data to Claude and get back structured trend analysis
    and a video proposal.
    """
    client = anthropic.Anthropic(api_key=api_key)

    post_summary = _summarize_posts(posts)
    total = len(posts)
    avg_likes = int(sum(p.get("likesCount", 0) for p in posts) / total) if total else 0
    top_post = max(posts, key=lambda p: p.get("likesCount", 0)) if posts else {}
    top_likes = top_post.get("likesCount", 0)

    prompt = f"""You are an expert Instagram content strategist and trend analyst.

I have scraped {total} Instagram posts for the hashtag(s): {', '.join(hashtags)}
- Average likes: {avg_likes}
- Top post likes: {top_likes}

Here is a sample of the posts (up to 50):

{post_summary}

Analyze these posts and respond ONLY with a valid JSON object in exactly this structure:

{{
  "trend_patterns": [
    {{
      "pattern": "short name of pattern",
      "description": "what this pattern is and why it works",
      "frequency": "how common it is across posts (e.g. seen in ~60% of top posts)"
    }}
  ],
  "key_insights": "2-3 sentence synthesis of the biggest takeaways from all patterns",
  "video_proposal": {{
    "title": "proposed video title or concept name",
    "hook": "the exact opening line or visual for the first 3 seconds",
    "content_structure": [
      {{
        "section": "section name (e.g. Intro, Problem, Demo, CTA)",
        "duration": "e.g. 0-5 sec",
        "description": "what happens in this section"
      }}
    ],
    "visual_style": {{
      "aesthetic": "overall visual vibe (e.g. raw/authentic, polished/cinematic)",
      "lighting": "lighting recommendation",
      "color_palette": "color palette description",
      "editing_style": "editing pace and style notes"
    }},
    "hashtag_recommendations": ["hashtag1", "hashtag2", "hashtag3"],
    "engagement_rationale": "why this video concept is likely to perform well based on the data"
  }}
}}

Return ONLY the JSON. No markdown, no extra text."""

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if Claude wrapped the JSON
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)
