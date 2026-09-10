# JANE 项目记忆 / 状态速查

> 最后更新：2026-08-30（v1.0 已发布，由 opencode 维护，供后续会话快速恢复上下文）

## 当前状态速览

- **v1.0 已发布**：`src-tauri\target\release\bundle\nsis\Dear Jane_1.0.0_x64-setup.exe`（74.6MB，NSIS per-user，未签名）
- 用户机器上已安装并运行安装版（%LOCALAPPDATA%\Dear Jane），开发与安装版可并存
- 安装包自带全部资源（47 PNG + 7 webm 动作 + focus_com + 台词全部内嵌主 exe），与开发目录完全无关（已实测：重命名素材目录应用不受影响、安装文件零开发路径字符串）

## 项目是什么

JANE（展示名 Dear Jane）是一个 Windows 桌面陪伴应用（不是桌宠养成）。一个透明、无边框、始终置顶的小人物长期停留在桌面，会做轻微动作、对鼠标互动做出克制反应、偶尔通过气泡说一句话，并带「专注」「今日目标」「下一次见 Jane 倒计时」等轻量功能。

## 技术栈

- **Tauri 2**（Rust 后端 + Windows 原生能力）
- **React 18 + TypeScript + Vite**
- **CSS** 做透明窗口与全部动画
- 目标平台 Windows 10/11，代码尽量不绑定 Windows

## 目录结构（关键）

```
src/
├── components/           # Character 渲染、SpeechBubble、Settings、Focus、Goals、Concert、Timeline、Debug、AssetLab
│   └── character/        # CharacterRoot（交互/拖动）、CharacterRenderer（纯渲染）、CharacterPhotoView、CharacterAssetView
│   └── JaneContextMenu.tsx  # 主窗口右键菜单（打开各子窗口）
├── data/dialogues/       # ★ 台词数据层（改台词在这里）
├── hooks/                # useCharacterController、useDialogue、useAssetSelection、useSequenceFrame、useCharacterAsset
├── infrastructure/       # 核心服务：DialogueEngine、BehaviorScheduler、TimeContext、UserActivityContext、FocusSession/History、GoalsStore、ConcertStore、TimelineStore、AssetLibrary、assetPipeline
├── services/             # settings、window、system（Tauri API 集中）
├── types/                # character、behavior、dialogue、asset、photoAsset、focus、goals、concert
├── config/               # character、behavior、dialogue、focus、characterAssets（集中常量）
├── assets/               # 人物素材（placeholder）
├── App.tsx               # 顶层接线
├── main.tsx              # 按窗口 label 路由（main/settings/goals/concert）
└── SettingsWindow.tsx / GoalsWindow.tsx / ConcertWindow.tsx（各窗口入口组件，在 components/ 下）

src-tauri/
├── src/lib.rs            # 命令、托盘、快捷键、窗口定位、空闲时间
├── src/config.rs         # AppSettings + 本地 JSON 持久化
├── tauri.conf.json       # 窗口配置（main/settings/goals/concert）
├── capabilities/         # 权限（main/settings/goals/concert）
└── icons/                # ★ 正式图标（源图 LOGO.png → icon-source.png 1024 居中 → `npx tauri icon` 生成全套；tray-icon.rgba 是 32×32 原始 RGBA，托盘 include_bytes! 嵌入，无 image crate）

Jane_pics/                # ★ 真人透明 PNG 素材（47 张，import.meta.glob 扫描）
JaneActions/              # ★ 动作视频（7 个 webm VP9+alpha，import.meta.glob 扫描，构建期内嵌）
focus/focus_com.png       # 专注完成奖励图（弹窗 + 完成后人物本体短暂展示，Vite import）
JANE 日常陪伴台词库 V1.md  # 台词库原文（迁移来源）
```

## 已实现功能

1. **透明桌面人物**：transparent / 无边框 / 无标题栏 / always-on-top / 不进任务栏 / 无阴影
2. **拖动**（移动真实窗口，按移动阈值区分 click/drag）、**Hover/Click/连点**、**气泡**（单气泡、长句换行、左右避让）
3. **鼠标穿透**：Ctrl+Shift+J 快捷键 + 托盘切换，交互/穿透两种模式
4. **系统托盘**：互动/穿透、显示隐藏、重置位置、专注、今日目标、下一次见 Jane、设置、退出
5. **位置保存 + 多显示器/DPI 恢复**（物理坐标、越界回退主屏右下角）
6. **设置**（独立窗口）：人物大小、说话频率、Idle、穿透、专注默认时长/自动休息/显示倒计时
7. **角色架构**：State / Expression / Reaction / Pose / lookId 分离；CharacterController 单一状态源
8. **资产系统**：Asset Manifest + 预加载 + 缓存 + fallback + cross-fade；支持 static/animatedImage/sequence
9. **行为调度**：BehaviorScheduler（权重/随机间隔/cooldown/优先级/interrupt/取消），感知 focus 与 concert 上下文
10. **上下文**：TimeContext（morning/afternoon/evening/night）、UserActivityContext（active/temporarilyAway/longAway）、ConcertContext（normal/…/today）
11. **Dialogue Engine**：统一 DialogueEntry + 权重 + 最近去重 + tone 连续性 + cooldown + focus 抑制 + 优先级
12. **Focus（陪我专注）**：start/pause/resume/finish/cancel，25/50/90/自定义，计时器，完成弹窗，本地历史（completed/cancelled 区分）
13. **Today Goals（今日目标）**：不限数量（原 MAX_GOALS_PER_DAY=3 已移除）；增删改完成，跨天保留历史；goalComplete/allGoalsComplete 反应；**"全部完成"庆祝台词每天只触发一次**（GoalsStore.shouldCelebrateAllComplete/markAllCompleteCelebrated，localStorage jane.goals-celebrated.v1，重加目标后再补勾回落 completeOne）
14. **Next Jane（下一次见 Jane 倒计时）**：手动设日期/城市/备注，ConcertContext 分级，today 时切 stage/concert look
15. **我见过 Jane（Timeline）**：过去见面的记录（id/date/city/eventType/note/createdAt/updatedAt），eventType 四类（concert/festival/event/other），增删改查、日期倒序、跨年排序、允许同日多条；localStorage key `jane.timeline.v1`，忽略状态 `jane.timeline.suggest.v1`。Tray + Jane 右键菜单（`jane-open` 事件 → Rust 白名单放行）打开 timeline 窗口。Concert 过期后 Timeline 窗口出现"加入记录"提示（不自动添加，忽略按事件日期去重）。保存新记录 emit `timeline-record-added` → 主窗口轻 reaction + `dialogueEngine.request("timeline.recordAdded", ctx)`；第三句台词 weight 1 且仅当记录数 ≥ 3（DialogueContext.timelineCount）。跨窗口用 localStorage `storage` 事件同步。
16. **Timeline 封面图（coverImage）**：每条记录最多 1 张本地图片（PNG/JPG/WebP）。`coverImage` 为相对引用 `<recordId>/cover.<ext>`；实际文件在 `%APPDATA%/com.jane.companion/timeline-assets/<recordId>/cover.<ext>`（Rust 复制，原图不动）。Rust 命令：`timeline_save_cover`（写入前清掉旧 cover.*，替换无残留）、`timeline_read_cover`（返回 base64 data URL，**未用 asset protocol**——crates 索引 403 无法下载 http-range；base64 编解码手写在 timeline_assets.rs，8 个单元测试）、`timeline_delete_cover`、`timeline_delete_record_assets`（删记录时清理整个目录，幂等）。前端 service：`services/timelineAssets.ts`（saveCover/readCoverDataUrl/deleteCover/deleteRecordAssets + data URL 缓存）。UI：列表 44px 缩略图（点击大图预览，读失败/缺失显示 placeholder），表单里添加/替换/删除照片（deferred 到保存时提交，取消不生效）。旧记录无 coverImage 字段照常工作（Node 测试覆盖）。
17. **造型切换（Look Switcher）**：lookId = 5 个 Pose 分类（standing 站姿/sitting 坐姿/relaxed 放松/focus 专注/concert 演出，`config/looks.ts` POSE_TABS 中文标签，POSE_TO_LOOK 恒等映射；素材前缀→pose：b→standing、s→sitting、st/fa→concert、c→relaxed、f/focus→focus，AssetLibrary 迁移标记 `migrated-categories-v3` 清旧 category/lookId、保留 scale/offset）。`LookSwitcherStore`（localStorage `jane.look.v1`：baseAssetId/locked/favoriteAssetIds——收藏 UI 已按要求移除，字段保留兼容）。**base + temporaryOverride**：overrideActive=focus/concertToday，期间 preferredAssetId=null 自动选图，结束 applyBasePose 恢复 base。入口：Tray「换个样子」子菜单 + Jane 右键菜单同构——**选择造型是二级子菜单**（5 个中文 pose 项 → emit `look-pose`{pose}，托盘 Rust 直接发、右键菜单 CSS hover 向左展开因 Jane 在右下角），**无选择造型窗口**（原 looks 窗口已删）。App 监听 look-pose：pickRandomOfPose 随机选图 → setBaseAsset + pose/lookId（override 期间只改 base）→ showToast 反馈；`look-changed` 仅剩 Asset Lab "Set as Current" 使用。**换一个**：pickAnotherAsset 排除当前、仅 standing/relaxed/sitting。设置 startupLookMode：保持上次/随机站姿（randomFavorite 已从 UI 移除，代码保留兼容）。Asset Lab 只有 Set as Current。Node 测试 `scripts/test-look.mjs`。
18. **人物动作系统（CharacterAction）**：与 CharacterState 分离的一次性短动作。类型 `types/action.ts`（CharacterActionDefinition：id/label/assetId/loop/interruptible/enabled/order/tags，"stage" 标签 = Concert 可用）。定义在 `config/characterActions.ts`（placeholder：wave 挥手/heart 比心/clap 鼓掌/dance 跳舞/mic 拿麦；序列注册表 `ACTION_SEQUENCES` 目前为空——真实素材到位后把 SequenceAsset 填进去即可，未注册的动作在菜单里 disabled 且 play() 返回 unavailable，永不报错）。门控纯函数 isActionAllowed：focus 全禁、concert 仅 stage、normal 全开。播放状态机 `infrastructure/ActionPlayer.ts`（frame tick/loop 回绕/非循环播完 finish→onComplete；同一动作再点=toggle off；interruptible=false 拒绝打断除非 force；handleTick 供测试）。App：playCharacterAction 走门控+toast；action started→behaviorScheduler.stop()+清 idle；onComplete→applyBasePose+scheduler.start()；拖动（onWindowMoved）与 startFocus 强制 stop(true)（系统状态 > 动作）。渲染：CharacterRenderer 新增 action prop（frames+frame），action 帧优先于 photo。右键菜单「动作 >」子菜单由 actionMenuItems 动态生成（按 order 排序，无素材 disabled 灰色）。右键菜单另有「陪我专注」子菜单（25/50/90/自定义 → emit focus-start）。Debug Panel Action 区：per-action ▶ Play（走同一门控）、■ Stop(force)、状态行 actionId frame/total fps interruptible。Node 测试 `scripts/test-action.mjs`（esbuild 需 --loader:.png=dataurl）。
18.5 **命名调整**：Timeline 窗口/托盘名「我与Jane的约会记录」（右键菜单已移除该入口）；Concert 窗口/托盘/右键「下一次Jane面」；Timeline 建议条同步。
19. **视频动作系统（Video Action）**：CharacterAction 支持 `type: "video"` 资产（`types/asset.ts` VideoAsset：src/loop/muted/playbackRate）。视频放 `JaneActions/`，`config/characterActions.ts` 里 `ACTION_VIDEOS` 注册（assetId→{file(不带扩展名),loop,muted,playbackRate,scale,offsetX,offsetY}），`import.meta.glob("JaneActions/*.{webm,mp4}")` 构建期扫描，**同 basename .webm 优先于 .mp4**（webm=VP9+alpha 有透明，mp4 是黑底）。7 个动作全部就绪（webm 真 alpha）：heart 比个心/adjustGlasses 扶眼镜/catAngry 小猫生气/catPeek 小猫探头/smile 笑一下/trexCute 霸王龙卖萌/catConfused 小猫疑惑。ActionPlayer 扩展 video 分支：无计时器，由渲染层 `<video>` 驱动——`videoEnded()`（ended/error 都触发，防卡死）、`reportVideoProgress()`（喂 Debug 面板）、`pauseVideo/resumeVideo/restart`（nonce 递增驱动 video remount 重播）、stop(force) 照常。渲染：`CharacterVideoActionView.tsx`（autoplay/muted/playsInline/controls=false/disablePiP，pointer-events:none 不挡拖动，仅在动作播放期间挂载→零启动开销、浏览器缓存）。CharacterRenderer 优先级：action video > action frame > photo > fallback（视频期间完全替换静态 Jane，无双层）。每个动作独立 scale/offsetX/offsetY 校准：`infrastructure/ActionVideoCalibration.ts`（localStorage `jane.action-video-cal.v1`，按 actionId 存，get 合并默认值），Debug 面板滑杆实时调+持久化。Debug Panel Action 区：video 显示 currentTime/duration/paused + Pause/Resume/Restart + 三滑杆。**App 的 `action-play` 监听**（右键菜单「动作」→ App 接收）。测试 `scripts/test-action.mjs`（12 组：manifest/门控/video 流程/打断/toggle/restart/force stop/sequence 回归/校准 store；node 下 import.meta.glob 抛错被 catch→用 `registerActionVideoUrl` 注入）。
19.5 **开机启动（Autostart）**：官方 `tauri-plugin-autostart` v2（Rust crate + `@tauri-apps/plugin-autostart` npm 包）。lib.rs Builder `.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))`；capabilities/default.json 加 `autostart:allow-enable/disable/is-enabled`（settings 窗口在 default capability 内）。SettingsPanel：`isEnabled()` 是唯一 source of truth（mount + `settings-window-shown` 时同步），toggle 成功后重读 isEnabled() 再更新 UI（防"UI 已开但系统未注册"），失败 console.error + 行内红色提示（4s 自清）+ syncAutostart 回滚，进行中/未知时 disabled；settings.json 不存任何 autostart 字段。Windows 实现为 HKCU Run 注册表键（任务管理器"启动应用"可见）。注意：cargo 全局 TUNA 镜像 403，已加 `src-tauri/.cargo/config.toml` 项目级覆盖到 USTC sparse（若全局镜像恢复可删）。
20. **右键菜单子菜单重写（修 hover 闪退 bug）**：旧实现子菜单显隐由 CSS `:hover` 驱动，子菜单锚定菜单根+父项间有 padding 空隙带，鼠标穿过空隙即 `:hover` 失效→子菜单瞬间消失（慢速移动必现）。新实现（JaneContextMenu.tsx 全量重写）：统一 Menu State `openSubmenu: "looks"|"actions"|"focus"|null`（含「陪我专注」子菜单），显隐由状态类 `.jane-context-menu__submenu--open` 驱动（CSS hover 规则已删）；整个菜单树只有根元素的 onMouseLeave 会 scheduleClose（300ms 延迟），onMouseEnter（根或子菜单）cancelScheduledClose；hover 父项开自己的子菜单、hover 普通项关子菜单、子菜单顶对齐父项+useLayoutEffect 实测高度防溢出（clamp 后 inline style top）；关闭条件=延迟到期/点击外部(window click)/Esc(window keydown)/window blur/点任意菜单项；timer 在 unmount/menu close 时清理；`.jane-context-menu__group--open` 保持父项高亮。Playwright 交互测试 18/18（慢速/快速/空隙/停留/Esc/外点/子菜单切换），测试脚本在 %TEMP%\opencode\test-context-menu.py（带 __TAURI_INTERNALS__ 桩可在纯浏览器挂载 App）。
20.5 **紧凑主窗口 + 独立气泡窗口（修透明区域拦截点击）**：原 main 窗口固定 380×450，Jane 内容仅约 200×300 且 PNG 画布有 4–24% 透明边距 → 大片透明区域拦截鼠标。重写：①`scripts/measure-content-boxes.cjs` 用 jimp 实测 47+1 张 PNG 的 alpha>8 包围盒 → `src/config/photoContentBoxes.ts`（PhotoGeometry：width/height/contentBox 分数，缺省回退 full canvas）；②`infrastructure/windowBounds.ts` 纯几何模块（contentRectInWindow 按渲染链定位内容、compactWindowBounds 以"内容底中心点屏幕坐标不变"为锚计算紧凑窗口+显示器 clamp、clipPathFor、boundsAlmostEqual）+ `scripts/test-window-bounds.mjs`；③img 全部按 contentBox 加 clip-path（命中区=可见人物，PNG 透明边不再拦截）；④Rust 新命令 `set_character_bounds(x,y,w,h)`（物理像素，set_size+set_position+持久化），Position 结构加 width/height（serde default 兼容旧配置），启动恢复尺寸、退出保存尺寸；⑤App computeBoundsTarget effect：依赖 photo/scale/action(video 尺寸)/校准/monitor，boundsAlmostEqual 防抖，programmaticMoveUntilRef 400ms 区分"程序性 resize 的 Moved"与"拖动"（前者不停 action 不重复存位置）；⑥动作播放时窗口临时放宽到视频尺寸（ActionPlayer.reportVideoSize 由 <video> loadedmetadata 上报 videoWidth/Height 进 ActionPlayState），结束恢复 normal bounds；⑦**气泡独立窗口**：conf 新增 label "bubble"（380×300 透明置顶 focus:false visible:false），Rust setup 里 show 一次+永久 set_ignore_cursor_events(true)（之后只改内容/位置，绝不抢焦点不拦鼠标），main.tsx 路由 "bubble" → BubbleWindow.tsx（listen bubble-show：先 setSize/setPosition 再渲染；bubble-hide 清空），主窗口 useDialogue 逻辑不变、删 SpeechBubble 组件渲染改为 emit bubble-show{ text,nonce,hiding,side,x,y,width,height }（placement 由窗口物理框+monitor clamp 算，left/right/top 三向），bubble-stage CSS 内容贴向 Jane 一侧。注意：窗口尺寸变化时 conf main 默认 300×380。
20.6 **紧凑窗口漂移修复（Jane 自己跑）**：初版每次从"当前窗口"推导锚点，但布局把内容放在与画布中心偏移 K 处（PNG 内容不居中 + offsetX），每轮重算 x 偏移 K·s、y 偏移 (mb−D)·s，且自己的 set_position 触发 Moved→monitorBounds 刷新→重算 → 正反馈无限漂移。修复：锚点改为存储状态 anchorRef（内容底中心屏幕坐标），`layoutCompactWindow` 纯函数从锚点+布局常量计算（确定性，同输入同输出），clamp 后回写 achieved anchor 防振荡；拖动时锚点随窗口 delta 平移（onWindowMoved 先取 prevBounds 再更新，非 programmatic 分支）；锚点一次性从当前窗口初始化。测试含 10 轮重排 no-drift 回归 + clamp 稳定性。
20.7 **产品命名统一 Dear Jane**：productName "JANE"→"Dear Jane"（安装器/开始菜单/已安装列表名跟随；identifier com.jane.companion 与 crate 名 jane-desktop-companion 保留）；托盘 tooltip "Dear Jane"（lib.rs TrayIconBuilder）；窗口 title：main/bubble="Dear Jane"、settings="Dear Jane 设置"（goals/concert/timeline 无品牌名不动）；SettingsPanel eyebrow "Dear Jane / PREFERENCES"；img alt="Dear Jane"（4 处）；index.html title。内部标识（localStorage key、日志、注释、package name、路径）不动；托盘菜单项无品牌名。
20.8 **菜单打开时窗口临时放宽 + 气泡防重叠**：紧凑窗口里右键菜单+二级菜单（窗口内渲染，right:10/bottom:10 锚定）横向/纵向被裁。修复：JaneContextMenu 加 onOpenChange → App menuOpen state → bounds effect 传 minWidthL/minHeightL（CONTEXT_MENU_WINDOW_MIN 300×296 logical）给 layoutCompactWindow——底边与内容中心固定，窗口只在左/上方向扩张，Jane 视觉不动，关闭后缩回。气泡防重叠：`placeBubbleWindow`（windowBounds.ts 纯函数）候选 top/left/right（preferred 优先），候选 clamp 到显示器后检查与人物屏幕内容框（+8px gap）是否相交，第一个不相交的胜出；全冲突才回退 preferred（几何无解）；BubbleWindow 每次 bubble-show 定位后 `setAlwaysOnTop(true)`（防托盘"显示 Jane"把主窗口提到气泡前）；Rust toggle_visibility show 分支同样重申 bubble 置顶。capability 加 core:window:allow-set-always-on-top。
20.9 **裁切根治（约束求解 + 偏移钳制）**：头部/侧边裁切真因 = Asset Lab 旧校准的负 offsetY/offsetX 把内容推出紧凑窗口。layoutCompactWindow 改为约束求解：布局常量 A = offsetX + (cb.x−0.5)·imgW（横向）、B = imgH(1−cb.y) − offsetY（纵向），widthL = max(contentW+2mx, 2(m.x−A), 2(A+contentW+m.x), minW)、heightL = max(rectH+mt+mb, mt+B, minH)——任意校准值内容都完整落在边距内。唯一无解情形：正 offsetY 超出画布底部留白（img 底边钉在窗口底边）→ 新增 `clampVerticalOffset`（渲染偏移与窗口计算共用同一钳制值，App 层 displayPhoto/buildActionView/resolveContentLayout 三处统一）。defaultHeight 300→306（"高一点点"）。测试含全资产×恶劣校准扫描不变量。
21. **主动台词接线（Proactive Dialogue）**：time.*/activity.return.*/activity.longWork/rare.general/jane.meeting 此前已注册但无任何调用点（dead pools，pickIdle 写死 idle.general）。新 `infrastructure/ProactiveDialogueResolver.ts`（纯函数）：`timeDialogueKey`（morning/afternoon/evening 直用 TimeContext；night 按 hour 细分 23/0/1→lateNight、2/3/4→deepNight.rare）、`returnKeyFor`（<5min null、5–30min short、≥30min long）、`collectProactiveDialogueCandidates`（DialogueCandidate{key,priority,reason} 排序：return 90 > longWork 70 > time 60 > idle 40 > jane.meeting 20 > rare 10，jane.meeting 需 ConcertStore.hasUpcomingMeeting()）、`ContinuousActiveTracker`（连续活跃累计，idle≥5min 重置 session，单样本增量钳 60s）。UserActivityContext：捕获 away→active 一次性转换（pendingReturn={awayMs}，consumeReturn 消费即清）、tracker 接入 poll、markLongWorkNudged。App：`runProactiveDialogue(returnAwayMs)` 统一入口（§焦点/动作播放/气泡显示三个静默门 + 候选顺序请求引擎 + return 25%/longWork 35% 概率门 + 每轮最多 1 条），idleSpeak 分支与 userActivity 订阅（consumeReturn）都走它；focus 压制由 DialogueEngine 既有 FOCUS_SUPPRESSED_CATEGORIES 生效；recent/tone/cooldown 全部沿用引擎。jane.ts 数据里有 3 条重复 id "jane.meeting.10"（数据质量小疵，未改）。
21.5 **专注态换装 + 完成奖励序列**：专注中"选择造型→专注"立即切换专注分类内随机造型（preferredAssetId 在 focus 时也生效，pick() 校验 category===pose）；**专注时选择造型子菜单只显示"专注"一项**（JaneContextMenu lookTabs 过滤）；"换一个"专注中在专注池内轮换。**专注完成奖励序列（v1.0 规范版）**：完成 → focus_com 弹窗（3s，期间保持专注造型）→ 弹窗关闭后人物本体独占显示 focus/focus_com.png 3s（FOCUS_CONFIG.completionPhotoMs=3000，经 action-sequence 层渲染单帧，独占视觉）→ `finishFocusComplete()`：随机普通姿势（未锁定→NORMAL_POSES 随机分类+该分类随机素材并 setBaseAsset；锁定→当前 look 分类内随机）→ behaviorScheduler.start()。取消/中止立即 applyBasePose+scheduler，不触发奖励图。§门：completionPhotoActive 期间 runProactiveDialogue/playCharacterAction 均拒绝；scheduler 在奖励期间保持 stop；startFocus 清理两个完成 timer+状态（防旧 timer 跨 session 触发）；一次 session 一次完成事件（onSessionEnd 事件驱动）。focus_com 几何分支在 resolveContentLayout（{0,0.0321,1,0.9679}）。资源经 Vite import 打包（focus/focus_com.png，无绝对路径）。另有：inline-block 基线空隙修复（.character__photo/.character__video display:block+line-height:0，此前整个图被行盒基线垫高 ~4px 导致头顶裁切）、defaultHeight 300→306。
22. **v1.0 Release**：版本三方同步 1.0.0（tauri.conf.json/Cargo.toml/package.json）；bundle.windows.nsis.installMode="currentUser"（per-user 免管理员，装到 %LOCALAPPDATA%\Dear Jane）；webviewInstallMode=downloadBootstrapper（默认）。产物 `Dear Jane_1.0.0_x64-setup.exe`（74.6MB，前端全部内嵌进主 exe：47 PNG+7 webm+focus_com+台词，无外部资源文件）。审计：源码无绝对路径/无 localhost（devUrl 仅 dev）/无 console.log；Debug Panel+Asset Lab 仅 import.meta.env.DEV。安装测试（/S 静默）：装到 %LOCALAPPDATA%\Dear Jane，开始菜单快捷方式指向安装 exe；安装版启动 Title=Dear Jane；**重命名 Jane_pics/JaneActions/focus/src/dist 全部成功且应用不持句柄 + 安装文件零开发路径字符串**（关键验收）；卸载测试（uninstall.exe /S）目录/快捷方式/卸载注册表项全清；重装后用户配置（%APPDATA%\com.jane.companion）保留。已知：exe 名为 crate 名 jane-desktop-companion.exe（快捷方式/开始菜单显示 Dear Jane）；unsigned 安装包 SmartScreen 可能提示"更多信息→仍要运行"；主 exe 内嵌 Rust panic 路径字符串属编译信息非运行时依赖。

## 架构要点

### 角色渲染链

```
业务层（App）
  ↓ 只传 state / expression / reaction / pose / lookId
useCharacterController（单一状态源）
  ↓
CharacterRoot（交互 + 拖动阈值）
  ↓
CharacterRenderer（资产解析 + 动画分层）
  ↓
CharacterPhotoView / CharacterAssetView（照片 cross-fade 或 static/sequence）
```

### 台词系统（★改台词只看这里）

- 数据：`src/data/dialogues/*.ts`，每条 `dlg("id", "文案", weight, "tone")`
- 注册：`src/data/dialogues/index.ts` 的 `DIALOGUE_REGISTRY`（语义 key → 数组）
- 选择器：`src/infrastructure/DialogueEngine.ts`（stateful：cooldown + recent 去重 + tone 连续性 + focus 抑制 + 加权随机）
- 入口：业务代码只调 `dialogueEngine.request("某个.key")`，不直接 import 数组

**改台词：直接改 `dlg(...)` 里的中文，不用动任何组件/逻辑。**

### 资产系统（★换素材看这里）

- `src/config/characterAssets.ts`：静态 manifest（占位图）
- `src/infrastructure/AssetLibrary.ts`：扫描 Jane_pics/*.png，localStorage 持久化 metadata（category/lookId/scale/offset/weight/enabled）
- `src/hooks/useAssetSelection.ts`：pose+lookId+weight 选择照片
- Asset Lab（dev-only）：浏览/预览/调 metadata

## 运行 / 打包

```bash
npm install          # 首次
npm run tauri dev    # 开发运行（Vite + Tauri）
npm run tauri build  # 打包（NSIS per-user，产物在 src-tauri/target/release/bundle/nsis/）
npm run build        # 仅前端 tsc + vite build
```

Node 测试脚本（esbuild --loader:.png=dataurl 打包后运行）：`scripts/test-{action,look,timeline,window-bounds,proactive-dialogue}.mjs`。
校验命令：`npx tsc --noEmit`（TS）、`cd src-tauri && cargo check`（Rust，镜像走 src-tauri/.cargo/config.toml→USTC）。

## 调试

- Dev 模式窗口顶部有 **Debug Panel**（关闭后左上角「Debug」圆点可重开）：State/Expression/Reaction/Pose/lookId、Asset 预览、Focus 模拟、Goals 模拟、Concert 模拟（T-30/7/3/1/Today）、Timeline 调试（Add Test Record / Simulate Past Concert / Trigger recordAdded）、Time/Activity 覆盖、Behavior 触发、Dialogue 触发与查看
- **Asset Lab**：左上角「Asset Lab」按钮，浏览/调 47 张素材

## 已知限制 / TODO

- 视频动作素材：7/7 webm 全部就绪（真 alpha）；新增素材放 JaneActions/ 即自动生效（webm 优先于同名 mp4；黑底 mp4 二次转换会有 alpha≈196 的黑纱，不可用）
- 数据持久化：settings/timeline 资产在 %APPDATA%；goals/looks/concert 等在 WebView2 localStorage（卸载不随安装包清除）
- 时区/跨午夜：用本地 `YYYY-MM-DD` + `Date.UTC` 差值，已处理
- `get_system_idle_time` 仅 Windows（GetLastInputInfo），macOS/Linux 返回 0
- 安装包 unsigned：SmartScreen 会提示"更多信息→仍要运行"
- 主 exe 文件名为 crate 名 jane-desktop-companion.exe（快捷方式显示 Dear Jane，无感知）
- 动作 scale/offsetX/offsetY 校准数值尚待逐个目测调整（Debug 面板滑杆实时调，localStorage jane.action-video-cal.v1 持久化）
- jane.ts 台词数据有 3 条重复 id "jane.meeting.10"（数据小疵，未改）

## 台词库原文中的疑似错字（已原样保留，未改）

- interaction.click：`被你发现了`（缺句号）、`下次什么时候Jane面`（疑似「见面」）、`你的小追在哪？`（「小追」语义不明）
- time.afternoon：`起来活动一下也行。。`（双句号）
- interaction.rapidClick.high：`太闲的话去听Jane的歌`、`别点了，在努力做专辑`（缺句号，但属 Jane 专属梗）
