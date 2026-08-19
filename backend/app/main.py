from fastapi import FastAPI, Depends # type: ignore
from app.services.riot_client import get_match_history, get_puuid
from app.db.base import get_db
from app.services.ingestion import ingest_match
from app.services.bulk_ingestion import bulk_ingest
from app.services.analysis import get_cs_analysis, get_vision_analysis, get_gold_diff_analysis, get_kda_analysis
import redis #type:ignore
import os
import json
from fastapi.middleware.cors import CORSMiddleware #type:ignore


app = FastAPI()
redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))



origins =[
    "http://localhost:5173/*",
    "http://127.0.0.1:5173/*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/{region}/{gameName}/{tagName}")
def read_root(region: str, gameName: str, tagName: str, db = Depends(get_db)):
    player_puuid = get_puuid(game_name=gameName, tag_name=tagName, region=region)
    match_history = get_match_history(puuid=player_puuid, region=region)
    bulk_ingest(match_history,region)

    # Caching logic for CS analysis
    cache_key = f"cs_analysis:{player_puuid}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print("Cache hit, returning data")
        cs_analysis_result = json.loads(cached_data)
    print("Cache not present, running query")
    cs_analysis_result = get_cs_analysis(puuid=player_puuid, db = db)
    # ex=3600 tells the cache to delete the data after 1 hour, so we get fresh data every hour
    redis_client.set(cache_key, json.dumps(cs_analysis_result), ex=3600)

    # Caching logic for vision analysis
    cache_key = f"vision_analysis:{player_puuid}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print("Cache hit, returning data")
        vision_analysis_result = json.loads(cached_data)
    print("Cache not present, running query")
    vision_analysis_result = get_vision_analysis(puuid=player_puuid, db = db)
    redis_client.set(cache_key, json.dumps(vision_analysis_result), ex=3600)

    # Caching logic for kda analysis
    cache_key = f"kda_analysis:{player_puuid}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print("Cache hit, returning data")
        kda_analysis_result = json.loads(cached_data)

    print("Cache not present, running query")
    kda_analysis_result = get_kda_analysis(puuid=player_puuid, db = db)
    # ex=3600 tells the cache to delete the data after 1 hour, so we get fresh data every hour
    redis_client.set(cache_key, json.dumps(kda_analysis_result), ex=3600)

    # Caching logic for gold_diff + laning phase delta analysis
    cache_key = f"gdl_analysis:{player_puuid}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print("Cache hit, returning data")
        gdl_analysis_result = json.loads(cached_data)

    print("Cache not present, running query")
    gdl_analysis_result = get_gold_diff_analysis(puuid=player_puuid,match_id=match_history[0], db = db)
    # ex=3600 tells the cache to delete the data after 1 hour, so we get fresh data every hour
    redis_client.set(cache_key, json.dumps(gdl_analysis_result), ex=3600)



    return {
        "summonerName": gameName,
        "summonerTag": tagName,
        "puuid": player_puuid,
        "matches": match_history,
        "csAnalysis": cs_analysis_result,
        "visionAnalysis": vision_analysis_result,
        "kdaAnalysis": kda_analysis_result,
        "gdlAnalysis": gdl_analysis_result
    }



# @app.get("/matches")
# def matches():
#     return get_match_history(puuid=puuid, region="americas")

# @app.post('/ingest/player/{game_name}/{tag_name}')
# def ingest_last_10_matches(game_name: str, tag_name : str):
#     bulk_ingest(puuid=puuid, region="americas")
#     return {"status": "ok"}


@app.post('/ingest/{region}/{match_id}')
# personal note, Depends like a way to tell fast api to run this specific funcition and pass it's returned value as a parameter? -> still learning 😅
# the use of Depends was reccomended by AI
def ingest_data(region : str, match_id : str, db = Depends(get_db)):
    ingest_match(match_id=match_id, db=db, region = region)
    return {"status": "ok", "match_id": match_id}

@app.get('/analysis/cs/{puuid}')
def cs_analysis_endpoint(puuid : str, db = Depends(get_db)):
    cache_key = f"cs_analysis:{puuid}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print("Cache hit, returning data")
        return json.loads(cached_data)

    print("Cache not present, running query")
    cs_analysis_result = get_cs_analysis(puuid=puuid, db = db)
    # ex=3600 tells the cache to delete the data after 1 hour, so we get fresh data every hour
    redis_client.set(cache_key, json.dumps(cs_analysis_result), ex=3600)
    return cs_analysis_result


@app.get('/analysis/vision/{puuid}')
def vision_analysis_endpoint(puuid : str, db = Depends(get_db)):
    # if i ended up having a match id and a puuid as a parameter, I would go in order of least to most specific
    # so something like vision_analysis:{match_id}:{puuid}
    cache_key = f"vision_analysis:{puuid}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print("Cache hit, returning data")
        return json.loads(cached_data)
    print("Cache not present, running query")
    vision_analysis_result = get_vision_analysis(puuid=puuid, db = db)
    redis_client.set(cache_key, json.dumps(vision_analysis_result), ex=3600)


@app.get('/analysis/gold/{match_id}/{puuid}')
def gold_diff_analysis_endpoint(match_id: str, puuid: str, db = Depends(get_db)):
    # if i ended up having a match id and a puuid as a parameter, I would go in order of least to most specific
    # so something like gold_diff_analysis:{match_id}:{puuid}
    cache_key = f"gold_diff_analysis:{match_id}:{puuid}"
    cached_data = redis_client.get(cache_key)
    if cached_data:
        print("Cache hit, returning data")
        return json.loads(cached_data)
    print("Cache not present, running query")
    gold_diff_analysis_result = get_gold_diff_analysis(match_id=match_id, puuid=puuid, db = db)
    redis_client.set(cache_key, json.dumps(gold_diff_analysis_result), ex=3600)
    return gold_diff_analysis_result
