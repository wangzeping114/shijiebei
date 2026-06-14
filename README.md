# ⚽ 2026 世界杯模拟竞猜系统

线下体彩门店专用 · 模拟投注 · 无需微信授权

---

## 技术栈

- **后端**：Node.js + Express + PostgreSQL
- **前端**：Vue 3 + Vite + Element Plus + Pinia

---

## 快速启动

### Docker Compose 一键启动（推荐）

1. 在项目根目录复制环境变量模板：

    Windows:
    copy .env.backend.example .env.backend

    Linux:
    cp .env.backend.example .env.backend

2. 编辑 .env.backend，至少修改 DB_PASSWORD、POSTGRES_PASSWORD 和 JWT_SECRET
    并保持以下两组变量一致：
    DB_NAME = POSTGRES_DB
    DB_USER = POSTGRES_USER
    DB_PASSWORD = POSTGRES_PASSWORD

3. 直接拉起前端+后端+PostgreSQL：

    docker compose -f docker-compose.prod.yml up -d

4. 查看服务状态：

    docker compose -f docker-compose.prod.yml ps

说明：数据库由 Docker 自动拉取 postgres:16-alpine 镜像并持久化到卷 shijiebei-pgdata。

---

### 一、准备数据库

1. 安装 PostgreSQL（推荐 14+）
2. 创建数据库：

```sql
CREATE DATABASE worldcup_betting;
```

### 二、启动后端

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量文件
copy .env.example .env
# 编辑 .env，填入数据库连接信息和 JWT_SECRET

# 启动（开发模式，自动重启）
npm run dev

# 正式启动
npm start
```

后端默认运行在 `http://localhost:3000`

> 首次启动时，程序会自动创建数据表并生成默认管理员账号：
>
> - **账号**：`admin`
> - **密码**：`Admin@123`

---

### 三、启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
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
