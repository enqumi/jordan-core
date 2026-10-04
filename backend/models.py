from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, BigInteger, Date, DateTime, JSON, Text, ForeignKey
from database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    nickname = Column(String, nullable=False)
    sku = Column(String, nullable=True)
    category = Column(String, nullable=False)
    retail_price = Column(Integer, nullable=False)
    market_price = Column(Integer, nullable=True)
    release_date = Column(Date, nullable=False)
    badge = Column(String, nullable=True)
    layout = Column(String, default="tile")
    description = Column(Text, nullable=False)
    image = Column(String, nullable=True)
    image_size = Column(JSON, nullable=True)
    palette = Column(JSON, nullable=True)

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    token = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    brand = Column(String, nullable=False)
    last4 = Column(String(4), nullable=False)
    holder = Column(String, nullable=False)
    exp_month = Column(Integer, nullable=False)
    exp_year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    items = Column(JSON, nullable=False)
    total = Column(Integer, nullable=False)
    country = Column(String, nullable=False)
    city = Column(String, nullable=False)
    address = Column(String, nullable=False)
    card_brand = Column(String, nullable=False)
    card_last4 = Column(String(4), nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class TelegramLink(Base):
    __tablename__ = "telegram_links"

    telegram_id = Column(BigInteger, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    username = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
