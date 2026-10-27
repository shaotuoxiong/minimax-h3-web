import asyncio
import os
import hashlib
from datetime import datetime, timezone
from pathlib import Path


from aiohttp import ClientError, ClientSession, ClientTimeout, WSMsgType, web


UPSTREAM = "http://127.0.0.1:8188"
ALLOWED_ORIGINS = {
    "https://shaotuoxiong.github.io",
    "https://letdown-riverboat-flatware.ngrok-free.dev",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}
HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
}


OUTPUT_DIRECTORY = Path(os.getenv(
    "H3_OUTPUT_DIRECTORY", "/home/sim/minimax-h3/ComfyUI/output"
))


def list_output_videos(directory=OUTPUT_DIRECTORY):
    assets = []
    root = directory.resolve()
    for parent, directories, filenames in os.walk(root, followlinks=False):
        directories[:] = [name for name in directories if not (Path(parent) / name).is_symlink()]
        for name in filenames:
            path = Path(parent) / name
            if path.suffix.lower() != ".mp4" or path.is_symlink():
                continue
            try:
                stat = path.stat()
                if not path.is_file() or stat.st_size == 0:
                    continue
            except FileNotFoundError:
                continue
            relative = path.relative_to(root)
            timestamp = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat().replace("+00:00", "Z")
            assets.append({
                "id": "disk-video-" + hashlib.sha256(relative.as_posix().encode()).hexdigest(),
                "name": name,
                "size": stat.st_size,
                "created_at": timestamp,
                "updated_at": timestamp,
                "tags": ["output"],
                "user_metadata": {
                    "jobId": "",
                    "subfolder": relative.parent.as_posix() if relative.parent != Path(".") else "",
                },
            })
    return sorted(assets, key=lambda asset: (asset["created_at"], asset["name"]), reverse=True)


def add_frontend_routes(app, directory):
    async def index(request):
        return web.FileResponse(
            directory / "index.html", headers={"Cache-Control": "no-cache"}
        )

    app.router.add_get("/minimax-h3-web/", index)
    app.router.add_get("/minimax-h3-web/index.html", index)
    app.router.add_static(
        "/minimax-h3-web/", directory, show_index=False, follow_symlinks=False
    )


async def session_context(app):
    async with ClientSession(
        timeout=ClientTimeout(total=None, sock_connect=15),
        auto_decompress=False,
    ) as session:
        app["session"] = session
        yield


async def relay(source, destination):
    async for message in source:
        if message.type == WSMsgType.TEXT:
            await destination.send_str(message.data)
        elif message.type == WSMsgType.BINARY:
            await destination.send_bytes(message.data)
        elif message.type == WSMsgType.ERROR:
            break


async def handle(request):
    origin = request.headers.get("Origin")
    if origin and origin not in ALLOWED_ORIGINS:
        raise web.HTTPForbidden(text="This frontend origin is not allowed")
    cors = {}
    if origin:
        cors = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get(
                "Access-Control-Request-Headers", "Content-Type, Authorization, Comfy-User"
            ),
            "Vary": "Origin",
        }
    if request.method == "OPTIONS":
        return web.Response(status=204, headers=cors)
    if request.path == "/h3/api/h3/output-videos":
        if request.method != "GET":
            return web.Response(status=405, headers=cors)
        assets = await asyncio.to_thread(list_output_videos)
        return web.json_response(assets, headers={**cors, "Cache-Control": "no-store"})
    headers = {
        name: value for name, value in request.headers.items()
        if name.lower() not in HOP_HEADERS | {"host", "origin", "sec-fetch-site"}
    }
    session = request.app["session"]
    h3_request = request.path == "/h3" or request.path.startswith("/h3/")
    upstream = UPSTREAM if h3_request else "http://127.0.0.1:8081"
    path = request.raw_path.removeprefix("/h3") if h3_request else request.raw_path
    url = upstream + (path or "/")
    if request.headers.get("Upgrade", "").lower() == "websocket":
        websocket_headers = {
            name: value for name, value in headers.items()
            if not name.lower().startswith("sec-websocket-")
        }
        async with session.ws_connect(url, headers=websocket_headers, max_msg_size=0, heartbeat=20) as backend:
            frontend = web.WebSocketResponse(max_msg_size=0, heartbeat=20)
            frontend.headers.update(cors)
            await frontend.prepare(request)
            tasks = [
                asyncio.create_task(relay(frontend, backend)),
                asyncio.create_task(relay(backend, frontend)),
            ]
            try:
                done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task.result()
            finally:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                await frontend.close()
            return frontend
    try:
        backend_response = await session.request(
            request.method, url, headers=headers,
            data=request.content if request.can_read_body else None,
            allow_redirects=False,
        )
    except ClientError:
        return web.Response(status=502, text="Local upstream is unavailable", headers=cors)
    async with backend_response as backend:
        response_headers = {
            name: value for name, value in backend.headers.items()
            if name.lower() not in HOP_HEADERS and not name.lower().startswith("access-control-")
        }
        response_headers.update(cors)
        response = web.StreamResponse(status=backend.status, headers=response_headers)
        if (
            backend.content_type == "application/json"
            and "Content-Encoding" not in backend.headers
        ):
            response.enable_compression()
            response.headers["Vary"] = ", ".join(
                filter(None, [response.headers.get("Vary"), "Accept-Encoding"])
            )
        await response.prepare(request)
        async for chunk in backend.content.iter_chunked(65536):
            await response.write(chunk)
        await response.write_eof()
        return response


app = web.Application(client_max_size=100 * 1024**2)
app.cleanup_ctx.append(session_context)
frontend_directory = Path(__file__).parent / "frontend"
if (frontend_directory / "index.html").is_file():
    add_frontend_routes(app, frontend_directory)
app.router.add_route("*", "/{path:.*}", handle)
if __name__ == "__main__":
    web.run_app(app, host="127.0.0.1", port=int(os.getenv("H3_PROXY_PORT", "8189")))
