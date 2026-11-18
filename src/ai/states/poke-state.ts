import { StateHandler, StateContext } from '../state-machine';

export class PokeState implements StateHandler {
  private timer: number = 0;
  private shakeOffset: number = 0;

  onEnter(ctx: StateContext): void {
    this.timer = 0;
    ctx.animator.play('idle', { speed: 2.0 });
    ctx.currentAnimation = 'idle';
  }

  onTick(ctx: StateContext, dt: number): void {
    // 双击到达 → 立刻升级为 love
    if (ctx.pendingDblClick) {
      ctx.pendingDblClick = null;
      ctx._requestTransition('love');
      return;
    }

    this.timer += dt;

    if (this.timer < 500) {
      this.shakeOffset = Math.sin(this.timer * 0.05) * 5;
    } else {
      this.shakeOffset = 0;
    }

    if (this.timer > 1000) {
      ctx._requestTransition('idle');
    }
  }

  getShakeOffset(): number {
    return this.shakeOffset;
  }

  onExit(_ctx: StateContext): void {
    this.shakeOffset = 0;
  }
}