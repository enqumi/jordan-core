import os

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
API_URL = os.getenv("API_URL", "http://api:8000").rstrip("/")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")
WEBAPP_URL = os.getenv("WEBAPP_URL", "").rstrip("/")
WEBAPP_ENABLED = WEBAPP_URL.startswith("https://")
NOTIFY_INTERVAL_SECONDS = int(os.getenv("NOTIFY_INTERVAL_SECONDS", "5"))
