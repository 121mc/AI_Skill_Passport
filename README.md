# AI Skill Passport 本地演示系统

AI Skill Passport 是一个本地运行的全栈演示项目，用来展示“可复用的 AI 协作习惯”如何被用户保存、选择、组合，并在真实或兼容 OpenAI 协议的大模型调用中生效。

项目的核心不是做一个静态卡片列表，而是完整跑通一个 HCI 产品原型流程：用户管理自己的 Skill Cards，在新任务中选择要应用的习惯，预览即将发送给模型的上下文，生成文本结果，再把本次任务沉淀成新的可复用习惯，并支持通过分享链接导入或复刻他人的卡片。

## 项目分工

| 成员 | 学号 | 职责 | 占比 |
|------|------|------|------|
| 高仁杰 | 251250037 | 负责根据定稿的大纲与需求，制作项目的功能原型或Demo，直观呈现产品形态 | 40% |
| 李思睿 | 251250050 | 负责产出项目大纲，确立整体逻辑与核心内容；完成最终汇报PPT的制作与美化 | 20% |
| 薛徐铸 | 251250042 | 负责对项目大纲进行细化与完善，针对逻辑漏洞及可行性提出具体的修改意见 | 10% |
| 卢忠源 | 251250128 | 负责熟悉项目内容与PPT，承担最终的现场PPT讲解与演示任务 | 30% |

## 核心功能

### 1. Skill Card 技能卡片库

首页是技能卡片库，用来管理用户长期积累的 AI 使用习惯。每张 Skill Card 表示一种可复用的协作偏好，例如课堂展示、答辩汇报、正式中文邮件、极简视觉风格等。

卡片包含以下信息：

- 名称与描述：说明这张卡适合解决什么类型的问题。
- 适用场景：例如 PPT、课程展示、HCI 报告、邮件写作等。
- 语气偏好：约束模型回答时的语气和表达方式。
- 结构偏好：约束输出的组织顺序和逻辑框架。
- 风格规则：约束生成结果的呈现风格。
- 限制条件：提醒模型避免不符合用户习惯的内容。
- 示例：给模型提供可参考的输出方式。
- 标签：用于任务推荐和检索。
- 隐私级别：支持 private、link、team、public 四种本地演示状态。
- 兼容性分数：展示卡片在聊天、PPT、写作、代码等场景中的适配程度。
- 使用次数与更新时间：用于体现习惯被复用和演化的过程。

### 2. 技能卡片详情与编辑

用户可以进入任意 Skill Card 的详情页，直接编辑卡片中的各类习惯字段。详情页支持：

- 修改卡片名称、描述和默认任务提示词。
- 按行编辑场景、语气、结构、风格规则、限制、示例和标签。
- 调整隐私级别。
- 保存修改到本地 JSON 数据库。
- 为当前卡片生成分享链接。

这部分强调“习惯由用户拥有和控制”：模型不会自动修改长期习惯，所有长期卡片内容都需要用户显式保存。

### 3. 任务生成器

任务生成器是系统的主要演示流程。用户输入一个具体任务后，系统会根据任务文本和卡片标签推荐相关 Skill Cards。

每张推荐卡片都可以选择不同应用方式：

- 全部应用：使用卡片中的语气、结构、风格、限制和示例。
- 选择字段：只应用用户勾选的部分字段，例如只使用风格规则。
- 仅本次任务：本次生成使用卡片，但不把它记为长期使用记录。
- 不应用：当前任务完全忽略该卡片。

任务生成器还会显示已选卡片列表，让用户在调用模型前明确知道哪些习惯会参与本次生成。

### 4. 上下文预览

点击“预览上下文”后，前端会请求后端的 `/api/context/preview` 接口。后端会把用户任务和已选 Skill Cards 转换成一段结构化上下文。

这个上下文是系统最关键的可解释环节：它展示了哪些卡片被应用、以什么模式应用、哪些字段被包含，以及当前任务是什么。用户可以在真正调用模型前检查这段内容，避免长期习惯被错误使用。

预览逻辑完全由后端确定，不依赖大模型，因此即使没有配置 API Key，也能正常演示。

### 5. 大模型文本生成

点击“生成文本”后，后端会调用 `/api/generate` 接口，并执行以下流程：

1. 读取本地卡片数据。
2. 校验用户选择的卡片是否存在。
3. 生成结构化 Skill Card 上下文。
4. 拼接系统消息和用户任务。
5. 通过 OpenAI-compatible 适配器调用模型。
6. 返回模型输出、实际使用的 provider、model、上下文和会话 ID。
7. 生成一个可保存的新习惯建议。
8. 写入任务会话和时间线事件。

后端只支持文本生成。当前版本不会直接生成图片、PPT 文件、附件或其他非文本产物。如果需要 PPT，推荐先生成大纲，再用其他工具制作文件。

### 6. OpenAI-compatible 模型适配

项目把模型调用封装在后端适配器中，浏览器永远不会拿到 `LLM_API_KEY`。

只要服务兼容 OpenAI Chat Completions 风格接口，就可以通过环境变量切换 provider，例如 OpenAI、DeepSeek、Qwen 或本地兼容网关。

如果未配置 API Key、未配置模型名，或模型调用失败，且 `LLM_MOCK_FALLBACK=true`，后端会返回带有 fallback 标记的模拟内容，保证课堂展示或评审演示不会因为网络或额度问题中断。

### 7. 习惯建议保存

每次生成完成后，系统会根据当前任务和已选卡片生成一张 suggested card。用户可以选择保存它，让一次临时任务沉淀为新的长期 Skill Card。

这体现了 AI Skill Passport 的核心闭环：

任务输入 -> 选择习惯 -> 模型生成 -> 产生新习惯建议 -> 用户确认保存 -> 下次任务继续复用

### 8. 分享、预览、导入与复刻

系统支持为 Skill Card 创建分享链接。分享时后端会保存当前卡片的快照，而不是暴露原卡片的实时引用。

分享页支持：

- 查看分享快照内容。
- 导入卡片：把分享快照复制成本地新卡片。
- 复刻卡片：在导入时覆盖部分字段，生成一个可继续编辑的新版本。
- 记录导入次数。

这种设计让分享是可控的：被分享者获得的是一份本地副本，不会影响分享者原来的私有卡片。

### 9. 记忆时间线

时间线页面展示本地习惯的演化记录，包括：

- 创建卡片
- 更新卡片
- 使用卡片
- 创建分享链接
- 导入或复刻分享卡片
- 生成新的习惯建议

时间线用于体现“AI 使用习惯不是一次性 prompt，而是可以持续沉淀和管理的个人资产”。

### 10. 设置与运行状态

设置页会读取 `/api/health`，展示后端模型配置状态：

- API 是否在线
- 当前 provider
- 是否已配置模型名
- fallback 是否开启

这方便演示时快速判断当前系统会调用真实模型，还是会进入本地 fallback。

## 页面路由

| 路由 | 功能 |
| --- | --- |
| `/` | 技能卡片库，展示本地 Skill Cards，并支持创建分享链接 |
| `/cards/:cardId` | 卡片详情页，编辑习惯字段、隐私级别和默认提示词 |
| `/task` | 任务生成器，推荐卡片、选择应用方式、预览上下文、生成文本 |
| `/timeline` | 记忆时间线，展示习惯创建、使用、分享、导入和建议记录 |
| `/share/:shareId` | 分享预览页，支持导入或复刻共享卡片 |
| `/settings` | 后端运行状态和模型配置状态 |

## 后端 API

默认后端地址为 `http://localhost:8787/api`。

| 方法与路径 | 说明 |
| --- | --- |
| `GET /health` | 查看后端、provider、模型和 fallback 状态 |
| `GET /cards` | 获取所有本地 Skill Cards |
| `GET /cards/:id` | 获取单张 Skill Card |
| `POST /cards` | 创建新的 Skill Card |
| `PATCH /cards/:id` | 更新 Skill Card |
| `POST /cards/:id/use` | 标记卡片被使用 |
| `DELETE /cards/:id` | 删除 Skill Card |
| `POST /recommend` | 根据任务文本推荐匹配卡片 |
| `POST /context/preview` | 生成模型调用前的结构化上下文预览 |
| `POST /generate` | 调用模型或 fallback 生成文本，并返回习惯建议 |
| `POST /share` | 为卡片创建分享快照和分享链接 |
| `GET /share/:shareId` | 获取分享快照 |
| `POST /share/:shareId/import` | 导入分享卡片 |
| `POST /share/:shareId/fork` | 复刻分享卡片并应用用户修改 |
| `GET /timeline` | 获取本地记忆时间线 |

## 技术栈

- Monorepo：npm workspaces
- 前端：Vite、React、TypeScript、React Router、lucide-react
- 后端：Node.js、Express、TypeScript
- 数据存储：本地 JSON 文件
- 测试：Vitest、Testing Library、Supertest
- 模型接入：OpenAI-compatible Chat Completions 适配器

## 本地运行

安装依赖：

```sh
npm install
```

同时启动前端和后端：

```sh
npm run dev
```

启动后访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8787/api`

## LLM 配置

复制 `.env.example` 为 `.env`，并填写后端模型配置：

```env
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your_server_side_key
LLM_MODEL=your_model_name
LLM_TIMEOUT_MS=30000
LLM_MOCK_FALLBACK=true
```

配置说明：

- `LLM_PROVIDER`：当前实现默认为 `openai-compatible`。
- `LLM_BASE_URL`：兼容 OpenAI 协议的接口地址。
- `LLM_API_KEY`：仅由后端读取，不会发送到浏览器。
- `LLM_MODEL`：实际调用的模型名称。
- `LLM_TIMEOUT_MS`：模型请求超时时间。
- `LLM_MOCK_FALLBACK`：为 `true` 时，模型不可用会返回明确标记的 fallback 内容；为 `false` 时会直接返回错误。

## 推荐演示流程

1. 打开首页，展示 Skill Card 卡片库。
2. 进入 `Classroom Presentation`，说明卡片由可编辑的习惯字段组成。
3. 回到 `/task`，使用默认 HCI 项目展示任务。
4. 展示系统推荐的 `Classroom Presentation` 和 `Minimal Visual Style`。
5. 对第一张卡选择“全部应用”，对第二张卡选择“选择字段”。
6. 点击“预览上下文”，说明这就是发送给后端和模型的习惯上下文。
7. 点击“生成文本”，展示真实模型输出或明确标记的 fallback 输出。
8. 保存系统建议的新 Skill Card。
9. 回到首页，为卡片创建分享链接。
10. 打开分享页，演示导入或复刻卡片。
11. 打开时间线，展示创建、使用、分享、导入和建议记录。

## 验证命令

运行自动化测试：

```sh
npm run test
```

运行 TypeScript 检查：

```sh
npm run typecheck
```

构建前端和后端：

```sh
npm run build
```

也可以一次性执行：

```sh
npm run test
npm run typecheck
npm run build
```

## 项目结构

```text
AI4HCI_PROJECT/
  client/                 前端 React 应用
    src/
      api/                前端 API 封装
      components/         可复用 UI 组件
      pages/              页面级组件
      styles/             全局样式
  server/                 Express 后端
    src/
      routes/             API 路由
      services/           业务逻辑、推荐、分享、生成、存储
      services/llm/       LLM 适配器和 fallback
      data/               seedCards.json 与 db.json
    tests/                后端测试
  shared/                 前后端共享 TypeScript 类型
  SPEC.md                 产品规格说明
  PLAN.md                 实现计划
  README.md               项目说明
```

## 当前边界

- 本项目是本地 demo，没有用户账号、OAuth、云端同步、付费或多租户权限系统。
- 数据存储使用本地 JSON 文件，适合演示和开发，不适合作为生产数据库。
- 分享链接是本地演示链接，不是公开互联网链接。
- 当前模型能力只覆盖文本生成，不直接生成 PPT 文件、图片或附件。
- fallback 内容用于演示稳定性，不代表真实模型效果。
