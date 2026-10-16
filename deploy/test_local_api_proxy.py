import unittest
from unittest.mock import patch

from aiohttp import ClientSession, WSMsgType, web
from aiohttp.test_utils import TestServer

import local_api_proxy


class WebSocketProxyTest(unittest.IsolatedAsyncioTestCase):
    async def test_browser_compression_and_messages_survive_both_handshakes(self):
        async def upstream(request):
            self.assertNotIn("Sec-WebSocket-Extensions", request.headers)
            socket = web.WebSocketResponse()
            await socket.prepare(request)
            await socket.send_json({"type": "status"})
            async for message in socket:
                if message.type == WSMsgType.TEXT:
                    await socket.send_str(message.data)
                elif message.type == WSMsgType.BINARY:
                    await socket.send_bytes(message.data)
            return socket

        backend = web.Application()
        backend.router.add_get("/ws", upstream)
        proxy = web.Application()
        proxy.cleanup_ctx.append(local_api_proxy.session_context)
        proxy.router.add_get("/h3/ws", local_api_proxy.handle)
        async with TestServer(backend) as backend_server:
            with patch.object(local_api_proxy, "UPSTREAM", str(backend_server.make_url(""))):
                async with TestServer(proxy) as proxy_server:
                    async with ClientSession() as session:
                        async with session.ws_connect(
                            proxy_server.make_url("/h3/ws"),
                            compress=15,
                            origin="https://shaotuoxiong.github.io",
                        ) as socket:
                            self.assertEqual(await socket.receive_json(), {"type": "status"})
                            flags = {"type": "feature_flags", "data": {}}
                            await socket.send_json(flags)
                            self.assertEqual(await socket.receive_json(), flags)
                            await socket.send_bytes(b"preview")
                            message = await socket.receive()
                            self.assertEqual(message.type, WSMsgType.BINARY)
                            self.assertEqual(message.data, b"preview")
                            self.assertFalse(socket.closed)


if __name__ == "__main__":
    unittest.main()
