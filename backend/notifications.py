import json
from pywebpush import webpush, WebPushException
from config import VAPID_PRIVATE_KEY, VAPID_SUBJECT
from database import get_db

def send_push_notification(subscription_info: dict, payload: dict) -> bool:

    if not VAPID_PRIVATE_KEY:
        print("⚠️ VAPID_PRIVATE_KEY missing, skipping push notification.")
        return False

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT}
        )
        return True
    except WebPushException as ex:
        print(f"❌ Web Push failed: {ex}")
        # Ideally, handle 410 Gone by removing the subscription
        return False
    except Exception as e:
        print(f"❌ Unexpected push error: {e}")
        return False

def notify_user(user_id: str, title: str, body: str, url: str = "/") -> None:

    db = get_db()
    if db is None:
        return


    user = db.users.find_one({"id": user_id}, {"pushSubscriptions": 1})
    if not user or "pushSubscriptions" not in user:
        return

    subscriptions = user["pushSubscriptions"]
    if not subscriptions:
        return

    payload = {
        "title": title,
        "body": body,
        "url": url,
        "icon": "/pwa-192x192.png"
    }


    for sub in subscriptions:
        send_push_notification(sub, payload)
