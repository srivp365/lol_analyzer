from sqlalchemy.orm import Session #type:ignore
from app.models.match import Match
from app.models.match_participant import MatchParticipant
from app.models.timeline_frame import TimelineFrame
from app.services.riot_client import get_match_data, get_match_timeline_data
from datetime import datetime

def ingest_match(match_id : str, db : Session, region : str):
    existing_match = db.get(Match, match_id)
    if existing_match:
        return {"status": "already ingested", "match_id": match_id}
    match_info = get_match_data(match_id=match_id, region=region)
    match = Match(
        match_id = match_info["metadata"]["matchId"],
        game_start = datetime.fromtimestamp(match_info["info"]["gameStartTimestamp"] / 1000),
        game_duration = match_info["info"]["gameDuration"],
        game_version = match_info["info"]["gameVersion"],
        queue_id = match_info["info"]["queueId"],
        map_id = match_info["info"]["mapId"]
    )
    # personal note: order matters, so this match needs to enter the db first since we have a foreign key in
    # match_participant that points here!
    db.add(match)



    participants_list = match_info["info"]["participants"]
    for participant in participants_list:
        # the value assignment per row was handled by ai to automate a repetitive task
        challenges = participant.get("challenges", {})
        cs_total = participant["totalMinionsKilled"]

        match_participant = MatchParticipant(
            match_id = match_info["metadata"]["matchId"],
            puuid = participant["puuid"],
            participant_id = participant["participantId"],
            champion_id = participant["championId"],
            champion_name = participant["championName"],
            team_id = participant["teamId"],
            individual_position = participant["individualPosition"],
            team_position = participant["teamPosition"],
            win = participant["win"],
            kills = participant["kills"],
            deaths = participant["deaths"],
            assists = participant["assists"],
            cs_total = cs_total,
            cs_per_min = cs_total / (match_info["info"]["gameDuration"] / 60),
            vision_score = participant["visionScore"],
            wards_placed = participant["wardsPlaced"],
            wards_killed = participant["wardsKilled"],
            control_wards = participant["detectorWardsPlaced"],
            gold_earned = participant["goldEarned"],
            gold_spent = participant["goldSpent"],
            damage_to_champions = participant["totalDamageDealtToChampions"],
            damage_taken = participant["totalDamageTaken"],
            kill_participation = challenges.get("killParticipation"),
            kda = challenges.get("kda"),
            gold_per_min = challenges.get("goldPerMinute"),
            damage_per_min = challenges.get("damagePerMinute"),
            lane_cs_at_10 = challenges.get("laneMinionsFirst10Minutes"),
        )
        db.add(match_participant)

    # ensures that there is no duplication of frames, because that's a problem I kept running into
    # i rounded to minutes (//60000), which made the last and second last frame have the same int value, so it violated the unique key constraint I had
    seen = set()
    frames = get_match_timeline_data(match_id=match_id, region=region)["info"]["frames"]
    for frame in frames:
        for participant_id, pframe in frame["participantFrames"].items():
            key = (int(participant_id), frame["timestamp"] // 60000)
            if key in seen:
                continue
            seen.add(key)
            # value assingment per row was again handled by AI
            timeline_frame = TimelineFrame(
                match_id = match_info["metadata"]["matchId"],
                participant_id = int(participant_id),
                timestamp_min = frame["timestamp"] // 60000,
                current_gold = pframe["currentGold"],
                total_gold = pframe["totalGold"],
                gold_per_second = pframe["goldPerSecond"],
                minions_killed = pframe["minionsKilled"],
                jungle_minions_killed = pframe["jungleMinionsKilled"],
                level = pframe["level"],
                xp = pframe["xp"],
                time_enemy_spent_controlled = pframe["timeEnemySpentControlled"],
                pos_x = pframe["position"]["x"],
                pos_y = pframe["position"]["y"],
                physical_damage_to_champs = pframe["damageStats"]["physicalDamageDoneToChampions"],
                magic_damage_to_champs = pframe["damageStats"]["magicDamageDoneToChampions"],
                total_damage_to_champs = pframe["damageStats"]["totalDamageDoneToChampions"],
                total_damage_taken = pframe["damageStats"]["totalDamageTaken"],
            )

            db.add(timeline_frame)

    db.commit()
