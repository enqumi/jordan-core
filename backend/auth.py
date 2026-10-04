import hashlib
import hmac
import secrets

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations)).hex()
    return hmac.compare_digest(candidate, digest)


def issue_token(db: Session, user: models.User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(models.AuthToken(token=token, user_id=user.id))
    db.commit()
    return token


def bearer_token(authorization: str | None = Header(default=None)) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Нужно войти в аккаунт")
    return token


def current_user(token: str = Depends(bearer_token), db: Session = Depends(get_db)) -> models.User:
    record = db.get(models.AuthToken, token)
    user = record and db.get(models.User, record.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Сессия истекла, войдите снова")
    return user
