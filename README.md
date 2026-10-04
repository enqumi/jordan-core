# JORDAN // CORE

Маркет плейс кроссовок от бренда Nike (не официальный) 

| Сервис    | Контейнер         | Что делает                                              | Порт  |
|-----------|-------------------|---------------------------------------------------------|-------|
| `db`      | `jordan_postgres` | PostgreSQL 15: товары, пользователи, карты, заказы      | 5432  |
| `api`     | `jordan_fastapi`  | FastAPI: REST API + сайт                                | 8000  |
| `bot`     | `jordan_bot`      | Telegram-бот (aiogram 3), уведомления о заказах         | —     |
| `miniapp` | `jordan_miniapp`  | React Mini App (Vite → nginx), проксирует `/api` в `api` | 8080  |

Бот и Mini App обращаются к API по имени сервиса (`http://api:8000`) во внутренней сети Compose.

## Запуск

```bash
cp .env.example .env        # вписать BOT_TOKEN от @BotFather и POSTGRES_PASSWORD
docker compose up -d --build
```

### Mini App внутри Telegram

Telegram открывает Mini App только по HTTPS. Локально поднимите туннель к порту 8080:

```bash
cloudflared tunnel --url http://localhost:8080
```

Вставьте выданный `https://…` адрес в `WEBAPP_URL` в `.env` и перезапустите бота:

```bash
docker compose up -d bot
```

Бот сам выставит кнопку меню «Магазин» и команды. Внутри Telegram вход автоматический: API проверяет
подпись `initData` токеном бота

## Бот

- `/start` — главное меню (HTML-разметка, инлайн-кнопки)
- `/drops` — карусель товаров с фото, ◀️ ▶️ и кнопкой «Купить» прямо в Mini App
- `/orders` — последние заказы с обновлением
- `/help` — справка

После оформления заказа в Mini App бот присылает уведомление, а когда заказ собран — второе.

.<img width="1920" height="1080" alt="2026-10-04_20-26-22" src="https://github.com/user-attachments/assets/d8f0906e-384e-4c6e-bd41-cdb106771df5" />
<img width="1920" height="1080" alt="2026-10-04_20-26-15" src="https://github.com/user-attachments/assets/83948eaf-26a2-4e3b-8d05-b0a1622bce44" />
<img width="1920" height="1080" alt="2026-10-04_20-26-01" src="https://github.com/user-attachments/assets/574e0383-8b77-49b8-8195-0f3e0f7fb194" />

