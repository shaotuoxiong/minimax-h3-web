import unittest
import gzip
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from aiohttp import ClientSession, WSMsgType, web
from aiohttp.test_utils import TestServer

import local_api_proxy


class WebSocketProxyTest(unittest.IsolatedAsyncioTestCase):
    async def test_node_definitions_are_compressed_without_changing_json(self):
        data = {"nodes": [{"name": "H3", "description": "video"}] * 5000}

        async def definitions(request):
            return web.json_response(data)

        backend = web.Application()
        backend.router.add_get("/api/object_info", definitions)
        proxy = web.Application()
        proxy.cleanup_ctx.append(local_api_proxy.session_context)
        proxy.router.add_get("/h3/api/object_info", local_api_proxy.handle)
        async with TestServer(backend) as backend_server:
            with patch.object(local_api_proxy, "UPSTREAM", str(backend_server.make_url(""))):
                async with TestServer(proxy) as proxy_server:
                    async with ClientSession() as session:
                        async with session.get(
                            proxy_server.make_url("/h3/api/object_info"),
                            headers={"Origin": "https://shaotuoxiong.github.io"},
                        ) as response:
                            self.assertEqual(response.status, 200)
                            self.assertIn(response.headers["Content-Encoding"], ["gzip", "deflate"])
                            self.assertIn("Origin", response.headers["Vary"])
                            self.assertIn("Accept-Encoding", response.headers["Vary"])
                            self.assertEqual(await response.json(), data)

    async def test_frontend_serves_build_without_exposing_other_directories(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            build = root / "frontend"
            build.mkdir()
            (build / "index.html").write_text("<html>H3 workbench</html>")
            (build / "assets").mkdir()
            (build / "assets" / "editor.js").write_text("export const h3 = true")
            (build / "assets" / "editor.js.gz").write_bytes(
                gzip.compress(b"export const h3 = true")
            )
            (root / "secret.txt").write_text("private")
            (build / "outside.txt").symlink_to(root / "secret.txt")
            frontend = web.Application()
            local_api_proxy.add_frontend_routes(frontend, build)
            async with TestServer(frontend) as server:
                async with ClientSession() as session:
                    async with session.get(server.make_url("/minimax-h3-web/")) as response:
                        self.assertEqual(response.status, 200)
                        self.assertEqual(response.headers["Cache-Control"], "no-cache")
                        self.assertIn("H3 workbench", await response.text())
                    async with session.get(server.make_url("/minimax-h3-web/assets/editor.js")) as response:
                        self.assertEqual(response.status, 200)
                        self.assertIn("javascript", response.headers["Content-Type"])
                        self.assertEqual(response.headers["Content-Encoding"], "gzip")
                        self.assertEqual(await response.text(), "export const h3 = true")
                    for path in ["assets/", "outside.txt", "../secret.txt"]:
                        async with session.get(server.make_url("/minimax-h3-web/" + path)) as response:
                            self.assertIn(response.status, [403, 404])

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
