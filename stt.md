
## 项目概述

这是一个纯前端单文件语音转文字应用（`index.html`），使用 Google Gemini API 将语音录音转录为文字。**不含 AI 对话功能**，仅做语音→文字转录并以列表形式展示。

## 技术栈

- **前端**: 纯 HTML + CSS + JavaScript（单文件，无框架、无构建工具）
- **语音转文字**: Google Gemini 2.5 Flash API（`generativelanguage.googleapis.com`）
- **用户认证**: Google OAuth 2.0（Google Identity Services）
- **数据存储**: 浏览器 `localStorage`
- **字体**: Noto Sans SC + Space Mono（Google Fonts）


| 按住左 Shift 录音 | MediaRecorder API 录制 WebM/Opus 格式音频 |
| 语音转文字 | 音频 base64 编码发送给 Gemini，转录为原始语言文字 |
| 转录列表 | 每条记录：时间 + 复制按钮 + 文字内容 + 删除按钮 |
| 手动提交 | 转录后文字放入输入框，用户确认后点击提交按钮提交 |
| 多次录音追加 | 连续录音内容追加到输入框已有文字后面 |
| 多语言支持 | 自动检测语言（中文、韩语、英语、日语等），不翻译 |
| 记录管理 | 新建/切换/删除单条记录、清空所有记录 |
| 100条上限 | 超过100条对话时自动删除最早的 |

## 关键配置


const GEMINI_API_KEY = 'AIzaSyC_MU-HVApJPEOrANKnXzashMkNtDnd9bs';

// 当前使用: gemini-2.5-flash


## 代码结构（index.html 内部模块）


CSS 部分:

  - 侧边栏样式（对话列表、品牌标识）
  - 转录列表样式（transcript-item/time/text/copy/delete）
  - 输入区域样式（textarea 高度 138px）
  - 响应式布局（768px 断点）

JavaScript 部分:
  - CHAT STORAGE: localStorage 读写、100条上限
  - CHAT MANAGEMENT: 新建/选择/删除对话、清空所有（两次点击确认）
  - RENDERING: 转录列表渲染、侧边栏渲染、记录计数
  - GEMINI API: geminiRequest() 带429重试机制（3次，3s/6s/9s间隔）
  - SPEECH TO TEXT: transcribeAudio() 录音转文字
  - RECORDING: MediaRecorder 录音控制
  - KEYBOARD: 左Shift键监听（keydown开始/keyup停止）
  - INPUT: 输入框自动高度、回车=换行（不自动提交）
```

## 设计要点

1. **全局字体放大**: `html,body` 设置 `font-size:2rem`（32px），登录页单独用 `16px`
2. **暗色主题**: 使用 CSS 变量系统（`--bg`, `--accent`, `--fg` 等）
3. **429 限流处理**: `geminiRequest()` 自动重试最多3次，指数退避
4. **转录提示词**: 英文多语言提示，自动检测语种，不翻译
5. **输入框**: 回车键=换行，只能点击提交按钮提交；多次录音追加而非覆盖
6. **删除按钮**: hover 时显示；复制按钮始终显示
7. **清空所有**: 两次点击确认机制，避免误操作

## localStorage 数据结构

```json
// 用户信息
"vc_user": { "name": "...", "email": "...", "picture": "..." }

// 对话记录（按用户邮箱分开存储）
"vc_chats_{email}": [
  {
    "id": "1710000000000",
    "title": "第一条转录内容前30字...",
    "createdAt": "2026-03-16T10:00:00.000Z",
    "messages": [
      { "content": "转录的文字内容", "time": "2026-03-16T10:00:01.000Z" }
    ]
  }
]
```

## 注意事项

- **API Key 暴露**: API Key 直接嵌入前端代码，生产环境应使用后端代理
- **Free Tier 限制**: Gemini API 免费版有每分钟请求数限制，代码已内置429重试
- **模型可用性**: 不同 API Key 可用的模型不同，可通过 `GET /v1beta/models` 查询
- **Safari 兼容**: WebM 录制在 Safari 可能不支持
- **麦克风权限**: 首次使用需要浏览器授权麦克风



仓库地址: https://github.com/openbible365-boop/stt