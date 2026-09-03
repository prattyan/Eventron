import os
import sys
import io
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))


MONGODB_URI: str = os.getenv("MONGODB_URI", "") or os.getenv("MONGO_URI", "")
MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "") or os.getenv("DB_NAME", "event_horizon")

ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")
if not ENCRYPTION_KEY or len(ENCRYPTION_KEY) < 16:
    print("⚠️  ENCRYPTION_KEY not set or too short in .env — using fallback (NOT SECURE FOR PRODUCTION)")
FINAL_ENCRYPTION_KEY: str = ENCRYPTION_KEY or "EventHorizon2026SecureKey32Bytes"


GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")


RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_YourKeyIdPlaceholder")
RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "YourKeySecretPlaceholder")

    
PORT: int = int(os.getenv("PORT", "5005"))


VAPID_PRIVATE_KEY: str = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT: str = os.getenv("VAPID_SUBJECT", "mailto:admin@eventron.com")

TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_VERIFY_SERVICE_SID: str = os.getenv("TWILIO_VERIFY_SERVICE_SID", "")
TWILIO_CUSTOM_APP_NAME: str = os.getenv("TWILIO_CUSTOM_APP_NAME", "Eventron")
TWILIO_FROM_EMAIL: str = os.getenv("TWILIO_FROM_EMAIL", "")
TWILIO_FROM_NAME: str = os.getenv("TWILIO_FROM_NAME", "Eventron")

SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASS: str = os.getenv("SMTP_PASS", "")
SMTP_FROM: str = os.getenv("SMTP_FROM", SMTP_USER or "noreply@eventron.com")

FIREBASE_API_KEY: str = os.getenv("FIREBASE_API_KEY", "")
FIREBASE_AUTH_DOMAIN: str = os.getenv("FIREBASE_AUTH_DOMAIN", "")
FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")
