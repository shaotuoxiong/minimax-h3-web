# H3 视频生成网页

- 网站：https://shaotuoxiong.github.io/minimax-h3-web/
- 仓库：https://github.com/shaotuoxiong/minimax-h3-web
- 生产 API：https://letdown-riverboat-flatware.ngrok-free.dev/h3
- 发布前端：普通 HTML、CSS、TypeScript 编译的经典脚本。首页先显示，再后台连接 API。
- 不加载完整 ComfyUI 编辑器，不使用 Service Worker、WebSocket、模块脚本或动态导入。
- 本机模型后端仍为 ComfyUI，监听 `127.0.0.1:8188`。
- 分流器监听 `127.0.0.1:8189`，`/h3/` 转发 ComfyUI，其余路径保留原聊天网关 `127.0.0.1:8081`。

GitHub Pages 只发布 `dist/index.html`、`style.css`、`app.js`。Python、ngrok 凭据、输入照片和视频及模型权重留在 Ubuntu。
前端环境变量是公开配置，不能存放密钥。现有 ngrok 固定域名继续使用，无需申请新域名。

## 使用

输入提示词后点击“生成视频”进行文生视频。选择 JPG、PNG 或 WebP 照片后进行图生视频。
单张照片最多 10 MB。使用已验证的 56 帧、20 步、batch 1 和低显存模型；文生视频 864×480，图生视频 768×512。

通过 HTTP 轮询查看任务，不需要 WebSocket。视频通过带请求头的 fetch 下载为浏览器 Blob，再预览或保存，不依赖 Service Worker。
本浏览器保存待完成任务和最后一个结果的文件描述，刷新后可恢复；不保存照片内容或视频 Blob。
暂时断网时可点“重新连接”继续查看任务，不会自动重复提交生成。

## 启动本地服务

```bash
bash /home/sim/projects/minimax-h3-web/deploy/start-public.sh
```

电脑、网络、ComfyUI、分流器和 ngrok 需要保持在线。电脑离线时网页仍会显示，但不能生成视频。

```bash
systemctl --user status h3-api-router.service
journalctl --user -u h3-api-router.service -n 50
docker logs --tail 50 ninfer-chat-ngrok
```

原聊天启动脚本会使用原 Compose 配置；之后再次执行 H3 启动命令可恢复分流。
恢复只有原聊天入口时运行：

```bash
docker compose -f /home/sim/models/ninfer-chat-web/compose.public.yml up -d --no-deps ngrok
systemctl --user stop h3-api-router.service
```

## 构建和发布

沿用现有 pnpm 锁文件，使用 Node 26.12.0、pnpm 11.13.1。

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview --host 127.0.0.1 --port 4173
```

`pnpm build` 检查 `mobile/tsconfig.json`，再用 `vite.mobile.config.mts` 构建轻量页面。
`.env.production` 配置公开的生产 API；开发环境通过 `.env.local` 指向本机分流器。
开发命令为 `pnpm dev`。静态文件使用相对路径，支持 GitHub Pages 仓库子路径。
推送 main 后，`.github/workflows/deploy.yml` 使用 GitHub 官方 Pages Actions 发布 dist。

完整编辑器仍可在本机 http://127.0.0.1:8188 使用；上游 ComfyUI_frontend 源码和 GPL-3.0 许可保留在仓库中，`build:editor` 仅供单独构建编辑器，不用于 Pages 发布。
