
import json
from config import MONGODB_URI, MONGODB_DB_NAME
from pymongo import MongoClient


def check_events():
    if not MONGODB_URI:
        print("Missing MONGODB_URI")
        return

    client = MongoClient(MONGODB_URI)
    try:
        db = client[MONGODB_DB_NAME]
        events = list(db["events"].find({}).limit(5))

        # Convert ObjectIds to strings for display
        for e in events:
            e["_id"] = str(e["_id"])

        print("Events sample:", json.dumps(events, indent=2, default=str))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    check_events()
