import { AnimationPlayer } from '../character/animation-player';
import { Movement } from '../character/movement';

// ============================================================
// 状态上下文 — 每个状态都能读取和操作这些数据
// ============================================================
export interface StateContext {
  mouseX: number;
  mouseY: number;
  mouseDistance: number;
  isMouseOnCharacter: boolean;
  lastMouseActivityTime: number;

  characterCenterX: number;
  characterCenterY: number;
  charSize: number;

  movement: Movement;
  animator: AnimationPlayer;

  deltaTime: number;
  currentTime: number;

  idleSeconds: number;
  isUserIdle: boolean;

  currentAnimation: string;   // ← 新增
  renderFacing: number;

  pendingClick: { x: number; y: number; button: string; time: number } | null;
  pendingDblClick: { x: number; y: number; time: number } | null;
  mouseOnCharacterStartTime: number;

  _requestTransition: (stateId: string) => void;
}

// ============================================================
// 状态处理器接口
// ============================================================
export interface StateHandler {
  onEnter(ctx: StateContext): void;
  onTick(ctx: StateContext, dt: number): void;
  onExit(ctx: StateContext): void;
}

// ============================================================
// 状态机
// ============================================================
export class StateMachine {
  private states: Map<string, StateHandler> = new Map();
  private currentStateId: string = '';
  private currentState: StateHandler | null = null;
  private pendingTransition: string | null = null;
  private context: StateContext;

  constructor(context: StateContext) {
    this.context = context;
    // 绑定请求转换的回调
    this.context._requestTransition = (stateId: string) => {
      this.pendingTransition = stateId;
    };
  }

  // 注册状态
  registerState(id: string, handler: StateHandler): void {
    this.states.set(id, handler);
  }

  // 获取当前状态 ID
  getCurrentStateId(): string {
    return this.currentStateId;
  }

  getState(id: string): StateHandler | undefined {
    return this.states.get(id);
  }

  // 强制切换状态
  transition(stateId: string): void {
    const handler = this.states.get(stateId);
    if (!handler) {
      console.warn(`[StateMachine] unknown state: ${stateId}`);
      return;
    }

    // 退出旧状态
    if (this.currentState) {
      this.currentState.onExit(this.context);
    }

    const oldState = this.currentStateId;
    this.currentStateId = stateId;
    this.currentState = handler;

    // 进入新状态
    this.currentState.onEnter(this.context);

    console.log(`[State] ${oldState || '(none)'} → ${stateId}`);
  }

  // 每帧更新
  update(dt: number): void {
    this.context.deltaTime = dt;
    this.context.currentTime = performance.now();

    // 计算鼠标距离
    const cx = this.context.movement.x + this.context.charSize / 2;
    const cy = this.context.movement.y + this.context.charSize / 2;
    this.context.characterCenterX = cx;
    this.context.characterCenterY = cy;

    const dx = this.context.mouseX - cx;
    const dy = this.context.mouseY - cy;
    this.context.mouseDistance = Math.sqrt(dx * dx + dy * dy);

    // 鼠标是否在角色上
    const radius = this.context.charSize / 2;
    this.context.isMouseOnCharacter = this.context.mouseDistance < radius;

    // 更新当前状态
    if (this.currentState) {
      this.currentState.onTick(this.context, dt);
    }

    // 处理状态转换（onTick 中可能触发了 _requestTransition）
    if (this.pendingTransition) {
      const target = this.pendingTransition;
      this.pendingTransition = null;
      this.transition(target);
    }
  }
}