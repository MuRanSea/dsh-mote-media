# mote Media Studio (DSH plugin)

在 DeepSeek Harness 里通过 **mote 媒体渠道** 生成图片和视频：**即梦式创作台**、**聊天生图技能**和四个智能体工具，共用同一套 Host 实现。

- 平台接口参考：<https://platform.sgt.site/docs/>，接口契约按它实现（统一媒体任务、任务轮询、幂等重放、错误码）。
- 面板形态参考即梦：大输入卡（参考图 / 首尾帧 + 参数条 + 圆形发送键）、原比例作品瀑布和大图详情。
- 多渠道：一条 mote 统一渠道覆盖 Seedream / Seedance / Nano Banana / GPT Image / 可灵 / MiniMax H3，另可加任意 OpenAI 兼容渠道。
- 「每张卡反复生成、结果留本地、多模型集中使用」的思路来自 [MuRanSea/media-workstage](https://github.com/MuRanSea/media-workstage)；早期版本做过卡片+连线的画布，现已按即梦形态重做。

## 渠道配置（多渠道路由）

一个「渠道」= 一个可达的上游（地址 + 密钥）。两类驱动：

| 驱动 | 覆盖 | 说明 |
| --- | --- | --- |
| `mote` | 图片、视频、3D、模型目录 | 一把 mote 密钥就覆盖 Seedream、Seedance、Nano Banana / Gemini、GPT Image、可灵、MiniMax H3、混元 / Tripo |
| `openai-images` | 图片 | 任意 OpenAI 兼容 `POST {base}/v1/images/generations`，自己填模型 id；返回链接或 Base64 都能用（Base64 会落盘，再经插件自己的认证路由回显） |

模型目录**跨渠道聚合**，每条模型都带它所属的渠道。创作台按“渠道 + 模型”选择并明确提交渠道，同名模型也可区分；默认模型配置同时保存渠道。工具调用也可显式传 `channel`，未指定渠道且模型 ID 重复时会要求明确选择。

配置写在 profile 的 `cordis.patch.yml` 中本插件的行里，或在创作台的「渠道设置」里增删渠道（写回同一行；面板拿不到已存密钥，留空表示沿用旧值）：

```yaml
- id: mote-media
  name: '@local/dsh-mote-media'
  config:
    channels:
      - id: mote
        name: mote
        driver: mote
        baseUrl: 'https://platform.sgt.site'
        apiKey: '替换为你的虚拟密钥'        # 留空时读环境变量 MOTE_API_KEY
      - id: openai
        name: openai 兼容
        driver: openai-images
        baseUrl: 'https://api.openai.com'
        apiKey: 'sk-...'
        models: ['dall-e-3', 'gpt-image-1']
    imageModel: 'doubao-seedream-5-0-lite-260128'
    videoModel: 'doubao-seedance-2-0-fast-260128'
    imageChannelId: 'mote'                 # 可选：默认图片模型所属渠道
    videoChannelId: 'mote'                 # 可选：默认视频模型所属渠道
    outputDir: ''                          # 留空 = %USERPROFILE%\Pictures\mote-media
    pollIntervalMs: 3000                   # 轮询间隔，500–30000
```

旧版单渠道写法（`baseUrl` + `apiKey` 平铺）仍然可用，加载时自动变成一个 id 为 `mote` 的渠道，已存的密钥保留。密钥只留在 Host；浏览器拿到的是渠道名和「是否已配置」，不含密钥。

## 在正常对话里生图

插件启用后注册 `mote-image` 技能。可以在正常对话中直接提出生图要求，也可以从输入框的技能菜单选择它，明确要求使用该技能，例如：

> 用 mote-image 生成一张咖啡新品海报，偏电影质感，标题“秋日限定”。帮我完善提示词，并按手机海报用途选择比例和清晰度。

技能先通过 `mote_models` 查询当前渠道实际提供的模型和参数，再根据用途补充构图、光线、材质与配色，并选择支持的比例、分辨率和独立任务数。用户明确指定的主体、文字、风格、尺寸和数量优先；要求原样使用提示词时不做润色。默认沿用已配置图片模型，通常选择 2K、1 张，具体以模型支持范围和用户要求为准。仅要求写提示词或出方案时不会调用生成。

创作台的“张数”和聊天工具 `mote_image.n` 都表示独立单图任务数，范围 1–15。选 4 张就创建 4 个任务、调用 4 次上游，每次固定 `n=1`；插件不启用关联组图。单图型号也支持多次独立生成。任务逐个提交，各自保留状态、结果和恢复标识；一张失败不会丢弃其他结果，也不会自动补交或重试未知结果。单张作品的“再次生成”只创建一个新单图任务。

生成工具的结果在聊天中显示为图片卡，可查看多张图片、放大预览、查询任务、保存到本地，并展开查看原始要求、实际提示词和生成参数。打开创作台后也会同步这些聊天作品。能力由技能指导当前对话模型执行；模型是否主动选中技能和如何补充提示词，仍取决于宿主及所用对话模型。

图片调用会先保存输入快照和提交收据。相同工具调用重放使用同一提交标识；处理中或待核实时用返回的 `submissionId` 查询，避免重复生成。保存失败可以只重试下载。聊天作品从创作台移除后会记住隐藏状态，不会在下次同步时恢复；该操作不删除磁盘文件。

目前这条技能流程覆盖图片生成与图片参考编辑，视频仍通过现有工具和创作台操作。参考图编辑需要模型支持，并提供可访问的图片链接、平台文件 ID 或插件已有的图片产物；DSH 聊天附件能否直接作为参考图，取决于宿主向对话模型提供的附件标识。

## 智能体工具

| 工具 | 用途 |
| --- | --- |
| `mote_models` | 列出各渠道可用的图片/视频模型、参数取值、所属渠道及配置的默认模型（可传 `channel` 只看一个渠道） |
| `mote_image` | 文生图 / 参考图编辑，保留原始和实际提示词，返回持久化的 `submissionId`，完成后默认保存并在聊天中展示图片，可传 `channel` |
| `mote_video` | 文生视频 / 首帧 / 首尾帧 / 多模态参考（Seedance、可灵、MiniMax H3），返回任务 ID，可传 `channel` |
| `mote_media_task` | 通过 `submission_id` 查询、取消或保存聊天生图；兼容旧任务的 `task_id` 和原渠道 `channel` |

视频只能走 `mote` 渠道（OpenAI 兼容驱动目前只做图片）。视频任务用 `mote_media_task` 轮询到 `succeeded` 后再 `download`；签名链接会过期，尽早下载。

`mote_image` 的 `prompt` 是实际提交文本，`original_prompt` 保存用户原始要求。`size` 与 `aspect_ratio` 二选一；`save: false` 关闭自动保存。单图返回一个 `submissionId`，`n>1` 在 `results` 中返回每个任务的独立收据。多张任务先返回收据，分别查询：`mote_media_task({"action":"status","submission_id":"该条结果的 submissionId"})`。重新生成是一次新调用，可能产生新的费用；查询和下载不会重新提交生成。

## Web 创作台（即梦式）

侧栏 **mote 创作台** 打开是一整页暗色创作台，参考[即梦首页](https://jimeng.jianying.com/ai-tool/home/)的输入区、参数条和作品浏览层次，按插件实际能力提供操作：

| 即梦的元素 | 这里的实现 |
| --- | --- |
| 创作入口与输入区 | 页头显示品牌、连接状态和渠道设置；**图片生成 / 视频生成**统一放在输入卡底部的**创作类型**菜单 |
| 居中问候「你好，今天想要创作什么？」 | 同一句，出过作品后自动收成小标题 |
| 大输入卡：左侧 `+` 上传位 + 中间提示词 | `＋` 格就是**参考图**（图片模式）或**首帧/尾帧**（视频模式）；点格选本地图，`data:` 内联提交（单张 ≤ 2 MB） |
| 底部参数栏与圆形发送键 | **创作类型 ▾**（图片/视频）、**模型 ▾**、**比例 ▾**、**清晰度 ▾**、图片**张数 ▾**（N 次独立单图生成）；视频按模型能力展示**时长 ▾**和**声音**，右侧为浅薄荷色**圆形发送键** |
| 技能 chips 一行 | 换成**提示词灵感** chips，点一下直接填进提示词 |
| 功能卡网格（短剧工作室 / 即梦画布 / 智能超清…） | 换成四张**模式卡**：文生图 / 参考图生图 / 文生视频 / 首尾帧生视频，点一下切到对应模式 |
| 下方「我的作品」瀑布 | 图片和视频保留原始比例，随面板宽度显示 1–4 列；卡片显示类型、任务状态、模型及任务费用，悬停或键盘聚焦可操作，触屏常显操作 |
| 大图详情与生成信息 | 左侧完整媒体，右侧提示词、模型、参数与任务信息；底部操作区固定显示保存、复用，以及可用的恢复 / 继续提交 / 重新生成 |

行为细节：`⌘/Ctrl + Enter` 生成；参数菜单支持方向键、Escape 和焦点返回；详情及设置弹窗支持焦点循环和 Escape 关闭。处理中、待核实与失败采用不同状态样式，待核实不会显示成失败。布局按插件面板的实际宽度适配，而非整个宿主窗口宽度。浏览器保存最多 120 条轻量作品记录（`mote-media.studio.v1`），新任务的完整输入和收据保存在 Host 的 `.mote-submissions/`。刷新后通过提交标识恢复查询；多张主产物分别显示，视频封面和尾帧不会额外展开为作品。

渠道设置换成同风格的暗色弹窗，支持多渠道路由（mote 统一渠道 + OpenAI 兼容渠道）。

参数菜单默认向下展开，仅在底部空间不足时向上避让，弹层限制在插件面板内。最大高度为 260 CSS px，小窗口按可用高度进一步缩短，选项在内部滚动。模型菜单支持按模型名、完整 ID 或渠道搜索，搜索栏固定；长名称和 ID 单行省略，悬停可查看完整内容。

作品卡和详情都提供「再次编辑」：读取 Host 输入快照，把提示词、渠道与模型、参数、参考图和首尾帧恢复到输入区；修改后点击生成才会创建新任务。「重新生成」仍使用原快照直接创建新任务。旧作品只恢复现存信息，并提示参考素材缺失；完整快照读取失败时保留当前草稿，原模型或渠道不可用时要求明确选择模型。

同一次打开创作台期间，图片与视频分别保留提示词、模型、参数和素材，切换模式不会清空；草稿暂不持久化，离开创作台或刷新后不保留。恢复快照时，不支持的素材会列出并阻止生成，用户可移除或选择其他模型；视频不能作为图片参考，复用图片不会覆盖已经填好的首尾帧。

作品区可组合使用类型、任务状态和关键词筛选，关键词匹配提示词、模型 ID / 展示名与渠道 ID。筛选不改变作品记录和任务轮询；清理操作只处理当前结果中的已结束作品，按钮会显示当前范围与数量。支持一键重置筛选。

## 生成、恢复与重新生成

- 创作台先保存完整输入快照和固定提交标识，再发起生成。浏览器无法保存恢复记录时会停止提交，保留表单输入。
- 同一提交标识不会再次发起上游任务。浏览器和两个渠道驱动都不会自动重试生成 POST；查询模型与任务仍可安全重试。
- 「恢复查询」只查询已有记录；「继续提交」使用同一个标识处理已保存但尚未提交的输入。「重新生成」读取完整快照，以新标识创建新任务，可能产生新的费用。
- 新快照保留渠道、模型、提示词、参数、参考图和首尾帧。插件自己的本地图片会先复制成内联内容，避免重新生成时只留下不可访问的认证链接。切换模型后不兼容的参考素材会明确提示，不会静默丢弃。
- 历史版本没有保存的参考素材无法补回；此类作品仍可预览、保存和复用，但不能当作完整快照直接重新生成。
- 如果上游可能已接收请求却没有返回任务标识，记录会保持「待核实」，不会冒充失败并自动生成第二次。能否继续查询取决于已有收据；本地记录无法替代上游对未知结果的核实。

`.mote-submissions/` 包含本地输入快照及任务收据，从 Git 和运行包排除。保留该目录才能继续使用相关恢复和重新生成功能。工具名称保留，聊天生图增加原始提示词和提交标识；其生成 POST 同样关闭自动重试。

面板 API 的生成流程现在是：`prepare`（`submissionId` + `snapshot`）→ `generate`（同一 `submissionId`）；`submission` / `submissions` 用于查询。没有提交标识的旧式面板生成请求会被拒绝。下载可传 `submissionId` 和 `artifactIndex` 保存所选产物，并逐项返回成功或错误；旧任务 ID 下载方式仍可用。

**没做的**：即梦的「画布」、即梦专有 Agent 模式、视频参考/音频参考 UI、素材库上传、收藏与分组。
## 实现

| 文件 | 作用 |
| --- | --- |
| `index.js` | DSH Host 入口：确定包根目录配置路径，装配一份媒体实例并交给工具和路由 |
| `mote.js` | 原 Host 导出的兼容入口，保留已有导入路径和方法 |
| `src/host/config/` | 配置规范化、包根目录覆盖文件、profile 镜像写回及密钥保留 |
| `src/host/routes/` | 面板接口、认证产物路由及 Connection 延迟注册/清理 |
| `src/host/tools/` | 四个智能体工具的定义和注册 |
| `src/host/tools/image-workflow.js` | 聊天图片调用的参数验证、固定提交标识、查询、自动保存及展示信息 |
| `src/host/skills/`、`skills/mote-image/` | DSH 技能注册及随包提供的生图操作说明 |
| `src/host/media/` | 共享媒体实例、目录缓存、任务、提交记录与输入快照、参考素材及产物保存 |
| `src/host/channels/` | 渠道选择、请求与错误处理、mote 和 OpenAI 图片驱动 |
| `client.js` | 已构建的单文件客户端，供 DSH 直接加载；请修改 `src/client/` 后重新构建 |
| `src/client/entry.js` | 客户端源码入口：注册 DSH ModuleLoader，取得 DSH 提供的 React |
| `src/client/plugin.js` | DSH 插件注册及依赖装配，将 Host、存储、翻译和 DSH React 接入页面 |
| `src/client/app/Studio.js` | 页面整体状态、生成/轮询/保存流程，以及各功能模块的装配 |
| `src/client/features/composer/` | 提示词、参考图与首尾帧、参数选择、独立模式草稿及生成操作 |
| `src/client/features/gallery/` | 作品列表、卡片及预览弹层，通过回调交给 Studio 处理作品操作 |
| `src/client/features/channels/` | 渠道配置弹窗及模型探测 |
| `src/client/features/chat/` | 读取聊天工具结果、图片卡及预览；只处理插件自己的生图/任务工具 |
| `src/client/ui/` | 菜单、SVG 图标、面板宽度适配、弹窗焦点管理和展示格式 |
| `src/client/styles/studio.js` | 创作台的颜色、间距、组件及响应式 CSS，随客户端构建为单个脚本 |
| `src/client/i18n.js` | 每个插件实例独立的字典、DSH 语言绑定及回退 |
| `src/client/api/host-client.js` | Host 通信：请求封装、地址回退、响应解析及每个插件实例的可用地址缓存 |
| `src/client/domain/model-capabilities.js` | 模型目录选择、默认参数、提交参数过滤、比例转换及参考素材能力 |
| `src/client/domain/works.js` | 作品 ID、任务状态、预览产物选择和诊断信息；状态翻译由页面传入 |
| `src/client/domain/drafts.js` | 输入恢复、缺失信息提示、参考素材角色与数量校验，以及素材放入空位的规则 |
| `src/client/storage/works-storage.js` | 作品记录读取与保存：沿用原存储键、前 120 条上限及异常回退 |
| `scripts/` | 客户端构建、产物一致性、真实安装包检查及本地隔离预览 |
| `tests/` | DSH 加载协议、配置兼容和模拟上游媒体流程测试 |
| `locale/*.json` | 插件在插件管理页展示的标题与描述 |
| `icon.svg` | 插件图标 |

`/api/mote-media` 走 Connection 的认证与 Host/Origin 校验，浏览器不带凭证的请求会被拒绝；密钥本身只留在 Host。


## 安装到 DeepSeek Harness

这是一个 **DSH bundle 包**（`package.json` 里的 `dsh.bundle.patch` + `dsh.client`），不是独立应用，需要 DSH 运行环境。

1. 克隆本仓库到本地任意目录；
2. 在 DSH 的 **插件** 页用「安装本地插件 / 目录」指向该目录，或让智能体调用 `plugin_manager install_bundle`（`target` 传这个目录的绝对路径）；
3. 刷新页面，侧栏出现 **mote 创作台**。

目录安装是软链。开发时修改 `src/client/`，执行 `npm run build` 后刷新 DSH；改 `index.js` / `mote.js` 需要重载插件（禁用→启用）。仓库保留已构建的 `client.js`，安装插件本身无需安装开发依赖。

## 本地开发与验证

开发验证使用 Node.js 22.22.3、npm，以及系统 `tar` 命令（用于解包验证，Windows 自带的 tar 可用）。组件测试使用的 jsdom 需要 Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`。

```sh
npm ci
npm run build
npm run verify
```

客户端源码通过 [esbuild](https://esbuild.github.io/api/#build) 构建成单个浏览器脚本，保留 `window.__ModuleLoader__.load({ id, factory })` 加载协议。React 由 DSH 的 `factory(require)` 提供，不安装或打包第二份 React；构建时若误导入 React/ReactDOM 会报错。

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 从 `src/client/entry.js` 生成根目录 `client.js` |
| `npm run check:build` | 在内存中重新构建，检查 `client.js` 是否与源码一致；不改文件 |
| `npm test` | 使用 Node 内置测试运行器检查客户端注册及 Host 行为 |
| `npm run preview` | 在 loopback 随机端口打开隔离 UI 预览，控制台输出地址；使用模拟作品及渠道，不调用 Host 或真实生成 |
| `npm run check:package` | 离线创建真实 npm 包、检查文件白名单、解包并加载 Host/客户端入口；临时文件自动清理 |
| `npm run verify` | 顺序执行产物检查、测试和安装包检查 |

`client.js` 是构建产物，请勿直接修改。提交客户端源码变更时一并提交更新后的产物。正常执行 `npm pack` 前也会检查产物一致性，避免打包过期的界面。打包检查的 [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) 使用 `--offline --ignore-scripts`，不会发布包。

Host 使用原生 ESM 模块，不需要额外构建。运行包包含 `src/host/`；修改 Host 源码后重载插件。`index.js` 将包根目录的 `.mote-state.json` 路径显式传给配置模块，目录拆分不会搬迁已有配置。工具和面板路由使用同一个媒体实例，配置修改会清除该实例的模型缓存，本地任务由生成与任务模块共用。

客户端基础模块不依赖 React。模型与作品模块集中维护业务规则；`createHostClient()` 和 `createWorksStorage()` 为每个插件实例提供通信与存储访问，直到实际操作时才访问浏览器环境，测试中可传入模拟依赖。Studio 保留整体状态和定时器，各功能模块通过 props 与回调协作。

各组件工厂在插件装配时创建一次，接收 DSH 的 React 和翻译函数，避免重新渲染时更换组件身份。React、ReactDOM 和 jsdom 仅作为开发依赖用于 [真实 React 组件测试](https://react.dev/reference/react/act)，不会进入插件运行包或替代 DSH 的 React。测试 DOM 不加载远端资源；组件测试检查上传与参数交互、作品操作、渠道探测、轮询/保存定时器和菜单监听清理。

测试中的渠道密钥均为固定的虚构值，生成流程只连接测试自己启动的 loopback HTTP 服务，配置与产物写入临时目录；不读取本插件已有的 `.mote-state.json`，不调用真实生成渠道。测试覆盖的是插件本身的行为，Connection 服务的登录、认证及 Origin 校验由 DSH 负责。

隔离预览使用真实页面组件和不同宽高比的模拟素材，包含处理中、待核实和失败状态；地址加 `?empty=1` 查看空状态，`?embed=1` 隐藏模拟侧栏，`?compact=1` 查看 390 px 窄面板。`?chat=1` 查看聊天图片卡，支持叠加 `&compact=1`，或 `&state=pending|unknown|failed-download`。预览脚本及模拟素材不进入运行包。改版范围与验证记录见 [UI 改版验证](docs/ui-redesign-validation.md)、[创作流程验证](docs/creation-workflow-validation.md) 和 [聊天生图技能验证](docs/chat-image-skill-validation.md)。

真实 DSH 的最小检查步骤：确认插件详情中的本地来源目录；刷新后打开「mote 创作台」；切换图片/视频并查看参数和渠道弹窗；关闭后再次进入或刷新，确认页面可重新加载。此过程不点击生成或保存渠道配置。自动化测试通过不等同于完成真实上游生成验收。

## 安全

- 虚拟密钥只存在 Host（profile 配置或本包自己的 `.mote-state.json`，后者已加入 `.gitignore`），不会下发到浏览器；
- 面板路由 `/api/mote-media` 走 Connection 的认证与 Host/Origin 校验，未授权请求 401；产物代理 `/api/mote-media/asset` 只允许非公网目标，且需要浏览器凭证；
- 局域网（`10./172.16-31./192.168./127./localhost`）图片参考会在提交前由 Host 读成 `data:image/...;base64`，因为平台侧拉不到内网地址；视频/音频参考不支持内联，会明确报错。

## License

[MIT](./LICENSE)
