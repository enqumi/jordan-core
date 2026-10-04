from urllib.parse import quote

from aiogram.filters.callback_data import CallbackData
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

from config import WEBAPP_ENABLED, WEBAPP_URL


class Nav(CallbackData, prefix="nav"):
    to: str


class Drop(CallbackData, prefix="drop"):
    index: int


class Orders(CallbackData, prefix="orders"):
    action: str


NOOP = "noop"


def shop_button(text: str = "🛍 Открыть магазин", product_id: str | None = None) -> InlineKeyboardButton | None:
    if not WEBAPP_ENABLED:
        return None
    url = WEBAPP_URL + (f"/?product={quote(product_id)}" if product_id else "/")
    return InlineKeyboardButton(text=text, web_app=WebAppInfo(url=url))


def main_menu() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    if button := shop_button():
        kb.row(button)
    kb.row(
        InlineKeyboardButton(text="👟 Дропы", callback_data=Drop(index=0).pack()),
        InlineKeyboardButton(text="📦 Мои заказы", callback_data=Orders(action="show").pack()),
    )
    kb.row(
        InlineKeyboardButton(text="ℹ️ О магазине", callback_data=Nav(to="about").pack()),
        InlineKeyboardButton(text="🆘 Помощь", callback_data=Nav(to="help").pack()),
    )
    return kb.as_markup()


def drop_card(product: dict, index: int, total: int, released: bool) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(
        InlineKeyboardButton(text="◀️", callback_data=Drop(index=(index - 1) % total).pack()),
        InlineKeyboardButton(text=f"{index + 1} / {total}", callback_data=NOOP),
        InlineKeyboardButton(text="▶️", callback_data=Drop(index=(index + 1) % total).pack()),
    )
    buy_text = f"🛒 Купить за ${product['retailPrice']}" if released else "🔔 Смотреть в магазине"
    if button := shop_button(buy_text, product["id"]):
        kb.row(button)
    kb.row(InlineKeyboardButton(text="⬅️ В меню", callback_data=Nav(to="menu").pack()))
    return kb.as_markup()


def orders_menu(linked: bool) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    if linked:
        kb.row(InlineKeyboardButton(text="🔄 Обновить", callback_data=Orders(action="refresh").pack()))
    if button := shop_button("🛍 В магазин"):
        kb.row(button)
    kb.row(InlineKeyboardButton(text="⬅️ В меню", callback_data=Nav(to="menu").pack()))
    return kb.as_markup()


def back_to_menu() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton(text="⬅️ В меню", callback_data=Nav(to="menu").pack()))
    return kb.as_markup()


def notification() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton(text="📦 Мои заказы", callback_data=Orders(action="new").pack()))
    if button := shop_button("🛍 Магазин"):
        kb.row(button)
    return kb.as_markup()
