# mote Media Studio (DSH plugin)

在 DeepSeek Harness 里通过 **mote 媒体渠道** 生成图片和视频：一块无限画布 + 四个智能体工具，共用同一套 Host 实现。

- 平台接口参考：<https://platform.sgt.site/docs/>
- 交互形态参考开源项目 [MuRanSea/media-workstage](https://github.com/MuRanSea/media-workstage)：一张卡反复生成、结果留在本地、多模型集中使用。

## 渠道配置（多渠道路由）

一个「渠道」= 一个可达的上游（地址 + 密钥）。两类驱动：

| 驱动 | 覆盖 | 说明 |
| --- | --- | --- |
| `mote` | 图片、视频、3D、模型目录 | 一把 mote 密钥就覆盖 Seedream、Seedance、Nano Banana / Gemini、GPT Image、可灵、MiniMax H3、混元 / Tripo |
| `openai-images` | 图片 | 任意 OpenAI 兼容 `POST {base}/v1/images/generations`，自己填模型 id；返回链接或 Base64 都能用（Base64 会落盘，再经插件自己的认证路由回显） |

模型目录**跨渠道聚合**，每条模型都带它所属的渠道；生成时按模型的归属自动选渠道，也可以显式传 `channel` 指定。面板里的模型下拉按渠道分组（`optgroup`）。

配置写在 profile 的 `cordis.patch.yml` 中本插件的行里，或在画布的「渠道设置」里增删渠道（写回同一行；面板拿不到已存密钥，留空表示沿用旧值）：

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
    outputDir: ''                          # 留空 = %USERPROFILE%\Pictures\mote-media
    pollIntervalMs: 3000                   # 轮询间隔，500–30000
```

旧版单渠道写法（`baseUrl` + `apiKey` 平铺）仍然可用，加载时自动变成一个 id 为 `mote` 的渠道，已存的密钥保留。密钥只留在 Host；浏览器拿到的是渠道名和「是否已配置」，不含密钥。

## 智能体工具

| 工具 | 用途 |
| --- | --- |
| `mote_models` | 列出各渠道可用的图片/视频模型、参数取值与所属渠道（可传 `channel` 只看一个渠道） |
| `mote_image` | 文生图 / 参考图编辑（Seedream、Nano Banana/Gemini、GPT Image、OpenAI 兼容），完成后自动落盘，可传 `channel` |
| `mote_video` | 文生视频 / 首帧 / 首尾帧 / 多模态参考（Seedance、可灵、MiniMax H3），返回任务 ID，可传 `channel` |
| `mote_media_task` | `status` 轮询、`cancel` 取消排队中的 Seedance 任务、`download` 下载产物 |

视频只能走 `mote` 渠道（OpenAI 兼容驱动目前只做图片）。视频任务用 `mote_media_task` 轮询到 `succeeded` 后再 `download`；签名链接会过期，尽早下载。

## Web 创作台（即梦式）

侧栏 **mote 创作台** 打开是一整页暗色创作台，结构对齐即梦首页：

| 即梦的元素 | 这里的实现 |
| --- | --- |
| 顶部胶囊「生成 / 画布」 | 顶部导航 + 首屏胶囊按钮：**图片生成 / 视频生成**（没有画布，所以两个钮都是生成） |
| 居中问候「你好，今天想要创作什么？」 | 同一句，出过作品后自动收成小标题 |
| 大输入卡：左侧 `+` 上传位 + 中间提示词 | `＋` 格就是**参考图**（图片模式）或**首帧/尾帧**（视频模式）；点格选本地图，`data:` 内联提交（单张 ≤ 2 MB） |
| 底部栏：Agent 模式 ▾ / 技能 / `@` / 麦克风 / 圆形发送键 | 底部栏换成可用的参数：**创作类型 ▾**（图片/视频）、**模型 ▾**、**比例 ▾**、**清晰度 ▾**、**张数 ▾**、视频再加**时长 ▾** 和**声音**开关，右侧同一个渐变**圆形发送键** |
| 技能 chips 一行 | 换成**提示词灵感** chips，点一下直接填进提示词 |
| 功能卡网格（短剧工作室 / 即梦画布 / 智能超清…） | 换成四张**模式卡**：文生图 / 参考图生图 / 文生视频 / 首尾帧生视频，点一下切到对应模式 |
| 下方「我的作品」瀑布 | **我的作品**网格：排队中转圈、完成显示缩略图（视频悬停静音播放），悬停四个动作：预览 / 保存到本地 / 用作参考（自动填回参考图或首尾帧）/ 删除；点开是带生成信息的大图弹层 |

行为细节：`⌘/Ctrl + Enter` 直接生成；参数菜单是暗色弹出层（不是原生 select）；作品存在浏览器本地（`mote-media.studio.v1`），刷新后还在、没跑完的任务会继续轮询；多张产出会展开成多条作品。

渠道设置换成同风格的暗色弹窗，支持多渠道路由（mote 统一渠道 + OpenAI 兼容渠道）。

**没做的**：即梦的「画布」、Agent 模式与技能、视频参考/音频参考、素材库上传、收藏与分组。
## 实现

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host：注册四个工具、`/api/mote-media` 认证路由与本地产物路由、把「渠道设置」写回 Loader 行 |
| `mote.js` | Host：多渠道路由与平台调用（生成、任务、模型目录、下载），工具与路由共用 |
| `client.js` | Client：即梦式暗色创作台（问候 + 大输入卡 + 作品网格）、渠道设置、侧栏图标，只与本插件 Host 路由通信 |
| `locale/*.json` | 插件在插件管理页展示的标题与描述 |
| `icon.svg` | 插件图标 |

`/api/mote-media` 走 Connection 的认证与 Host/Origin 校验，浏览器不带凭证的请求会被拒绝；密钥本身只留在 Host。


## 安装到 DeepSeek Harness

这是一个 **DSH bundle 包**（`package.json` 里的 `dsh.bundle.patch` + `dsh.client`），不是独立应用，需要 DSH 运行环境。

1. 克隆本仓库到本地任意目录；
2. 在 DSH 的 **插件** 页用「安装本地插件 / 目录」指向该目录，或让智能体调用 `plugin_manager install_bundle`（`target` 传这个目录的绝对路径）；
3. 刷新页面，侧栏出现 **mote 创作台**。

目录安装是软链，改完 `client.js` 刷新即可生效；改 `index.js` / `mote.js` 需要重载插件（禁用→启用）。

## 安全

- 虚拟密钥只存在 Host（profile 配置或本包自己的 `.mote-state.json`，后者已加入 `.gitignore`），不会下发到浏览器；
- 面板路由 `/api/mote-media` 走 Connection 的认证与 Host/Origin 校验，未授权请求 401；产物代理 `/api/mote-media/asset` 只允许非公网目标，且需要浏览器凭证；
- 局域网（`10./172.16-31./192.168./127./localhost`）图片参考会在提交前由 Host 读成 `data:image/...;base64`，因为平台侧拉不到内网地址；视频/音频参考不支持内联，会明确报错。

## License

[MIT](./LICENSE)