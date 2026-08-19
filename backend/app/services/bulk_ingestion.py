import math

from app.services.riot_client import get_match_history, get_puuid
from app.services.ingestion import ingest_match
from app.db.base import get_db




def bulk_ingest(matches : list[str], region : str):
    db = next(get_db())
    for match in matches:
        if match is None:
            continue
        ingest_match(match_id=match, db = db, region = region)
