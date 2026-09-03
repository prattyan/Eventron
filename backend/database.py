

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure
from config import MONGODB_URI, MONGODB_DB_NAME

_client: MongoClient | None = None
_db: Database | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        if not MONGODB_URI:
            raise RuntimeError("MONGODB_URI is missing from environment variables!")
        _client = MongoClient(
            MONGODB_URI,
            maxPoolSize=50,
            minPoolSize=5,
            connectTimeoutMS=10000,
            socketTimeoutMS=30000,
            serverSelectionTimeoutMS=5000,
            waitQueueTimeoutMS=5000,
            retryReads=True,
            retryWrites=True,
            compressors=["zstd", "snappy", "zlib"],
        )
    return _client


def get_db() -> Database:
    global _db
    if _db is None:
        client = get_client()
        _db = client[MONGODB_DB_NAME]
    return _db


async def ensure_indexes() -> None:

    db = get_db()
    try:
        print("⚡ Ensuring Indexes...")

                # Events
        db["events"].create_index("id", unique=True)
        db["events"].create_index("organizerId")
        db["events"].create_index("date")

        # Registrations
        db["registrations"].create_index("id", unique=True)
        db["registrations"].create_index("eventId")
        db["registrations"].create_index("participantEmail")
        db["registrations"].create_index("participantId")

        # Users
        db["users"].create_index("id", unique=True)
        db["users"].create_index("email", unique=True)
        db["users"].create_index("role")

        # Teams
        db["teams"].create_index("id", unique=True)
        db["teams"].create_index("eventId")
        db["teams"].create_index("inviteCode", unique=True)

        # Notifications
        db["notifications"].create_index("userId")
        db["notifications"].create_index([("createdAt", -1)])

        print("✅ Indexes: Verified/Created")
    except Exception as e:
        print(f"❌ Indexes: Creation failed — {e}")


async def connect_db() -> None:
    
    print("----------------------------------------")
    print("Initializing Event Server (Python/FastAPI)...")

    from config import GEMINI_API_KEY

    if GEMINI_API_KEY and len(GEMINI_API_KEY) > 20:
        print("✅ Gemini API Key: Found (Configured)")
    else:
        print("❌ Gemini API Key: MISSING or INVALID (Check .env)")

    try:
        client = get_client()
        
        # Ping the database with a short timeout to check connectivity
        client.admin.command("ping")
        print("✅ MongoDB: Connected Successfully")

        await ensure_indexes()
    except ConnectionFailure as e:
        print("❌ MongoDB: Connection Failed (Server unreachable)")
        print(f"   Details: {e}")
    except Exception as e:
        print("❌ MongoDB: Initialization Error")
        print(f"   Type: {type(e).__name__}")
        print(f"   Message: {e}")
        if "dnspython" in str(e).lower():
            print("   💡 Tip: Try installing 'dnspython' (pip install dnspython)")
        elif "dns" in str(e).lower():
            print("   💡 Tip: Check your internet connection or DNS settings (e.g., try 8.8.8.8)")

    print("----------------------------------------")


def close_db() -> None:
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
