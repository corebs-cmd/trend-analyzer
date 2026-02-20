# Instagram Trend Analyzer

Scrape Instagram hashtags, analyze post patterns with Claude AI, and get a data-driven video proposal.

## Local Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy and fill in your API keys:
```bash
cp .env.example .env
# Edit .env → set APIFY_TOKEN and ANTHROPIC_API_KEY
```

Start the server:
```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
# .env.local already set to http://localhost:8000
npm run dev
```

Open http://localhost:5173

---

## Deploy

### Backend → Railway
1. Push repo to GitHub
2. Create a new Railway project → Deploy from GitHub → select `backend/` as root
3. Add env vars: `APIFY_TOKEN`, `ANTHROPIC_API_KEY`
4. Railway auto-detects Dockerfile and deploys

### Frontend → Vercel
1. Create new Vercel project → import the repo → set **Root Directory** to `frontend`
2. Add env var: `VITE_API_URL` = your Railway backend URL (e.g. `https://your-app.up.railway.app`)
3. Deploy

---

## Stack
- **Backend**: FastAPI + Python 3.11
- **Scraper**: Apify `apify/instagram-scraper`
- **AI**: Anthropic Claude (claude-opus-4-6)
- **Frontend**: React + Vite
