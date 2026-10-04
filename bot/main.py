import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError
from aiogram.types import BotCommand, LinkPreviewOptions, MenuButtonCommands, MenuButtonWebApp, WebAppInfo

import keyboards as kb
import texts
from api import ApiUnavailable, shop
from config import BOT_TOKEN, NOTIFY_INTERVAL_SECONDS, WEBAPP_ENABLED, WEBAPP_URL
from handlers import router

log = logging.getLogger("jordan_bot")

COMMANDS = [
    BotCommand(command="start", description="Главное меню"),
    BotCommand(command="drops", description="Каталог дропов"),
    BotCommand(command="orders", description="Мои заказы"),
    BotCommand(command="help", description="Помощь"),
]


async def setup_bot(bot: Bot):
    await bot.set_my_commands(COMMANDS)
    menu = (MenuButtonWebApp(text="Магазин", web_app=WebAppInfo(url=WEBAPP_URL + "/"))
            if WEBAPP_ENABLED else MenuButtonCommands())
    await bot.set_chat_menu_button(menu_button=menu)
    await bot.set_my_short_description("Релизы Air Jordan: каталог, заказ в Mini App и статусы покупок.")


async def notify_orders(bot: Bot):
    seen: set[tuple[int, str]] = set()
    primed = False
    while True:
        try:
            feed = await shop.order_feed()
            for order in feed:
                key = (order["id"], order["status"])
                if key in seen:
                    continue
                seen.add(key)
                if not primed:
                    continue
                text = texts.order_created(order) if order["status"] == "processing" else texts.order_ready(order)
                try:
                    await bot.send_message(order["telegramId"], text, reply_markup=kb.notification())
                except TelegramAPIError as error:
                    log.warning("Не удалось уведомить %s: %s", order["telegramId"], error)
            primed = True
            live = {(o["id"], o["status"]) for o in feed}
            seen &= live
        except ApiUnavailable as error:
            log.warning("API недоступен: %s", error)
        await asyncio.sleep(NOTIFY_INTERVAL_SECONDS)


async def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if not BOT_TOKEN:
        log.error("BOT_TOKEN не задан — бот не запущен. Укажите токен в .env и выполните `docker compose up -d bot`.")
        return
    if not WEBAPP_ENABLED:
        log.warning("WEBAPP_URL не задан или не https:// — кнопки Mini App скрыты.")

    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(
        parse_mode=ParseMode.HTML,
        link_preview=LinkPreviewOptions(is_disabled=True),
    ))
    dp = Dispatcher()
    dp.include_router(router)

    await setup_bot(bot)
    worker = asyncio.create_task(notify_orders(bot))
    try:
        await dp.start_polling(bot)
    finally:
        worker.cancel()
        await shop.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
