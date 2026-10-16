# H3 视频生成网页

- 网站：https://shaotuoxiong.github.io/minimax-h3-web/
- 仓库：https://github.com/shaotuoxiong/minimax-h3-web
- 生产 API：https://letdown-riverboat-flatware.ngrok-free.dev/h3
- 发布前端：完整 ComfyUI Vue 节点编辑器，包含工作流画布、节点设置和生成队列。
- 启动诊断在模块脚本之前运行，显示资源加载、脚本错误、API 状态和超时信息。
- 媒体连接使用可选 Service Worker，在后台初始化，不阻塞工作台启动；API 请求可直接连接。
- 本机模型后端仍为 ComfyUI，监听 `127.0.0.1:8188`。
- 分流器监听 `127.0.0.1:8189`，`/h3/` 转发 ComfyUI，其余路径保留原聊天网关 `127.0.0.1:8081`。

GitHub Pages 只发布构建后的静态前端。Python、ngrok 凭据、输入照片和视频及模型权重留在 Ubuntu。
前端环境变量是公开配置，不能存放密钥。现有 ngrok 固定域名继续使用，无需申请新域名。

## 使用

首页直接加载原版完整工作台中的 H3 文生视频工作流，桌面展开工作流列表。不自动弹出模板库。点击「模板」仅显示 H3 文生视频、图生视频两个已配置模板，封面和 JSON 随前端发布；不预加载其他模型模板、节点模板目录或全局子图。
`?view=assets` 可直接打开素材库。素材库保留已生成/已导入分类、搜索与查看等原有功能。
模板封面通过带隧道请求头的 fetch 下载并使用 Blob 预览，不依赖 Service Worker；远程媒体刷新错误 HTTP 缓存，并拒绝将 HTML 提示页作为图片缓存。
素材库沿用原有已公开接口，未启用额外的 input/output/models 全目录索引。已有生成记录取决于后端现有历史，重启前的文件不会自动回填历史列表。
图生视频工作流可从 ComfyUI 工作流列表打开，或导入 `public/workflows/H3-I2V-lowvram.json`。
保留低显存模型、CPU offload 和 batch 1。完整编辑器通过 HTTPS API 和 WebSocket 连接本机后端。
若启动失败，底部显示错误和连接详情；可复制详情排查，而不再只显示加载标志。
实际安卓微信兼容性仍需在用户设备验证。

本机原版入口：http://127.0.0.1:8188/ ，原版前端版本为 1.55.17。Pages 保留同版本完整界面。H3 默认工作流已消除节点重叠，首次打开时自动适配画布，旧页面首次更新时会修正仍保持默认位置的节点并调整视角，保留提示词和参数；后续保留用户自己的视角。图生视频导入文件同样自动适配窗口。

## 启动本地服务

```bash
bash /home/sim/projects/minimax-h3-web/deploy/start-public.sh
```

启动脚本会安装并启动用户级 `h3-comfyui.service`，让原 ComfyUI 启动命令在后台持续运行。日志仍保存在原 logs 目录。
分流器分别处理两端的 WebSocket 握手，避免转发浏览器压缩协商参数导致连接立即关闭；两端每 20 秒发送心跳。前端沿用原版自动重连机制，重连不重新提交生成任务。
电脑、网络、ComfyUI、分流器和 ngrok 需要保持在线。电脑离线时网页仍会显示，但不能生成视频。

```bash
systemctl --user status h3-comfyui.service h3-api-router.service
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
PAGES_BASE_PATH=/minimax-h3-web/ ENABLE_MINIFY=true pnpm build
PAGES_BASE_PATH=/minimax-h3-web/ pnpm preview --host 127.0.0.1 --port 4173
```

`pnpm build` 检查完整编辑器类型，再通过 `vite.config.mts` 构建。
`.env.production` 中 `VITE_H3_ONLY=true` 启用 H3 专用目录，并配置公开的生产 API；开发环境通过 `.env.local` 指向本机分流器。
开发命令为 `pnpm dev`。Pages Actions 使用仓库实际 base 路径构建并发布 dist。
`pnpm build:mobile` 保留旧轻量页面的独立构建方式，不用于当前 Pages 首页。

上游 ComfyUI_frontend 源码和 GPL-3.0 许可保留在仓库中。
