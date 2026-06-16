# ⚽ 2026 世界杯模拟竞猜系统

线下体彩门店专用 · 模拟投注 · 无需微信授权

---

## 技术栈

- **后端**：Node.js + Express + PostgreSQL
- **前端**：Vue 3 + Vite + Element Plus + Pinia

---

## 生产部署（GitHub Actions 自动 CI/CD）

> 推送到 `main` 或 `deploy` 分支后，流水线自动构建镜像并部署到服务器。

### 第一步：生成 SSH 密钥对（只做一次）

在本地 PowerShell 执行：

```powershell
ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$env:USERPROFILE\.ssh\deploy_key" -N '""'
```

复制私钥内容备用：

```powershell
Get-Content "$env:USERPROFILE\.ssh\deploy_key" | Set-Clipboard
```

### 第二步：将公钥放到服务器（只做一次）

SSH 登录服务器后执行（把公钥内容替换进去）：

```bash
mkdir -p ~/.ssh
echo "ssh-ed25519 AAAA...（你的公钥内容）" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 第三步：在服务器创建 .env.backend（只做一次）

SSH 登录服务器后执行：

```bash
mkdir -p ~/shijiebei

cat > ~/shijiebei/.env.backend << 'EOF'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=asdf@1234
POSTGRES_DB=worldcup_betting
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=asdf@1234
DB_NAME=worldcup_betting
PORT=3000
JWT_SECRET=（填你自己的长随机字符串，可用 python3 -c "import secrets; print(secrets.token_hex(48))" 生成）
EOF

chmod 600 ~/shijiebei/.env.backend
```

> **注意：**`DB_PASSWORD` 和 `POSTGRES_PASSWORD` 必须完全一致。

### 第四步：在 GitHub 仓库配置 Secrets

进入仓库 → **Settings → Secrets and variables → Actions → New repository secret**，添加以下 5 个：

| Secret 名称        | 填写内容                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `DEPLOY_HOST`    | 服务器 IP 地址                                                                                                |
| `DEPLOY_USER`    | SSH 登录用户名（通常 `root`）                                                                               |
| `DEPLOY_SSH_KEY` | 第一步生成的**私钥全文**（含 `-----BEGIN...` 首尾行）                                                 |
| `GHCR_USERNAME`  | 你的 GitHub 用户名（小写）                                                                                    |
| `GHCR_TOKEN`     | GitHub PAT，权限勾选 `read:packages`，在 [github.com/settings/tokens](https://github.com/settings/tokens) 生成 |

> 可选：添加 `DEPLOY_ENV_BACKEND`（值为 `.env.backend` 文件全文内容），配置后每次部署会自动同步到服务器，无需手动登服务器修改。

### 第五步：推送代码触发部署

```bash
git add .
git commit -m "deploy"
git push origin main
```

流水线会自动：

1. 构建前端和后端 Docker 镜像并推送到 GHCR
2. 将 `docker-compose.prod.yml` 和 `deploy.sh` 上传到服务器
3. SSH 登录服务器执行 `deploy.sh` 完成启动

### 查询数据库（服务器本机）

数据库服务仅对本机开放，端口 `55432`：

```bash
psql -h 127.0.0.1 -p 55432 -U postgres -d worldcup_betting
```

---

## 本地开发启动

### 一、启动后端

```bash
cd backend

# 安装依赖
npm install

# 复制并编辑环境变量
cp .env.example .env
# 编辑 .env，填入数据库连接信息和 JWT_SECRET

# 开发模式（自动重启）
npm run dev
```

后端默认运行在 `http://localhost:3000`

> 首次启动时自动创建数据表并初始化管理员账号：
>
> - **账号**：`admin`
> - **密码**：`admin123`

### 二、启动前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`

---

## 功能说明

### 用户端

| 功能      | 说明                                               |
| --------- | -------------------------------------------------- |
| 注册/登录 | 独立账号体系，填写用户名+昵称+密码                 |
| 赛事列表  | 查看所有赛事，按状态分组（即将开赛/进行中/已结束） |
| 投注      | 选择比分，为每个比分独立填写投注金额               |
| 投注单    | 提交后弹出格式化投注单（可打印）                   |
| 我的投注  | 查看历史投注记录及中奖情况                         |

### 管理后台（`/admin`）

| 功能     | 说明                                                 |
| -------- | ---------------------------------------------------- |
| 赛事管理 | 新增/编辑/删除赛事，修改状态                         |
| 赔率配置 | 一键生成20种默认比分赔率，或手动添加/修改/删除       |
| 比分录入 | 手动录入最终比分，系统自动完成结算                   |
| 统计报表 | 查看每场赛事的投注汇总、中奖用户名单、各用户投注明细 |

---

## 赛事状态说明

| 状态         | 说明                         |
| ------------ | ---------------------------- |
| `upcoming` | 即将开赛（可投注）           |
| `ongoing`  | 进行中（可投注）             |
| `finished` | 已结束（已录入比分，已结算） |
| `closed`   | 已关闭（不可投注）           |

---

## 结算规则

- 用户选择一场赛事的多个比分，每个比分独立填写金额
- 比赛结束后，管理员录入最终比分
- 系统自动匹配：**最终比分 = 用户所选比分** → 该投注项中奖
- **赔付金额 = 投注金额 × 赔率**（含本金）
- 同一订单中可有多个中奖项

---

## 项目结构

```
shijiebei/
├── backend/
│   ├── src/
│   │   ├── app.js              # 入口文件（含DB初始化）
│   │   ├── config/database.js  # PG连接池
│   │   ├── middleware/auth.js  # JWT认证中间件
│   │   └── routes/
│   │       ├── auth.js         # 注册/登录
│   │       ├── matches.js      # 赛事查询
│   │       ├── bets.js         # 投注
│   │       └── admin.js        # 后台管理
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── api/index.js        # Axios封装
    │   ├── stores/user.js      # Pinia用户状态
    │   ├── router/index.js     # 路由（含权限守卫）
    │   ├── components/
    │   │   └── BetSlip.vue     # 格式化投注单组件
    │   └── views/
    │       ├── Login.vue
    │       ├── Register.vue
    │       ├── Home.vue        # 赛事列表
    │       ├── MatchDetail.vue # 投注页面
    │       ├── MyBets.vue      # 我的投注
    │       └── admin/
    │           ├── AdminLayout.vue
    │           ├── MatchManage.vue  # 赛事管理
    │           ├── OddsConfig.vue   # 赔率配置
    │           ├── ResultEntry.vue  # 比分录入
    │           └── Reports.vue      # 统计报表
    ├── vite.config.js
    └── package.json
```

---

## 注意事项

- 本系统仅供线下门店内部**模拟投注**使用，不涉及真实资金交易
- 生产环境请务必修改 `.env` 中的 `JWT_SECRET` 为强随机字符串
- 建议在内网环境部署，不对外公开
