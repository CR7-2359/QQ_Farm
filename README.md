# QQ Farm · QQ 农场多账号管理面板

![QQ Farm 项目图标](web/public/icon.png)

QQ Farm 是一个可自部署的 QQ 农场自动化工具。通过浏览器集中添加和管理 QQ、微信农场账号，为每个账号配置巡查和种植策略，并查看运行状态、实时日志和作物收益数据。

- [功能一览](#功能一览)
- [Windows 快速开始](#windows-快速开始)
- [添加和管理账号](#添加和管理账号)
- [其他部署方式](#其他部署方式)
- [配置与数据](#配置与数据)
- [常见问题](#常见问题)
- [本地开发](#本地开发)
- [来源与许可证](#来源与许可证)

## 功能一览

| 功能 | 在面板中可以做什么 |
| --- | --- |
| 多账号管理 | 添加、编辑、启动、停止和删除账号，查看各账号的在线状态 |
| 农场自动化 | 配置巡查间隔、种子策略和自动操作，包括收获、种植、浇水、除草、除虫、土地升级与出售果实 |
| 好友操作 | 开启偷菜、帮忙或捣乱，使用黑名单跳过指定好友，在静默时段暂停好友巡查 |
| 任务与奖励 | 自动检查任务并领取奖励，也可开启邮件奖励领取 |
| 实时日志 | 在「概览」查看运行日志，按账号、模块、事件、级别或关键词筛选 |
| 作物分析 | 按经验效率、净利润效率和等级要求对比作物，也可查看使用普通肥料时的效率 |
| 离线通知 | 为账号离线配置 Bark 或自定义 Webhook 等通知渠道，并在设置中发送测试通知 |

「个人」页面包含「我的农场」和「我的背包」。在「设置」中可以调整自动化规则，面板支持浅色与深色主题。

## Windows 快速开始

准备 Git、Node.js 20.19+（20.x）或 22.12+，以及 pnpm 10.30.2。可以使用 Corepack 启用 pnpm。若安装的 Node.js 没有提供 Corepack，也可以通过 npm 安装固定版本。

```powershell
# 有 Corepack 时启用 pnpm
corepack enable

# 没有 Corepack 时使用这一行
# npm install --global pnpm@10.30.2

git clone https://github.com/CR7-2359/QQ_Farm.git
Set-Location QQ_Farm
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm build:web
```

首次启动时，在仓库根目录创建本机配置并打开它。

```powershell
Copy-Item .env.example .env
notepad .env
```

将 `ADMIN_PASSWORD=` 改成你自己的强密码并保存。计划使用微信扫码时，再填写扫码服务地址和令牌。已有 `.env` 时直接编辑它。

```powershell
.\start.cmd
```

启动后打开 <http://localhost:3000>，用刚设置的面板密码登录。以后也可以双击 [start.cmd](start.cmd) 启动。终端运行时按 `Ctrl+C` 停止服务。

## 添加和管理账号

面板密码用于进入管理后台。登录后，从左侧「账号」进入「账号管理」，点击「添加账号」为该账号授权。

| 添加方式 | 操作 |
| --- | --- |
| QQ 扫码 | 选择「QQ扫码」，用手机 QQ 扫码并确认 |
| 微信扫码 | 按下节配置本机微信扫码服务，再选择「微信扫码」，用手机微信扫码并确认 |
| 手动填码 | 选择「手动填码」，选择对应平台并填写该账号的农场登录 Code |

添加后可在「账号管理」查看状态和启动或停止账号。建议先确认一个账号能正常连接，再在「设置」为它保存自动化规则，通过「概览」查看执行日志。服务启动时会尝试启动已保存的账号。被踢下线时，程序会停止该账号。在「设置」中还可以开启离线删号并指定时限。

### 微信扫码配置

1. 在运行面板的同一台电脑启动 YYB Go Enhanced，并在该服务设置 `YYB_PROTOCOL_TOKEN`。可以参考项目曾验证的 `v0.3.11` 部署文档，将扫码服务端口限制在本机访问。[YYB Go Enhanced 部署文档](https://github.com/525815266/YYB-Go-Enhanced/blob/v0.3.11/docs/docker-deployment.md)
2. 使用 Windows 启动器时，在 `.env` 中设置以下变量并重启面板。Linux 源码和二进制运行方式可以在启动前将相同变量设为进程环境变量。

   ```dotenv
   WECHAT_QR_URL=http://127.0.0.1:18427
   WECHAT_QR_TOKEN=<替换为扫码服务的 YYB_PROTOCOL_TOKEN>
   ```

3. 保持面板密码认证开启，登录后进入「账号管理 → 添加账号 → 微信扫码」。按手机提示完成授权。
4. 已绑定的微信账号需要续期时，在「编辑账号 → 微信扫码」用原微信重新授权。手动填码添加的微信账号在「手动填码」中更新 Code。

## 其他部署方式

### Linux 源码运行

准备与 Windows 相同版本要求的 Node.js 和 pnpm。已克隆仓库时，直接在仓库根目录安装并运行。

```bash
git clone https://github.com/CR7-2359/QQ_Farm.git
cd QQ_Farm
pnpm install --frozen-lockfile
pnpm build:web

ADMIN_PASSWORD='替换为自己的强密码' pnpm dev:core
```

默认访问 <http://localhost:3000>。需要加载根目录的 `.env` 时，可以在仓库根目录执行 `node --env-file=.env core/client.js`，所用配置与 Windows 启动器一致。

### Docker Compose 部署

从仓库根目录部署。先将 [docker-compose.yml](docker-compose.yml) 中的 `ADMIN_PASSWORD: admin` 改为自定义强密码。只需要宿主机访问时，可将端口映射设为 `127.0.0.1:3000:3000`。

```bash
docker compose config --quiet
docker compose up -d --build
docker compose logs -f
```

默认从宿主机访问 <http://localhost:3000>。按 `Ctrl+C` 退出日志跟踪，容器继续运行。执行 `docker compose down` 停止并移除容器，宿主机的 `./data` 可在下次启动时继续使用。

Compose 中通过 `environment` 为面板容器传递配置。微信扫码服务需要能从面板进程的回环地址访问。使用宿主机上的扫码服务时，可以选择源码或二进制方式运行面板。

### 二进制打包与运行

有对应平台的发布资产时，可直接下载并运行。也可以安装源码依赖后自行打包。二进制运行时无需安装 Node.js。[GitHub Releases](https://github.com/CR7-2359/QQ_Farm/releases)

| 目标平台 | 仓库根目录打包命令 | `core/dist/` 下的文件 |
| --- | --- | --- |
| Windows x64 | `pnpm package:win` | `qq-farm-bot-win-x64.exe` |
| Linux x64 | `pnpm package:linux` | `qq-farm-bot-linux-x64` |
| macOS Intel | `pnpm package:mac` | `qq-farm-bot-macos-x64` |
| macOS Apple Silicon | `pnpm package:mac` | `qq-farm-bot-macos-arm64` |

`pnpm package:release` 一次构建全部目标，仓库的发布工作流在 Ubuntu 上执行这个命令。

Windows 下在可执行文件所在目录打开 PowerShell，设置面板密码后运行。

```powershell
$env:ADMIN_PASSWORD = '替换为自己的强密码'
.\qq-farm-bot-win-x64.exe
```

Linux 下在可执行文件所在目录执行以下命令。macOS 将文件名替换为对应架构的产物。

```bash
chmod +x ./qq-farm-bot-linux-x64
ADMIN_PASSWORD='替换为自己的强密码' ./qq-farm-bot-linux-x64
```

## 配置与数据

### 环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `admin` | 首次启动时的面板密码。建议在首次启动前设置，避免使用默认密码 |
| `ADMIN_PORT` | `3000` | 面板监听端口。改动后应同步修改访问地址，Docker 部署还要调整容器端口映射 |
| `WECHAT_QR_URL` | 空 | 微信扫码服务的本机地址。模板示例为 `http://127.0.0.1:18427`，按实际端口填写 |
| `WECHAT_QR_TOKEN` | 空 | 微信扫码服务的 `YYB_PROTOCOL_TOKEN` |
| `LOG_LEVEL` | `info` | 后端日志级别 |

启动进程中已有的同名环境变量优先于 `.env`。在面板内修改过密码后，已保存的密码优先于 `ADMIN_PASSWORD`。将密码、扫码令牌和账号授权信息保留在本机，提交代码时使用 [配置模板](.env.example) 中的占位值。

### 数据保存与备份

| 运行方式 | 数据目录 |
| --- | --- |
| 源码运行，包括 `start.cmd` | `core/data/` |
| Docker Compose | 宿主机 `./data/`，挂载至容器 `/app/core/data/` |
| 二进制 | 可执行文件同级的 `data/` |

`accounts.json` 保存账号信息，`store.json` 保存面板与自动化配置。升级或迁移前，先停止服务并备份整个数据目录。恢复时把目录放回对应位置，再启动服务。

## 常见问题

| 现象 | 排查方法 |
| --- | --- |
| 启动时报 `EADDRINUSE` | 检查端口 `3000` 是否已被另一个实例或程序占用。Windows 可用 `Get-NetTCPConnection -LocalPort 3000 -State Listen` 检查。可以关闭占用端口的程序，或设置 `ADMIN_PORT` 后用新端口访问 |
| 首页提示 `web build not found` | 在仓库根目录运行 `pnpm build:web`，确认生成 `web/dist/index.html` 后重启后端 |
| 修改 `ADMIN_PASSWORD` 后仍需旧密码 | 面板内设置过的密码优先。用当前有效密码登录，再从「设置」修改密码 |
| 提示扫码需要启用面板密码认证 | 在「设置」重新启用密码认证，退出后用面板密码登录 |
| 提示本机微信扫码服务不可用 | 检查扫码服务是否运行、地址是否为面板进程可访问的回环地址、端口是否正确、两端令牌是否一致。修改环境变量后重启面板 |
| 游戏服务器提示客户端版本过低 | 打开「设置 → 运行时连接配置」，更新「游戏版本号」并保存。运行中的账号会根据新配置重连 |

## 本地开发

在仓库根目录执行以下命令。

| 命令 | 作用 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 根据锁文件安装工作区依赖 |
| `pnpm dev` | 构建前端并启动后端，默认访问 `http://localhost:3000` |
| `pnpm dev:core` | 单独启动后端 |
| `pnpm dev:web` | 启动支持热更新的 Vite 前端，访问终端显示的地址 |
| `pnpm build:web` | 检查前端类型并构建到 `web/dist/` |
| `pnpm lint` | 运行前后端 ESLint 并自动修复可修复项，执行后可用 `git diff` 检查改动 |

前后端联调时，分别在两个终端运行 `pnpm dev:core` 和 `pnpm dev:web`。Vite 默认将 API、Socket.IO 和游戏静态资源请求代理至本机 `3000` 端口。调整后端开发端口时，应同步调整 [Vite 代理配置](web/vite.config.ts)。

### 项目结构

```text
QQ_Farm/
├── core/
│   ├── client.js          # 管理面板和账号运行时入口
│   └── src/
│       ├── controllers/ # Express API 和 Socket.IO
│       ├── runtime/     # 账号进程管理
│       ├── services/    # 农场、好友、任务与扫码业务
│       ├── models/      # 账号与配置持久化
│       ├── proto/       # Protobuf 协议定义
│       └── gameConfig/  # 游戏静态数据
├── web/
│   ├── public/           # 前端静态资源
│   └── src/              # Vue 页面、组件、Pinia 和 API 客户端
├── docker-compose.yml    # Compose 部署配置
├── .env.example          # 本机环境变量模板
└── start.cmd             # Windows 启动器
```

后端使用 Node.js、Express、Socket.IO 和 Protobuf。前端使用 Vue 3、TypeScript、Vite、Pinia 和 UnoCSS。提交与验证约定见 [AGENTS.md](AGENTS.md)。

## 来源与许可证

- 上游 Web 面板项目 [Penty-d/qq-farm-bot-ui](https://github.com/Penty-d/qq-farm-bot-ui)
- 核心功能来源 [linguo2625469/qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot)
- 部分功能来源 [QianChenJun/qq-farm-bot](https://github.com/QianChenJun/qq-farm-bot)

本仓库按 [MIT 许可证](LICENSE) 发布。项目仅供学习与研究，请遵守游戏服务条款。使用本工具可能引发账号限制，相关后果由使用者自行承担。
