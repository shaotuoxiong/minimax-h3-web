# MiniMax H3 公网前端

- 网站：https://shaotuoxiong.github.io/minimax-h3-web/
- 仓库：https://github.com/shaotuoxiong/minimax-h3-web
- 生产 API：https://letdown-riverboat-flatware.ngrok-free.dev/h3
- 前端：官方 ComfyUI_frontend v1.55.17，Vue 3、TypeScript、Vite、pnpm。
- 本地 ComfyUI：`/home/sim/minimax-h3/ComfyUI`，监听 `127.0.0.1:8188`。
- 本地分流器：`127.0.0.1:8189`，`/h3/` 转发 ComfyUI，其余路径转发原聊天网关 `127.0.0.1:8081`。

GitHub Pages 只发布 `dist/`；Python 服务、ngrok 凭据、输入图片、生成视频和模型权重留在 Ubuntu。
前端环境变量是公开配置，不能放密钥。
域名复用了已有 ngrok 固定开发域名，未新申请域名。

## 日常启动

```bash
bash /home/sim/projects/minimax-h3-web/deploy/start-public.sh
```

脚本检查并按需启动本机 ComfyUI，启动用户级 API 分流服务，并确保 ngrok 使用分流配置。
Ubuntu 电脑、网络、ComfyUI、分流器和 ngrok 都需保持在线，才能生成视频。
Pages 静态页面在电脑离线时仍可打开，模型接口会不可用。

```bash
systemctl --user status h3-api-router.service
journalctl --user -u h3-api-router.service -n 50
docker logs --tail 50 ninfer-chat-ngrok
```

原聊天入口的启停脚本会使用原 Compose 配置；之后运行上面的 H3 启动命令可恢复分流配置。
停止 H3 分流之前，先恢复 ngrok 原来的聊天目标：

```bash
docker compose -f /home/sim/models/ninfer-chat-web/compose.public.yml up -d --no-deps ngrok
systemctl --user stop h3-api-router.service
```

## 使用工作流

在 ComfyUI 左侧工作流列表打开 `H3-T2V-lowvram` 或 `H3-I2V-lowvram`。
这些文件保存在本机 ComfyUI 用户目录，通过 API 读取。
先使用已验证的 480p、56 帧、batch 1 设置。
生成期间避免同时运行占用大量显存的其他模型。

## 构建与发布

沿用上游的 pnpm 锁文件和工作区，不改用 npm 重新解析依赖。
需要 Node 26.12.0、pnpm 11.13.1。

```bash
pnpm install --frozen-lockfile
PAGES_BASE_PATH=/minimax-h3-web/ ENABLE_MINIFY=true GENERATE_SOURCEMAP=false pnpm build
PAGES_BASE_PATH=/minimax-h3-web/ pnpm preview --host 127.0.0.1 --port 4173
```

`.env.local` 保存本地开发 API；`.env.production` 保存公开的生产 API 地址。
前端 API、媒体和 WebSocket 使用独立后端地址；静态资源使用 Pages 仓库路径，路由使用 hash。
浏览器 Service Worker 仅为配置的 ngrok 后端路径添加官方支持的提示页跳过请求头，覆盖 API、图片和视频；不缓存模型请求或视频。
使用普通 Service Worker 兼容内置浏览器；不支持、注册失败或超过 5 秒时，界面继续启动，API 使用直接请求。此时媒体预览仍取决于浏览器对 ngrok 的支持。
推送 `main` 后，`.github/workflows/deploy.yml` 自动构建并通过 GitHub 官方 Pages Actions 发布。
该仓库保留上游 GPL-3.0 许可及源码；上游发布、定时维护工作流未启用。

Cloudflare 测试的 DNS 和 7844/TLS 连接失败日志保存在本机 `../minimax-h3-tools/logs/`。
最终使用用户授权复用的 ngrok 入口，没有启用 Pinggy。
