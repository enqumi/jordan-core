import aiohttp

from config import API_URL, INTERNAL_API_KEY


class ApiUnavailable(Exception):
    pass


class ShopApi:
    def __init__(self):
        self._session: aiohttp.ClientSession | None = None

    @property
    def session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                base_url=API_URL,
                headers={"X-Internal-Key": INTERNAL_API_KEY},
                timeout=aiohttp.ClientTimeout(total=10),
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def _get(self, path: str):
        try:
            async with self.session.get(path) as response:
                response.raise_for_status()
                return await response.json()
        except (aiohttp.ClientError, TimeoutError) as error:
            raise ApiUnavailable(str(error)) from error

    async def products(self) -> list[dict]:
        products = await self._get("/api/products")
        return sorted(products, key=lambda p: p["releaseDate"] or "")

    async def user_orders(self, telegram_id: int) -> dict:
        return await self._get(f"/api/internal/telegram/{telegram_id}/orders")

    async def order_feed(self) -> list[dict]:
        return await self._get("/api/internal/telegram/feed")

    async def image(self, path: str) -> bytes:
        try:
            async with self.session.get("/" + path.removeprefix("./").lstrip("/")) as response:
                response.raise_for_status()
                return await response.read()
        except (aiohttp.ClientError, TimeoutError) as error:
            raise ApiUnavailable(str(error)) from error


shop = ShopApi()
