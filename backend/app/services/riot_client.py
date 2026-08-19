import requests #type:ignore
import os
from dotenv import load_dotenv, find_dotenv # pyright: ignore[reportMissingImports]

# loading .env files
load_dotenv(find_dotenv())
riot_api_key = os.getenv("RIOT_API_KEY")
payload = {'api_key': riot_api_key}

if not riot_api_key:
    print("Warning: API Key not found!")


def get_puuid(game_name : str, tag_name : str, region : str):
    # retrieve PUUIDs based on tagline and username (ign)
    account_response = requests.get(f"https://{region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_name}", params=payload)
    if account_response.status_code != 200:
        raise Exception(f"Riot API error {account_response.status_code}: {account_response.json()}")
    puuid = account_response.json().get("puuid")
    return puuid


def get_match_history(puuid, region : str):
    # retrieve last 10 matches
    match_history_response = requests.get(
        f'https://{region}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids',
        params={'api_key': riot_api_key, 'queue': 420, 'count': 10}
    )
    if match_history_response.status_code != 200:
        raise Exception(f"Riot API error {match_history_response.status_code}: {match_history_response.json()}")
    return match_history_response.json()

def get_match_data(match_id: str, region : str):
    match_data_response = requests.get(f'https://{region}.api.riotgames.com/lol/match/v5/matches/{match_id}', params=payload)
    if match_data_response.status_code != 200:
        raise Exception(f"Riot API error {match_data_response.status_code}: {match_data_response.json()}")
    return match_data_response.json()

def get_match_timeline_data(match_id: str, region : str):
    match_timeline_response = requests.get(f'https://{region}.api.riotgames.com/lol/match/v5/matches/{match_id}/timeline', params=payload)
    if match_timeline_response.status_code != 200:
        raise Exception(f"Riot API error {match_timeline_response.status_code}: {match_timeline_response.json()}")
    return match_timeline_response.json()
