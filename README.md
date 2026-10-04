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
- `/drops` — карусель товаров с фото и кнопкой «Купить» прямо в Mini App
- `/orders` — последние заказы с обновлением
- `/help` — справка

После оформления заказа в Mini App бот присылает уведомление, а когда заказ собран — второе.

.<img width="1920" height="1080" alt="2026-10-04_20-26-22" src="https://github.com/user-attachments/assets/d8f0906e-384e-4c6e-bd41-cdb106771df5" />
<img width="1920" height="1080" alt="2026-10-04_20-26-15" src="https://github.com/user-attachments/assets/83948eaf-26a2-4e3b-8d05-b0a1622bce44" />
<img width="1920" height="1080" alt="2026-10-04_20-26-01" src="https://github.com/user-attachments/assets/574e0383-8b77-49b8-8195-0f3e0f7fb194" />
<img width="369" height="800" alt="Untitled" src="https://github.com/user-attachments/assets/c4a79932-3c2b-4d9b-be18-4a106970d4e8" />
<img width="369" height="800" alt="scrn6" src="https://github.com/user-attachments/assets/59c13283-4fe5-4c1c-b45f-283f870672b2" />
<img width="369" height="800" alt="scrn2" src="https://github.com/user-attachments/assets/1084cdeb-dfde-4c26-bff2-7b4a00f830d0" />
<img width="369" height="800" alt="scr5" src="https://github.com/user-attachments/assets/43a6630a-de6a-4fd0-8553-c1871fcf0c26" />
<img width="369" height="800" alt="scr4" src="https://github.com/user-attachments/assets/823d40f0-9814-4eec-8952-81d7fd809936" />
<img width="369" height="800" alt="sc3" src="https://github.com/user-attachments/assets/b52b5c0a-c69f-4234-9ba7-752ca13aab7c" />

