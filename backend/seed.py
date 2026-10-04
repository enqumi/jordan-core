import datetime
from database import SessionLocal
from models import Product

INITIAL_DATA = [
    {
        "id": "ts-aj1-low-shy-pink",
        "name": "Travis Scott x Air Jordan 1 Low OG SP",
        "nickname": "Shy Pink",
        "sku": "IQ7604-100",
        "category": "Коллаборация",
        "retail_price": 155,
        "market_price": 460,
        "release_date": datetime.date(2026, 5, 22),
        "badge": "Главный хайп",
        "layout": "feature",
        "description": "Фирменный перевёрнутый Swoosh, кремовая кожа с нежно-розовыми оверлеями и винтажная подошва цвета sail. Разлетелся за минуты, на ресейле держится примерно втрое выше ретейла.",
        "image": "./src/img/ts-aj1-low-shy-pink.webp",
        "image_size": [900, 642],
        "palette": {"upper": "#F3EEE6", "overlay": "#F2B6C6", "accent": "#6B4A3A", "midsole": "#EADBC4", "outsole": "#C9A77F", "laces": "#F7F3EC"}
    },
    {
        "id": "jbalvin-aj4-lemonade-amazonas",
        "name": "J Balvin x Air Jordan 4",
        "nickname": "Lemonade / Amazonas",
        "sku": "IW2872-700",
        "category": "Коллаборация",
        "retail_price": 225,
        "market_price": None,
        "release_date": datetime.date(2026, 9, 25),
        "badge": "Свежий дроп",
        "layout": "wide",
        "description": "Тональный «Lemonade»: бледно-лимонная кожа с тиснением под крокодила от шнурков до подошвы, вышел 25 сентября ($225). Следом идёт «Amazonas», вдохновлённый природой Амазонии: глобальный релиз 2 октября на SNKRS за $230.",
        "image": "./src/img/jbalvin-aj4-lemonade.webp",
        "image_size": [900, 642],
        "palette": {"upper": "#F3E7A6", "overlay": "#EBDD94", "accent": "#E2D183", "midsole": "#F1E5A8", "outsole": "#E6D68C", "laces": "#F6ECB8"}
    },
    {
        "id": "aj11-space-jam-2026",
        "name": "Air Jordan 11 Retro",
        "nickname": "Space Jam",
        "sku": None,
        "category": "Ретро",
        "retail_price": 235,
        "market_price": None,
        "release_date": datetime.date(2026, 12, 12),
        "badge": "Возвращение года",
        "layout": "tile",
        "description": "Первый high-top «Space Jam» за 10 лет, к 30-летию фильма. Чёрный лак, баллистическая сетка и ледяная подошва. Ретейл $235, по данным инсайдеров цена может вырасти до $255.",
        "image": "./src/img/aj11-space-jam.webp",
        "image_size": [1000, 667],
        "palette": {"upper": "#141418", "overlay": "#050507", "accent": "#2451C7", "midsole": "#F4F4F6", "outsole": "#9FC4E8", "laces": "#1C1C22"}
    },
    {
        "id": "aj4-bred-reimagined",
        "name": "Air Jordan 4 Retro",
        "nickname": "Bred Reimagined",
        "sku": "FV5029-006",
        "category": "Ретро",
        "retail_price": 215,
        "market_price": None,
        "release_date": datetime.date(2024, 2, 17),
        "badge": "Икона",
        "layout": "tile",
        "description": "Легендарная расцветка 1989 года в премиальной чёрной коже вместо нубука. Огненно-красные акценты, цементно-серые крылья и подошва с эффектом состаренности.",
        "image": "./src/img/aj4-bred-reimagined.webp",
        "image_size": [900, 642],
        "palette": {"upper": "#18181B", "overlay": "#2A2A2E", "accent": "#E3262E", "midsole": "#EDE7DA", "outsole": "#E3262E", "laces": "#1E1E22"}
    }
]

def run_seed():
    db = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            for item in INITIAL_DATA:
                db.add(Product(**item))
            db.commit()
            print("✅ База данных успешно заполнена кроссовками!")
        else:
            print("⚠️ В базе уже есть товары, заполнение пропущено.")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()