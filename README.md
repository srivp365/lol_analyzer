# League of Legends Analyzer


## 🌟 Highlights

- Robust ETL (Extract, Trasnform, Load) data ingestion pipeline that parses deeply nested / multi-layered data from api responses and turns it into a noramalized relational database
- Used custom memory-efficient deduplication methods (use of sets) as a means of handling data quirks (overlapping frames, duplicate time frames)
- Implemented a Redis caching layer with a 1-hour TTL on heavy analytical endpoints, drastically reducing PostgreSQL load and ensuring sub-millisecond response times on dashboard reloads.
- Fully containerized stack utilizing FastAPI, React+TypeScript, and PostgreSQL (with redis for repeat requests in a short time) deployed on a VM.Standard.E2.1.Micro on OCI.

## ℹ️ Overview

A small app I developed for users to be able to review their League of Legends statistics, things like CreepScore /min, Lane phase diff, Gold difference between you and your direct opposition alongside other statistics provided by the Riot API. The hope is for players to be able to have a more active understanding of where they're falling behind the competition (I'm not collecting enough gold, not killing enough creeps, dying more often than securing kills) and be able to pay more attention to this during future games!

## ⬇️ Installation Instructions

To run this project locally, you will need **Python 3.10+**, **Node.js 18+**, and **Docker** installed. Don't forget to grab an API key from riot!

### 1. Database (PostgreSQL)

We use Docker to quickly spin up the database container.

```bash
docker-compose up -d db
```

### 2. Backend (FastAPI)

The backend utilizes uv for fast, reproducible dependency management.

```bash
cd backend
uv venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
uv pip install -e .

# Run Alembic migrations to build the schema
alembic upgrade head
```

> Create a .env file in the backend/ directory and add your Riot API key:
> RIOT_API_KEY=your_development_key_here

Start the server:

```bash
uvicorn app.main:app --reload
```

### Frontend (React + TypeScript)

```bash
cd frontend
npm install
npm run dev
```

The dashboard will be available at http://localhost:5173.

## 🔮 Roadmap & Next Steps

I'm still working on this project, mainly on trying to incorporate some form of Machine Learning into this, given the rich data I'm able to get from the API.

- Machine Learning Implementation: Add a win-prediction algorithm that takes in information like CS Diff, Gold Diff, Vision score etc.
- Explainable AI: Implement an algorithm that takes the insights produced by the previous ML model, and produce human readable output based on feature weight.

## 💭 Feedback and Contributions

As a first-year engineering student, I built this project as a means of bettering my full stack skills, while also learning more about Docker, OCI and sql-alchemy.

If you see an area for optimization, have deployment advice, or just want to discuss the code, please feel free to open an Issue or start a Discussion.
