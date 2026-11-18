import { StateHandler, StateContext } from '../state-machine';

export class FollowState implements StateHandler {
  private lastMouseMoveTime: number = 0;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  onEnter(ctx: StateContext): void {
    if (ctx.currentAnimation !== 'walk') {
      ctx.animator.play('walk', { speed: 1.0 });
      ctx.currentAnimation = 'walk';
    }
    this.lastMouseMoveTime = performance.now();
    this.lastMouseX = ctx.mouseX;
    this.lastMouseY = ctx.mouseY;
  }

  onTick(ctx: StateContext, _dt: number): void {
    const now = performance.now();

    // === 交互检测 ===

    // 任意单击 → poke（follow 时不触发 drag）
    if (ctx.pendingClick) {
      ctx.pendingClick = null;
      ctx._requestTransition('poke');
      return;
    }

    // 任意双击 → love
    if (ctx.pendingDblClick) {
      ctx.pendingDblClick = null;
      ctx._requestTransition('love');
      return;
    }

    // === 移动逻辑 ===

    const mouseMoved =
      Math.abs(ctx.mouseX - this.lastMouseX) > 2 ||
      Math.abs(ctx.mouseY - this.lastMouseY) > 2;

    if (mouseMoved) {
      this.lastMouseMoveTime = now;
      this.lastMouseX = ctx.mouseX;
      this.lastMouseY = ctx.mouseY;
    }

    ctx.movement.setTarget(ctx.mouseX, ctx.mouseY);
    ctx.renderFacing = ctx.movement.getFacingDirection() || 1;

    if (ctx.mouseDistance > 500) {
      ctx._requestTransition('idle');
      return;
    }

    const mouseStopped = now - this.lastMouseMoveTime > 3000;
    if (mouseStopped) {
      ctx._requestTransition('idle');
      return;
    }

    if (mouseStopped && ctx.mouseDistance < 40) {
      ctx._requestTransition('idle');
    }
  }

  onExit(ctx: StateContext): void {
    ctx.movement.setRawTarget(ctx.movement.x, ctx.movement.y);
  }
}