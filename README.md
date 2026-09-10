# JANE-Desktop-Companion

一个停留在 Windows 桌面上的珍姐陪伴体（V0.1）。

TA不是一个普通软件窗口，而是一个**直接存在于桌面上的小人物**：背景透明、无边框、始终置顶、可拖动，会对鼠标悬停 / 点击 / 连续点击做出反应，偶尔通过气泡说一句话。

## 技术栈

- **Tauri 2**（Rust 后端 + Windows 原生能力）
- **React 18** + **TypeScript**
- **Vite**
- **CSS**（基础 UI 与简单动画）

当前目标平台：Windows 10 / 11。

---

## 开发环境

需要提前安装：

| 组件 | 说明 |
|------|------|
| Node.js | ≥ 18（开发使用 v24） |
| npm | 随 Node 安装 |
| Rust（stable） | 通过 [rustup](https://rustup.rs/) 安装，使用 `x86_64-pc-windows-msvc` 工具链 |
| Microsoft C++ Build Tools | 需要 MSVC（含 `cl.exe`），Rust 在 Windows 上链接需要 |

验证环境：

```bash
node --version
npm --version
rustc --version   # 需要 rustc 1.98+
cargo --version
```

> 提示：如果从国内网络访问 crates.io 较慢，可配置 TUNA 镜像（写入 `~/.cargo/config.toml`）：
>
> ```toml
> [source.crates-io]
> replace-with = "tuna"
> [source.tuna]
> registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"
> ```

---

## 安装依赖

```bash
npm install
```

首次 `cargo` 构建会下载并编译约 400 个 crate，需要几分钟到十几分钟，属正常现象。

---

## 开发运行

```bash
npm run tauri dev
```

启动后，JANE 会出现在**主显示器右下角附近**，背景透明、始终置顶。

### 快捷键

| 快捷键 | 作用 |
|--------|------|
| `Ctrl + Shift + J` | 在「互动模式」与「鼠标穿透」之间切换 |

### 系统托盘

右键托盘图标 `JANE`：

- **互动模式** / **鼠标穿透** — 切换鼠标是否穿透
- **显示 / 隐藏** — 控制 JANE 是否显示
- **重置位置** — 移回主显示器右下角
- **设置** — 打开设置面板
- **退出** — 完全退出

---

## Build（打包 Windows 应用）

```bash
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`（默认 NSIS 安装包）。首次打包会下载 NSIS 工具链。

---

## 人物素材替换

替换以下文件即可（保持文件名不变）：

```
src/assets/character-placeholder.png
```

替换后无需改代码，重启应用即可生效。程序显示高度默认 300px（可在设置面板中调整 80%–150%）。

### 推荐素材规格

```
格式：PNG
尺寸：≥ 1024 × 1024（或与原图比例一致的高清竖图）
背景：透明
色彩：sRGB
```

> 当前占位素材位于 `assets-reference/character-placeholder.png`（1280 × 1919），仅作开发参考，实际显示的是 `src/assets/` 下的副本。

---

## 配置存储（Local First）

所有设置保存在本机，无任何联网 / 登录 / 遥测：

```
%APPDATA%/com.jane.companion/settings.json
```

字段：`characterPosition`、`characterScale`、`dialogueFrequency`、`idleAnimationEnabled`、`passthroughMode`。

---

## 目录结构

```
src/
├── assets/            # 人物素材（替换这里）
├── components/        # Character / SpeechBubble / SettingsPanel
├── data/              # 台词（dialogues.ts）
├── hooks/             # useCharacterState / useIdleBehavior / useDialogue / useRapidClick
├── services/          # settings / window（Tauri API 集中在此）
├── types/             # 类型定义
├── config/            # 可调参数（避免散落 Magic Number）
├── App.tsx
└── main.tsx

src-tauri/
├── src/
│   ├── main.rs
│   ├── lib.rs         # 命令、托盘、快捷键、窗口定位
│   └── config.rs      # 本地配置读写
├── icons/
├── capabilities/
├── tauri.conf.json
└── Cargo.toml
```

职责划分：人物渲染 / 状态 / 互动逻辑 / 台词 / 配置 / 本地存储 / Tauri Window API 各自独立。

---

