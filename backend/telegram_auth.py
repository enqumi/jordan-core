import hashlib
import hmac
import json
import os
import time
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")
INIT_DATA_TTL_SECONDS = 24 * 60 * 60


def parse_init_data(init_data: str) -> dict:
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Вход через Telegram не настроен на сервере")

    fields = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = fields.pop("hash", "")
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not received_hash or not hmac.compare_digest(expected, received_hash):
        raise HTTPException(status_code=401, detail="Подпись Telegram недействительна")

    if time.time() - int(fields.get("auth_date", 0)) > INIT_DATA_TTL_SECONDS:
        raise HTTPException(status_code=401, detail="Сессия Telegram устарела, откройте магазин заново")

    try:
        user = json.loads(fields["user"])
        int(user["id"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(status_code=422, detail="В initData нет пользователя")
    return user


def internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    if not INTERNAL_API_KEY or not hmac.compare_digest(x_internal_key or "", INTERNAL_API_KEY):
        raise HTTPException(status_code=403, detail="Доступ запрещён")
