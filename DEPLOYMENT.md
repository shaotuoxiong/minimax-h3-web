# H3 视频生成网页

- GitHub Pages：https://shaotuoxiong.github.io/minimax-h3-web/
- 固定域名完整工作台：https://h3.yakiyyy.online:47863/minimax-h3-web/
- 仓库：https://github.com/shaotuoxiong/minimax-h3-web
- 生产 API：https://h3.yakiyyy.online:47863/h3
- 发布前端：完整 ComfyUI Vue 节点编辑器，包含工作流画布、节点设置和生成队列。
- 启动诊断在模块脚本之前运行，显示资源加载、脚本错误、API 状态和超时信息。
- 媒体连接使用可选 Service Worker，在后台初始化，不阻塞工作台启动；API 请求可直接连接。
- 本机模型后端仍为 ComfyUI，监听 `127.0.0.1:8188`。
- 分流器监听 `127.0.0.1:8189`，`/h3/` 转发 ComfyUI，其余路径保留原聊天网关 `127.0.0.1:8081`。

GitHub Pages 只发布构建后的静态前端。Python、DNS 凭据、输入照片和视频及模型权重留在 Ubuntu。
前端环境变量是公开配置，不能存放密钥。生产 API 已切换到自有域名直连。

## 使用

首页直接加载原版完整工作台中的 H3 文生视频工作流，桌面展开工作流列表。不自动弹出模板库。点击「模板」显示 H3 文生视频、图生视频、双图参考生视频和九图参考生视频四个已配置模板，封面和 JSON 随前端发布；不预加载其他模型模板、节点模板目录或全局子图。
`?view=assets` 可直接打开素材库。素材库保留已生成/已导入分类、搜索与查看等原有功能。
模板封面通过带隧道请求头的 fetch 下载并使用 Blob 预览，不依赖 Service Worker；远程媒体刷新错误 HTTP 缓存，并拒绝将 HTML 提示页作为图片缓存。
素材库通过只读输出视频列表补充历史记录，重启后仍显示磁盘中的 MP4；未启用 input/output/models 全目录索引。
图生视频工作流可从 ComfyUI 工作流列表打开，或导入 `public/workflows/H3-I2V-lowvram.json`。
保留低显存模型、CPU offload 和 batch 1。完整编辑器通过 HTTPS API 和 WebSocket 连接本机后端。
部署更新后若缓存页面引用已删除的动态脚本，启动诊断会带新查询参数自动刷新一次；一分钟内不重复重试，避免刷新循环。手动重试按钮同样绕过旧首页缓存。
若启动失败，底部显示错误和连接详情；可复制详情排查，而不再只显示加载标志。
实际安卓微信兼容性仍需在用户设备验证。

## 多图参考实测（2026-10-20）

多图参考使用 `minimax_h3_ref2va_pruned_int8_convrot.safetensors`，与单图/文生视频的
`fl2va` 权重分开。复用现有 Qwen3-VL 量化文本编码器和音视频 VAE。
Ref2VA 文件已通过官方 SHA256 校验。测试使用九张不同的婚礼图片。

固定条件：RTX 4090 24GB、32GB RAM，864×480、124 帧（约 5.2 秒）、24fps、
20 步、`ref_image_size=match`、batch 1、单任务、VAE 分块解码。

| 参考图片 | 成功次数                       | 耗时       |
| -------- | ------------------------------ | ---------- |
| 2 张     | 1                              | 98 秒      |
| 4 张     | 1                              | 111 秒     |
| 6 张     | 1                              | 125 秒     |
| 9 张     | 3 个不同随机种子，含一次冷启动 | 151–153 秒 |

调整内存策略后的六次生成均无新增 Swap 写入；全卡最高显存约 21.4 GiB，
系统最高已用内存约 12.6 GiB。资源按一秒间隔采样，显存包含桌面等其他进程。
这个结果不代表更高分辨率、更长视频、`max` 参考图尺寸或并发生成也能稳定运行。

首次测试曾因 Swap 活动触发保护而中止。用户服务现设置 `MemoryHigh=20G`，
优先触发服务内存回收，并用 `MemorySwapMax=0` 禁止 H3 匿名内存换出。
CPU 卸载和 SSD 模型加载继续启用。服务配置更新后，在没有生成任务时执行：

```bash
install -Dm644 deploy/h3-comfyui.service ~/.config/systemd/user/h3-comfyui.service
systemctl --user daemon-reload
systemctl --user restart h3-comfyui.service
```

模板文件为 `public/workflows/H3-R2V-lowvram.json`（双图）和
`public/workflows/H3-R2V-9refs-lowvram.json`（九图）。分别上传每张参考图，
用 `<Picture 1>`、`<Picture 2>` 等在提示词中指定用途；更换素材后同步修改提示词。
示例人物图为 Phil Warren 的 [Bride Portrait](https://commons.wikimedia.org/wiki/File:Bride_Portrait.jpg)，
采用 [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/)，生成视频属于 AI 改编。

本机原版入口：http://127.0.0.1:8188/ ，原版前端版本为 1.55.17。Pages 保留同版本完整界面。H3 默认工作流已消除节点重叠，首次打开时自动适配画布，旧页面首次更新时会修正仍保持默认位置的节点并调整视角，保留提示词和参数；后续保留用户自己的视角。图生视频导入文件同样自动适配窗口。

域名入口提供同一份构建后的完整工作台，页面和 API 使用同一域名，不依赖 GitHub Pages 下载编辑器脚本。分流器仅从 `deploy/frontend/` 提供静态构建，禁止目录列表及目录外符号链接。新 HTTPS 入口只公开 H3 和工作台；原聊天配置保留。

更新此入口时，先完成构建与验证，再复制构建产物。静态文件原子更新，首页最后替换，无需重启分流器：

```bash
python3 deploy/publish_frontend.py
```

修改分流器代码时才需要 `systemctl --user restart h3-api-router.service`。

分流器对未压缩的 JSON 响应协商压缩，减少节点定义等必需接口的传输量；已压缩的响应不重复压缩。
发布脚本为文本资源生成 gzip 副本，文件逐个原子替换，最后更新首页；首页要求重新校验缓存。30 秒仍在加载时提示网络较慢，90 秒仍未完成时显示诊断。

`deploy/frontend/` 不提交 Git。保留之前的静态资源，避免已打开页面引用的旧脚本立即失效。

## 启动本地服务

```bash
bash /home/sim/projects/minimax-h3-web/deploy/start-public.sh
```

启动脚本会安装并启动用户级 `h3-comfyui.service`，让原 ComfyUI 启动命令在后台持续运行。日志仍保存在原 logs 目录。
分流器分别处理两端的 WebSocket 握手，避免转发浏览器压缩协商参数导致连接立即关闭；两端每 20 秒发送心跳。前端沿用原版自动重连机制，重连不重新提交生成任务。
电脑、路由器、ComfyUI、分流器和 HTTPS 服务需要保持在线。GitHub Pages 前端独立托管，电脑离线时不能生成或访问本机视频。

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
H3_COMPACT_BUNDLE=true PAGES_BASE_PATH=/minimax-h3-web/ ENABLE_MINIFY=true pnpm build
PAGES_BASE_PATH=/minimax-h3-web/ pnpm preview --host 127.0.0.1 --port 4173
```

`H3_COMPACT_BUNDLE=true` 合并编辑器核心模块，减少慢连接下的脚本请求，其他功能继续按需加载。启动时直接读取 H3 公开配置，避免配置模块与编辑器 API 循环等待。
`pnpm build` 检查完整编辑器类型，再通过 `vite.config.mts` 构建。
`.env.production` 中 `VITE_H3_ONLY=true` 启用 H3 专用目录，并配置公开的生产 API；开发环境通过 `.env.local` 指向本机分流器。
开发命令为 `pnpm dev`。Pages Actions 使用仓库实际 base 路径构建并发布 dist。
`pnpm build:mobile` 保留旧轻量页面的独立构建方式，不用于当前 Pages 首页。

上游 ComfyUI_frontend 源码和 GPL-3.0 许可保留在仓库中。

### 重启后保留生成视频列表

H3 的「媒体资产 → 已生成」会合并实时任务历史与输出目录中的 MP4，按完整相对路径去重。历史清空或后端重启不会让磁盘中的视频从素材库消失。重新打开素材库或刷新列表时会扫描新文件；扫描只读取文件信息，不加载视频内容或模型。

本地代理提供只读 `GET /h3/api/h3/output-videos`，默认扫描 `/home/sim/minimax-h3/ComfyUI/output`，可用代理环境变量 `H3_OUTPUT_DIRECTORY` 配置。跳过空文件、符号链接及其他文件类型，继续使用现有 ComfyUI `/view` 播放和下载。此列表恢复视频文件，不伪造已经丢失的任务历史；仍存有历史的作品保留原任务信息。

代理实现位于 `deploy/local_api_proxy.py`。更新 Python 代码后，在没有生成任务时重启 `h3-api-router.service`；不需要重启模型服务。验证命令：`python -m unittest discover -s deploy -p 'test_*videos.py'` 和 `python -m unittest discover -s deploy -p 'test_*proxy.py'`。

本机入口：`http://127.0.0.1:8189/minimax-h3-web/?view=assets`。在代理的本机端口打开时，前端直接使用同源 `/h3` API，不依赖 ngrok 或公网；GitHub Pages 继续使用配置的公网 API。

### 域名 HTTPS 直连

完整工作台：`https://h3.yakiyyy.online:47863/minimax-h3-web/`。
生产 API：`https://h3.yakiyyy.online:47863/h3`。
GitHub Pages 保留 `https://shaotuoxiong.github.io/minimax-h3-web/`，连接相同生产 API。

宽带拥有公网 IPv4，标准 TCP 80/443 的外部对照测试超时，高端口可用。
因此地址中的 `:47863` 必须保留。路由器将 TCP 47863 转发到本机 8443，
Caddy 再转发到 127.0.0.1:8189。新入口只开放 `/h3/*`、
`/minimax-h3-web/*` 和根路径跳转，其他路径返回 404。

2026-10-28 域名 clientHold 已解除，公共 DNS 返回正确 A 记录。
通过阿里云 DNS TXT 验证签发 Let's Encrypt 证书，SAN 为 `h3.yakiyyy.online`，
本次证书有效期至 2027-01-26。两个外部探测节点访问 HTTPS 系统 API 均返回 200。

用户服务已启用，用户 lingering 已开启：

- `h3-direct-https.service`：Caddy 2.11.7，独立用户服务，失败自动重启。
- `h3-direct-mapping.timer`：每 120 秒续租 600 秒端口映射，拒绝覆盖其他应用映射。
- `h3-aliyun-ddns.timer`：每 180 秒读取路由器真实 WAN IPv4，仅变化时更新 `h3` A 记录，TTL 600 秒。
- `h3-direct-certificate.timer`：每日检查证书续期，完成后重新加载 HTTPS 服务。

```bash
systemctl --user status h3-comfyui.service h3-api-router.service h3-direct-https.service
systemctl --user list-timers 'h3-*'
journalctl --user -u h3-direct-https.service -u h3-aliyun-ddns.service -n 50
```

`deploy/direct_gateway.py` 默认只读查询，`--apply` 才建立映射；使用有限租约，
路由器重启后定时器会重新建立映射。公网 IP 变化后可能需要等待检测及 DNS 缓存过期。
没有启用 IPv6 AAAA，避免发布未经验证的入站地址。

`aliyun_ddns.py` 使用独立虚拟环境中的官方 SDK，版本固定在
`deploy/direct-requirements.txt`。Caddy 和 acme.sh 分别保存在独立工具目录，
不修改模型 Python 环境。`direct_certificate.sh` 使用固定版本官方 acme.sh 3.1.6，
通过 `dns_ali` 验证，指定 Let's Encrypt。

RAM 策略见 `deploy/aliyun-dns-policy.json`：全局读取 DNS 记录，写操作限定
`yakiyyy.online`。该授权粒度是整个域名。凭据保存在本机
`temp/direct-public/aliyun-dns.env` 的 `Ali_Key` / `Ali_Secret`；
文件权限 600、父目录 700，凭据、证书私钥和 ACME 状态不进入 Git 或前端。
非敏感模板为 `deploy/*.env.example`。

网页构建使用 `.env.production` 中的公开 API 地址；修改并验证后提交到 main，
GitHub Actions 构建和发布 Pages。本机直连入口构建后执行
`python3 deploy/publish_frontend.py` 原子更新，无需重启模型或代理。
电脑和路由器需要持续开机；国内各网络及安卓微信的可达性仍以实际设备验证为准。
