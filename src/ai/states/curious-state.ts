import { StateHandler, StateContext } from '../state-machine';

export class CuriousState implements StateHandler {
  private enterTime: number = 0;
  private hoverStartTime: number = 0;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  onEnter(ctx: StateContext): void {
    this.enterTime = performance.now();
    this.hoverStartTime = 0;
    this.lastMouseX = ctx.mouseX;
    this.lastMouseY = ctx.mouseY;
    if (ctx.currentAnimation !== 'idle') {
      ctx.animator.play('idle', { speed: 0.5 });
      ctx.currentAnimation = 'idle';
    }
  }

  onTick(ctx: StateContext, _dt: number): void {
    ctx.renderFacing = ctx.mouseX > ctx.characterCenterX ? 1 : -1;

    // 单击角色 → poke
    if (ctx.pendingClick && ctx.isMouseOnCharacter) {
      ctx.pendingClick = null;
      ctx._requestTransition('poke');
      return;
    }

    // 双击角色 → love
    if (ctx.pendingDblClick && ctx.isMouseOnCharacter) {
      ctx.pendingDblClick = null;
      ctx._requestTransition('love');
      return;
    }

    // 鼠标在移动
    const mouseMoved =
      Math.abs(ctx.mouseX - this.lastMouseX) > 2 ||
      Math.abs(ctx.mouseY - this.lastMouseY) > 2;

    if (mouseMoved) {
      this.lastMouseX = ctx.mouseX;
      this.lastMouseY = ctx.mouseY;
      this.hoverStartTime = 0;

      // 距离 < 60 且在移动 → follow
      if (ctx.mouseDistance < 60) {
        ctx._requestTransition('follow');
        return;
      }
    }

    // 鼠标停在角色上 → 累计悬停时间
    if (ctx.isMouseOnCharacter && !mouseMoved) {
      if (this.hoverStartTime === 0) {
        this.hoverStartTime = performance.now();
      }
      if (performance.now() - this.hoverStartTime > 2000) {
        ctx._requestTransition('chitchat');
        return;
      }
    } else if (!ctx.isMouseOnCharacter) {
      this.hoverStartTime = 0;
    }

    // 鼠标远离 → idle
    if (ctx.mouseDistance > 250) {
      ctx._requestTransition('idle');
      return;
    }

    // 超时 → idle
    if (performance.now() - this.enterTime > 10000) {
      ctx._requestTransition('idle');
    }
  }

  onExit(_ctx: StateContext): void {}
}