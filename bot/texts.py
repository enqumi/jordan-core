from datetime import date, datetime
from html import escape

from config import WEBAPP_ENABLED

MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
          "июля", "августа", "сентября", "октября", "ноября", "декабря"]

STATUS = {
    "processing": "🟡 Собираем",
    "ready": "🟢 Готов к отправке",
}


def usd(value: int | None) -> str:
    return f"${value:,}".replace(",", " ") if value is not None else "—"


def human_date(iso: str) -> str:
    d = date.fromisoformat(iso[:10])
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def is_released(product: dict) -> bool:
    return date.fromisoformat(product["releaseDate"]) <= date.today()


def welcome(first_name: str) -> str:
    shop_hint = (
        "Жми <b>«🛍 Открыть магазин»</b> — каталог, корзина и оформление заказа прямо в Telegram."
        if WEBAPP_ENABLED else
        "<i>Mini App пока не подключён: администратору нужно указать WEBAPP_URL.</i>"
    )
    return (
        f"<b>JORDAN // CORE</b>\n"
        f"<i>Flight Above All</i>\n\n"
        f"Привет, <b>{escape(first_name)}</b>! 👋\n"
        f"Здесь самые горячие релизы Air Jordan: коллаборации и ретро.\n\n"
        f"{shop_hint}\n\n"
        f"👟 <b>Дропы</b> — листай пары и цены\n"
        f"📦 <b>Мои заказы</b> — статусы покупок\n"
        f"🔔 Уведомления о заказах приходят сюда автоматически"
    )


def product_caption(product: dict, index: int, total: int) -> str:
    released = is_released(product)
    lines = [
        f"<b>{escape(product['name'])}</b>",
        f"<i>«{escape(product['nickname'])}»</i>",
        "",
        f"🏷 {escape(product['category'])}" + (f" · <b>{escape(product['badge'])}</b>" if product.get("badge") else ""),
        f"💵 Ретейл: <b>{usd(product['retailPrice'])}</b>",
    ]
    if product.get("marketPrice"):
        lines.append(f"📈 Ресейл: <b>{usd(product['marketPrice'])}</b>")
    if product.get("sku"):
        lines.append(f"🔢 Артикул: <code>{escape(product['sku'])}</code>")
    lines.append(
        f"📅 Вышел {human_date(product['releaseDate'])}" if released
        else f"⏳ Релиз <b>{human_date(product['releaseDate'])}</b> — покупка откроется в день дропа"
    )
    lines += ["", f"<blockquote expandable>{escape(product['description'])}</blockquote>"]
    return "\n".join(lines)


def orders_list(data: dict) -> str:
    if not data["linked"]:
        return (
            "<b>📦 Мои заказы</b>\n\n"
            "Пока здесь пусто: аккаунт создаётся при первом входе в магазин.\n"
            + ("Открой <b>🛍 магазин</b>, выбери пару — и заказ появится здесь."
               if WEBAPP_ENABLED else "Mini App ещё не подключён администратором.")
        )
    orders = data["orders"]
    if not orders:
        return (
            f"<b>📦 Мои заказы</b>\n\n"
            f"{escape(data['user']['name'])}, заказов пока нет.\n"
            f"Самое время забрать первую пару 👟"
        )

    blocks = [f"<b>📦 Мои заказы</b> · последние {len(orders)}"]
    for order in orders:
        items = "\n".join(f"  • {escape(i['name'])} «{escape(i['nickname'])}» — {usd(i['price'])}"
                          for i in order["items"])
        blocks.append(
            f"<b>Заказ #{order['id']}</b> — {STATUS.get(order['status'], order['status'])}\n"
            f"{items}\n"
            f"  📍 {escape(order['city'])}, {escape(order['country'])}\n"
            f"  💳 {escape(order['card']['brand'])} •• {escape(order['card']['last4'])}"
            f" · <b>{usd(order['total'])}</b>"
        )
    updated = datetime.now().strftime("%H:%M:%S")
    return "\n\n".join(blocks) + f"\n\n<i>Обновлено в {updated}</i>"


def order_created(order: dict) -> str:
    items = "\n".join(f"• {escape(i['name'])} «{escape(i['nickname'])}»" for i in order["items"])
    return (
        f"✅ <b>Заказ #{order['id']} оформлен!</b>\n\n"
        f"{items}\n\n"
        f"📍 {escape(order['address'])}, {escape(order['city'])}, {escape(order['country'])}\n"
        f"💳 {escape(order['card']['brand'])} •• {escape(order['card']['last4'])}\n"
        f"💵 Итого: <b>{usd(order['total'])}</b>\n\n"
        f"Мы уже собираем посылку — напишу, когда она будет готова."
    )


def order_ready(order: dict) -> str:
    return (
        f"🟢 <b>Заказ #{order['id']} собран</b> и готов к отправке в "
        f"<b>{escape(order['city'])}</b>!\n"
        f"Сумма: <b>{usd(order['total'])}</b>"
    )


ABOUT = (
    "<b>ℹ️ О магазине</b>\n\n"
    "<b>JORDAN // CORE</b> — учебный концепт-стор релизов Air Jordan.\n\n"
    "<b>Как устроен проект</b> (Docker Compose):\n"
    "• <code>db</code> — PostgreSQL 15\n"
    "• <code>api</code> — FastAPI + сайт\n"
    "• <code>bot</code> — этот бот (aiogram)\n"
    "• <code>miniapp</code> — React Mini App на nginx\n\n"
    "🚚 Доставка: Казахстан, Кыргызстан, Узбекистан и ещё 7 стран.\n"
    "<i>Платежи демонстрационные — реальные деньги не списываются.</i>"
)

HELP = (
    "<b>🆘 Помощь</b>\n\n"
    "/start — главное меню\n"
    "/drops — каталог дропов\n"
    "/orders — мои заказы\n"
    "/help — эта справка\n\n"
    "Кнопка <b>«Магазин»</b> слева от поля ввода открывает Mini App в любой момент."
)

UNKNOWN = "Не понял 🤔 Выбери действие кнопками ниже или набери /help."
API_DOWN = "⚠️ <b>Сервер магазина недоступен.</b>\nПопробуй чуть позже."
