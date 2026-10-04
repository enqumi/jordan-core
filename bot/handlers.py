import io
import logging

from PIL import Image
from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandStart
from aiogram.types import BufferedInputFile, CallbackQuery, InputMediaPhoto, Message

import keyboards as kb
import texts
from api import ApiUnavailable, shop

router = Router()
log = logging.getLogger(__name__)

CAPTION_LIMIT = 1024
photo_cache: dict[str, str] = {}



async def safe_delete(message: Message):
    try:
        await message.delete()
    except TelegramBadRequest:
        pass


async def show_text(callback: CallbackQuery, text: str, markup):
    message = callback.message
    if message.photo:
        await safe_delete(message)
        await message.answer(text, reply_markup=markup)
        return
    try:
        await message.edit_text(text, reply_markup=markup)
    except TelegramBadRequest as error:
        if "message is not modified" not in str(error):
            raise


def to_jpeg(data: bytes) -> bytes:
    image = Image.open(io.BytesIO(data)).convert("RGBA")
    canvas = Image.new("RGB", image.size, "white")
    canvas.paste(image, mask=image.getchannel("A"))
    out = io.BytesIO()
    canvas.save(out, format="JPEG", quality=90)
    return out.getvalue()


async def product_photo(product: dict):
    if file_id := photo_cache.get(product["id"]):
        return file_id
    data = to_jpeg(await shop.image(product["image"]))
    return BufferedInputFile(data, filename=f"{product['id']}.jpg")


def remember_photo(product: dict, message: Message | bool):
    if isinstance(message, Message) and message.photo:
        photo_cache[product["id"]] = message.photo[-1].file_id


def drop_view(products: list[dict], index: int):
    index %= len(products)
    product = products[index]
    caption = texts.product_caption(product, index, len(products))
    if len(caption) > CAPTION_LIMIT:
        caption = texts.product_caption({**product, "description": product["description"][:300] + "…"},
                                        index, len(products))
    markup = kb.drop_card(product, index, len(products), texts.is_released(product))
    return product, caption, markup



@router.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(texts.welcome(message.from_user.first_name), reply_markup=kb.main_menu())


@router.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(texts.HELP, reply_markup=kb.back_to_menu())


@router.message(Command("drops"))
async def cmd_drops(message: Message):
    try:
        products = await shop.products()
        if not products:
            await message.answer("Каталог пока пуст.", reply_markup=kb.back_to_menu())
            return
        product, caption, markup = drop_view(products, 0)
        sent = await message.answer_photo(await product_photo(product), caption=caption, reply_markup=markup)
        remember_photo(product, sent)
    except ApiUnavailable:
        await message.answer(texts.API_DOWN, reply_markup=kb.back_to_menu())


@router.message(Command("orders"))
async def cmd_orders(message: Message):
    try:
        data = await shop.user_orders(message.from_user.id)
    except ApiUnavailable:
        await message.answer(texts.API_DOWN, reply_markup=kb.back_to_menu())
        return
    await message.answer(texts.orders_list(data), reply_markup=kb.orders_menu(data["linked"]))



@router.callback_query(kb.Nav.filter())
async def on_nav(callback: CallbackQuery, callback_data: kb.Nav):
    screens = {
        "menu": (texts.welcome(callback.from_user.first_name), kb.main_menu()),
        "about": (texts.ABOUT, kb.back_to_menu()),
        "help": (texts.HELP, kb.back_to_menu()),
    }
    text, markup = screens.get(callback_data.to, screens["menu"])
    await show_text(callback, text, markup)
    await callback.answer()


@router.callback_query(kb.Drop.filter())
async def on_drop(callback: CallbackQuery, callback_data: kb.Drop):
    try:
        products = await shop.products()
        if not products:
            await callback.answer("Каталог пока пуст", show_alert=True)
            return
        product, caption, markup = drop_view(products, callback_data.index)
        photo = await product_photo(product)
    except ApiUnavailable:
        await show_text(callback, texts.API_DOWN, kb.back_to_menu())
        await callback.answer()
        return

    message = callback.message
    if message.photo:
        try:
            edited = await message.edit_media(InputMediaPhoto(media=photo, caption=caption), reply_markup=markup)
            remember_photo(product, edited)
        except TelegramBadRequest as error:
            if "message is not modified" not in str(error):
                raise
    else:
        await safe_delete(message)
        remember_photo(product, await message.answer_photo(photo, caption=caption, reply_markup=markup))
    await callback.answer()


@router.callback_query(kb.Orders.filter())
async def on_orders(callback: CallbackQuery, callback_data: kb.Orders):
    try:
        data = await shop.user_orders(callback.from_user.id)
    except ApiUnavailable:
        await callback.answer("Сервер магазина недоступен, попробуй позже", show_alert=True)
        return

    text, markup = texts.orders_list(data), kb.orders_menu(data["linked"])
    if callback_data.action == "new":
        await callback.message.answer(text, reply_markup=markup)
    else:
        await show_text(callback, text, markup)
    await callback.answer("Обновлено ✅" if callback_data.action == "refresh" else None)


@router.callback_query(F.data == kb.NOOP)
async def on_noop(callback: CallbackQuery):
    await callback.answer()


@router.callback_query()
async def on_stale(callback: CallbackQuery):
    await callback.answer("Это меню устарело — открываю новое", show_alert=False)
    await callback.message.answer(texts.welcome(callback.from_user.first_name), reply_markup=kb.main_menu())


@router.message()
async def on_unknown(message: Message):
    await message.answer(texts.UNKNOWN, reply_markup=kb.main_menu())
