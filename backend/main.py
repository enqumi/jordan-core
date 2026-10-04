import mimetypes
import os
import re
from datetime import date, timedelta

from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import models
from auth import hash_password, verify_password, issue_token, bearer_token, current_user
from database import engine, get_db
from locations import LOCATIONS
from telegram_auth import parse_init_data, internal_key

models.Base.metadata.create_all(bind=engine)

mimetypes.add_type("image/webp", ".webp")

FRONTEND_DIR = os.getenv("FRONTEND_DIR", "/frontend")
ORDER_READY_SECONDS = int(os.getenv("ORDER_READY_SECONDS", "12"))
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CARD_BRANDS = {"Visa", "Mastercard", "Мир", "American Express", "UnionPay", "Карта"}

app = FastAPI(title="JORDAN // CORE API")



class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(max_length=120)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: str
    password: str


class TelegramAuthIn(BaseModel):
    initData: str = Field(min_length=1)


class TelegramLinkIn(TelegramAuthIn):
    email: str
    password: str


class CardIn(BaseModel):
    brand: str
    last4: str = Field(pattern=r"^\d{4}$")
    holder: str = Field(min_length=2, max_length=60)
    expMonth: int = Field(ge=1, le=12)
    expYear: int = Field(ge=2000, le=2100)


class OrderIn(BaseModel):
    productIds: list[str] = Field(min_length=1)
    cardId: int
    country: str
    city: str
    address: str = Field(min_length=5, max_length=200)



TELEGRAM_EMAIL_DOMAIN = "telegram.local"


def user_out(u: models.User):
    return {"id": u.id, "name": u.name, "email": u.email,
            "telegramOnly": u.email.endswith("@" + TELEGRAM_EMAIL_DOMAIN)}


def card_out(c: models.Card):
    return {"id": c.id, "brand": c.brand, "last4": c.last4, "holder": c.holder,
            "expMonth": c.exp_month, "expYear": c.exp_year}


def order_out(o: models.Order):
    ready = models.utcnow() - o.created_at >= timedelta(seconds=ORDER_READY_SECONDS)
    return {
        "id": o.id,
        "items": o.items,
        "total": o.total,
        "country": o.country,
        "city": o.city,
        "address": o.address,
        "card": {"brand": o.card_brand, "last4": o.card_last4},
        "status": "ready" if ready else "processing",
        "createdAt": o.created_at.isoformat() + "Z",
    }



@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "nickname": p.nickname,
            "sku": p.sku,
            "category": p.category,
            "retailPrice": p.retail_price,
            "marketPrice": p.market_price,
            "releaseDate": p.release_date.isoformat() if p.release_date else None,
            "badge": p.badge,
            "layout": p.layout,
            "description": p.description,
            "image": p.image,
            "imageSize": p.image_size,
            "palette": p.palette
        }
        for p in products
    ]


@app.get("/api/locations")
def get_locations():
    return LOCATIONS



@app.post("/api/auth/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Некорректный email")
    if db.query(models.User).filter_by(email=email).first():
        raise HTTPException(status_code=409, detail="Аккаунт с таким email уже существует")
    user = models.User(email=email, name=body.name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return {"token": issue_token(db, user), "user": user_out(user)}


@app.post("/api/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    return {"token": issue_token(db, user), "user": user_out(user)}


@app.get("/api/auth/me")
def me(user: models.User = Depends(current_user)):
    return user_out(user)


@app.post("/api/auth/logout", status_code=204)
def logout(token: str = Depends(bearer_token), db: Session = Depends(get_db)):
    db.query(models.AuthToken).filter_by(token=token).delete()
    db.commit()



def link_telegram(db: Session, tg_user: dict, user: models.User):
    tg_id = int(tg_user["id"])
    db.query(models.TelegramLink).filter(
        (models.TelegramLink.telegram_id == tg_id) | (models.TelegramLink.user_id == user.id)
    ).delete(synchronize_session=False)
    db.add(models.TelegramLink(telegram_id=tg_id, user_id=user.id, username=tg_user.get("username")))
    db.commit()


@app.post("/api/auth/telegram")
def telegram_auth(body: TelegramAuthIn, db: Session = Depends(get_db)):
    tg_user = parse_init_data(body.initData)
    link = db.get(models.TelegramLink, int(tg_user["id"]))
    user = link and db.get(models.User, link.user_id)
    if not user:
        name = " ".join(filter(None, [tg_user.get("first_name"), tg_user.get("last_name")])) or "Покупатель"
        user = models.User(email=f"tg{tg_user['id']}@{TELEGRAM_EMAIL_DOMAIN}", name=name[:60],
                           password_hash="!telegram")
        db.add(user)
        db.commit()
        link_telegram(db, tg_user, user)
    return {"token": issue_token(db, user), "user": user_out(user)}


@app.post("/api/auth/telegram/link")
def telegram_link(body: TelegramLinkIn, db: Session = Depends(get_db)):
    tg_user = parse_init_data(body.initData)
    user = db.query(models.User).filter_by(email=body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    link_telegram(db, tg_user, user)
    return {"token": issue_token(db, user), "user": user_out(user)}



@app.get("/api/cards")
def list_cards(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    cards = db.query(models.Card).filter_by(user_id=user.id).order_by(models.Card.id).all()
    return [card_out(c) for c in cards]


@app.post("/api/cards", status_code=201)
def add_card(body: CardIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if body.brand not in CARD_BRANDS:
        raise HTTPException(status_code=422, detail="Неизвестная платёжная система")
    today = date.today()
    if (body.expYear, body.expMonth) < (today.year, today.month):
        raise HTTPException(status_code=422, detail="Срок действия карты истёк")
    card = models.Card(user_id=user.id, brand=body.brand, last4=body.last4, holder=body.holder.strip().upper(),
                       exp_month=body.expMonth, exp_year=body.expYear)
    db.add(card)
    db.commit()
    return card_out(card)


@app.delete("/api/cards/{card_id}", status_code=204)
def delete_card(card_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    card = db.query(models.Card).filter_by(id=card_id, user_id=user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Карта не найдена")
    db.delete(card)
    db.commit()



@app.post("/api/orders", status_code=201)
def create_order(body: OrderIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    card = db.query(models.Card).filter_by(id=body.cardId, user_id=user.id).first()
    if not card:
        raise HTTPException(status_code=422, detail="Выберите карту для оплаты")
    if body.city not in LOCATIONS.get(body.country, []):
        raise HTTPException(status_code=422, detail="Доставка в этот город недоступна")

    ids = list(dict.fromkeys(body.productIds))
    products = db.query(models.Product).filter(models.Product.id.in_(ids)).all()
    if len(products) != len(ids):
        raise HTTPException(status_code=422, detail="Некоторые товары больше недоступны")
    if any(p.release_date > date.today() for p in products):
        raise HTTPException(status_code=422, detail="Нельзя купить пару до релиза")

    order = models.Order(
        user_id=user.id,
        items=[{"id": p.id, "name": p.name, "nickname": p.nickname, "price": p.retail_price} for p in products],
        total=sum(p.retail_price for p in products),
        country=body.country,
        city=body.city,
        address=body.address.strip(),
        card_brand=card.brand,
        card_last4=card.last4,
    )
    db.add(order)
    db.commit()
    return order_out(order)


@app.get("/api/orders")
def list_orders(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    orders = db.query(models.Order).filter_by(user_id=user.id).order_by(models.Order.id.desc()).all()
    return [order_out(o) for o in orders]


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    order = db.query(models.Order).filter_by(id=order_id, user_id=user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return order_out(order)



@app.get("/api/internal/telegram/{telegram_id}/orders", dependencies=[Depends(internal_key)])
def bot_user_orders(telegram_id: int, db: Session = Depends(get_db)):
    link = db.get(models.TelegramLink, telegram_id)
    user = link and db.get(models.User, link.user_id)
    if not user:
        return {"linked": False, "user": None, "orders": []}
    orders = db.query(models.Order).filter_by(user_id=user.id).order_by(models.Order.id.desc()).limit(5).all()
    return {"linked": True, "user": user_out(user), "orders": [order_out(o) for o in orders]}


@app.get("/api/internal/telegram/feed", dependencies=[Depends(internal_key)])
def bot_order_feed(db: Session = Depends(get_db)):
    since = models.utcnow() - timedelta(hours=1)
    rows = (db.query(models.Order, models.TelegramLink.telegram_id)
            .join(models.TelegramLink, models.TelegramLink.user_id == models.Order.user_id)
            .filter(models.Order.created_at >= since)
            .order_by(models.Order.id).all())
    return [{**order_out(o), "telegramId": tg_id} for o, tg_id in rows]


app.mount("/src", StaticFiles(directory=f"{FRONTEND_DIR}/src"), name="src")

@app.get("/")
def serve_index():
    return FileResponse(f"{FRONTEND_DIR}/index.html")
