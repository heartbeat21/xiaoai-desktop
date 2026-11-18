# xiaoai-desktop — 全屏动态桌面 · 拟人化小爱同学

> 在 Windows 桌面上实现一个全屏动态壁纸，包含一个拟人化的小爱同学角色。角色能够感知用户的鼠标位置和操作，并做出各种自然反应。

## 项目目标

- 全屏覆盖桌面壁纸层，不影响桌面图标交互
- 角色实时感知鼠标位置，做出跟随和反应
- 丰富的角色动画和行为
- 系统资源占用低（常驻后台）
- 高可扩展性（易于添加角色、动画、场景）

## 约束条件

| 项目 | 要求 |
|------|------|
| 目标平台 | Windows 10 (1903+) / Windows 11 |
| 最大内存占用 | ≤ 80MB（含所有资源） |
| 空闲时 CPU 占用 | < 1% |
| 动画时 CPU 占用 | < 5% |
| 退出行为 | 程序可正常退出，不残留窗口或进程 |

## 技术选型

### 框架：Tauri v2

| 维度 | Tauri v2 | C# WPF | C++ + DirectX | Electron |
|------|----------|--------|---------------|----------|
| 内存占用 | 30-50MB | 20-40MB | 10-20MB | 150-250MB |
| 动画生态 | 极强 (Web) | 中等 | 需自建 | 极强 (Web) |
| 开发效率 | 高 | 高 | 低 | 高 |
| 跨平台潜力 | 有 | 无 | 无 | 有 |

选择理由：Web 生态提供最丰富的动画渲染方案（Canvas 2D, PixiJS, Lottie）；WebView2 运行时在 Windows 10 1903+ 上已预装，无需额外分发；Rust 后端提供安全、高效的系统级操作；Tauri v2 原生支持透明窗口和系统托盘。

### 前端渲染：Canvas 2D 为主，可选升级 PixiJS

桌面壁纸场景下动画区域仅占屏幕的一小部分，Canvas 2D 对 sprite sheet 动画完全够用；脏区域重绘策略可大幅降低 GPU 开销；后期如需粒子效果可平滑切换到 PixiJS（API 兼容）。

### 角色动画：Sprite Sheet + Spine 2D（可选）

- v1 使用 Sprite Sheet（帧序列图），标准动画帧率 24fps，每个动画状态对应一个 sprite sheet
- 后期可升级到 Spine 2D 骨骼动画（更流畅、文件更小）

## 核心原理：Windows 桌面壁纸层注入

Windows 桌面窗口层级（从底到顶）：

1. **Progman** — 原生壁纸窗口
2. **WorkerW** — 通过特殊消息创建的隐藏窗口层
3. **SHELLDLL_DefView** — 桌面图标列表
4. **应用窗口** — 所有正常应用

向 Progman 发送未文档化的消息 `0x052C`，可让 Windows 创建一个位于桌面图标下方、壁纸上方的 WorkerW 窗口。将我们的窗口设为该 WorkerW 的子窗口，即可实现"壁纸"效果。

注入流程概要：

1. `FindWindowW("Progman", null)` 查找 Progman 窗口
2. `SendMessageTimeout(progman, 0x052C, ...)` 触发创建 WorkerW
3. `EnumWindows` 定位目标 WorkerW（不包含 SHELLDLL_DefView 的那个）
4. `SetParent(our_hwnd, workerw_b)` 设置父窗口
5. `GetClientRect` + `SetWindowPos` 调整窗口尺寸

Explorer 崩溃或重启时 WorkerW 会被销毁，程序通过定时检测（2 秒间隔）与监听 `TaskbarCreated` 消息自动恢复注入。

## 输入系统

| 事件 | 来源 | 频率 | 发送到前端 |
|------|------|------|-----------|
| `mouse:move` | GetCursorPos 轮询 | 30fps | 是 |
| `mouse:click` | WH_MOUSE_LL 钩子 | 事件触发 | 是 |
| `mouse:dblclick` | WH_MOUSE_LL 钩子 | 事件触发 | 是 |
| `mouse:right_click` | WH_MOUSE_LL 钩子 | 事件触发 | 是 |
| `user:idle` | GetLastInputInfo | 10秒/次 | 仅状态变化时 |
| `user:active` | GetLastInputInfo | 事件触发 | 是 |
| `screen:lock` / `screen:unlock` | WTSRegisterSessionNotification | 事件触发 | 是 |
| `display:change` | WM_DISPLAYCHANGE | 事件触发 | 仅内部处理 |

安全说明：全局钩子使用 `CallNextHookEx` 始终传递事件，不拦截；不注入到其他进程；不修改系统文件；不以管理员权限运行。

## 角色动画与行为

### 动画状态

`idle`（待机）、`idle_blink`（眨眼）、`look_around`（张望）、`walk`（行走）、`wave`（挥手）、`happy`（开心）、`surprised`（惊讶）、`sleepy`（困倦）、`sleep`（睡觉）、`wake`（醒来）、`drag`（被拖拽）、`poke`（被戳）、`love`（比心）、`confused`（困惑）

### 状态机

```
WAKE → IDLE ⇄ CURIOUS → FOLLOW → POKE / LOVE / CHITCHAT
        ↓
     SLEEPY → SLEEP → WAKE
```

- **IDLE**：站立待机，随机眨眼与张望；空闲超 180 秒进入 SLEEPY
- **CURIOUS**：鼠标距离 < 200px，面朝鼠标方向
- **FOLLOW**：鼠标距离 < 80px，以 2px/帧行走跟随，带缓入缓出
- **SLEEPY / SLEEP**：长时间无操作逐步入睡，显示 "Zzz" 气泡（可选）
- **POKE**：快速单击角色触发惊讶/被戳反应
- **LOVE**：双击角色触发比心/害羞动画
- **CHITCHAT**：悬停超过 2 秒弹出对话气泡
- **DRAG**：长按拖动角色，释放时带"抛出"惯性

### 行为权重

DRAG(100) > POKE(90) > LOVE(80) > CHITCHAT(70) > FOLLOW(60) > CURIOUS(50) > SLEEPY(40) > SLEEP(30) > IDLE(20) > WAKE(10)

### 随机性与自然感

- 待机位置每 30-90 秒随机漂移一次（50-150px，0.5px/帧）
- 反应随机变化（如 poke 响应：poke / surprised / confused）
- 性格参数：curiosity、energy、friendliness（0-1），影响行为阈值

## 场景系统

- **天空层**：基于时间的天空渐变（日出 → 白天 → 日落 → 夜晚），相邻时段自动渐变过渡
- **场景层**：预设场景（房间 / 公园 / 城市 / 太空），根据时间切换照明
- **前景装饰层**：桌面摆件、植物、可交互小物件
- **角色层**：角色系统渲染
- **特效层**：天气粒子、光效、季节特效

### 天气系统

| 天气 | 效果 | 概率 |
|------|------|------|
| clear | 无 | 40% |
| rain | 200 粒雨滴，略倾斜 | 15% |
| snow | 100 片雪花，左右摆动 | 10% |
| sakura | 30 片樱花瓣，旋转飘落 | 5% |
| fireflies | 20 只萤火虫，随机游走+发光（仅 evening/night） | 5% |

天气每 30-120 分钟随机切换，切换时 10 秒过渡；部分天气有季节限制（雪→冬季，樱花→春季）。

## 多显示器与 DPI

- **多显示器**：仅在主显示器显示壁纸（后续版本可通过配置支持多显示器）
- **DPI 感知**：Per-Monitor DPI Aware V2；Canvas 内部使用逻辑像素，Rust 后端负责坐标转换；Sprite 资源提供 @1x 和 @2x 两套

## 性能预算

| 指标 | 目标值 | 最大值 |
|------|--------|--------|
| 总内存 | **35MB** | **55MB** |
| CPU (空闲/角色静止) | 0% | 0.5% |
| CPU (角色动画) | 2% | 4% |
| CPU (天气特效) | 3% | 5% |
| GPU (动画+特效) | 2% | 5% |
| IPC 带宽 | 3KB/s | 5KB/s |
| 启动时间 (到显示) | 1.5s | 3s |

主要优化手段：双 Canvas 分层（背景冻结）、脏区域重绘（~300x300px）、requestAnimationFrame 自适应暂停、资源按需加载/卸载、30fps 鼠标轮询、粒子系统对象池、全屏应用检测暂停渲染。

## 开发里程碑

| 阶段 | 周期 | 目标 |
|------|------|------|
| Phase 1 | 第 1-2 周 | 基础骨架：WorkerW 注入、透明窗口、Canvas 渲染管线、系统托盘 |
| Phase 2 | 第 3-4 周 | 角色渲染与输入：Sprite Sheet 渲染、鼠标跟随、idle/walk 动画 |
| Phase 3 | 第 5-6 周 | 状态机与行为：完整状态机、点击/双击交互、对话气泡、睡眠 |
| Phase 4 | 第 7-8 周 | 场景与视觉：时间系统、天气粒子、全屏应用检测 |
| Phase 5 | 第 9-10 周 | 完善与发布：设置界面、性能优化、打包（NSIS/MSI）、文档 |

## 项目结构（概要）

```
xiaoai-desktop/
├── src-tauri/           # Rust 后端
│   └── src/
│       ├── wallpaper/   # WorkerW 注入、多显示器、恢复
│       ├── input/       # 鼠标轮询、点击钩子、空闲检测
│       ├── system/      # 托盘、热键、电源事件
│       └── config/      # 配置加载
├── src/                 # Web 前端 (TypeScript)
│   ├── engine/          # Canvas 渲染、图层、脏区域、资源管理
│   ├── character/       # 角色、动画播放器、Sprite Sheet
│   ├── ai/              # 状态机、各状态实现、随机决策
│   ├── scene/           # 场景、时间、天气、粒子
│   ├── ui/              # 对话气泡、右键菜单
│   ├── ipc/             # 事件监听、命令调用
│   └── utils/           # 数学、缓动、对象池
├── assets/              # 角色/场景/特效静态资源
└── config/              # 默认配置与行为预设
```

## 配置

配置文件位于 `%APPDATA%/xiaoai-desktop/`，主要包括：

- 角色配置（尺寸、初始位置）
- 场景配置（场景 ID、时间变化、天气开关）
- 行为配置（好奇/跟随/交互距离阈值、困倦/入睡时间、行走速度、随机事件开关）
- 性能配置（最大帧率、动画帧率、背景质量）
- 系统配置（开机启动、托盘图标、语言）

行为预设：`energetic`（活泼型）、`calm`（安静型）、`playful`（调皮型）

## 系统托盘

右键托盘图标可：查看当前状态、更换角色、场景设置、暂停/继续、设置、关于、退出。退出时释放全局钩子、解除 WorkerW 父子关系、销毁窗口，确保不残留。

## 容错与边界处理

| 故障 | 恢复策略 |
|------|---------|
| Explorer 崩溃/重启 | 重新执行注入流程 |
| 显示器分辨率变化 | 重新获取尺寸、调整 Canvas、重新注入 |
| DPI 变化 | 更新缩放，调整坐标系统 |
| WebView2 崩溃 | 重新加载前端页面 |
| 配置文件损坏 | 使用默认配置，日志记录 |
| 资源文件缺失 | 使用占位色块，日志记录 |
| 全屏应用/游戏 | 暂停渲染，降低 CPU |
| 系统休眠/唤醒 | 暂停/恢复 |

## 未来扩展方向

| 方向 | 说明 | 优先级 |
|------|------|--------|
| AI 对话集成 | 接入 LLM 实现真正对话 | 高 |
| 事件响应 | 日历提醒、消息通知时反应 | 高 |
| 多角色支持 | 同时显示多个角色，角色间互动 | 中 |
| Spine 2D 骨骼动画 | 更流畅的动画表现 | 中 |
| 语音交互 | 语音输入 + TTS 回应 | 中 |
| 桌面小组件 | 天气、日历、待办 | 中 |
| 创意工坊 | 用户自定义角色和动画 | 低 |
| 多平台 | macOS 动态桌面 | 低 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| WorkerW 是未文档化的 Windows 内部行为 | 备选：Windows 壁纸 API 设置视频壁纸；监控 Windows 版本变化 |
| WebView2 内存占用超预期 | 备选：降级 Canvas 2D；减少粒子；考虑纯 Rust 渲染 |
| 全局钩子被安全软件拦截 | 备选：仅用 GetCursorPos 轮询 |
| DPI 处理复杂 | 优先测试主流 DPI (100%, 125%, 150%) |
| Explorer 崩溃恢复不及时 | 提供手动"重新注入"按钮；优化检测间隔 |

---

> 注：本项目当前处于设计阶段，以上内容依据技术设计文档整理。
