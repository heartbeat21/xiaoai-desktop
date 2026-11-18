import { StateHandler, StateContext } from '../state-machine';

export class SleepyState implements StateHandler {
  private enterTime: number = 0;

  onEnter(ctx: StateContext): void {
    this.enterTime = performance.now();
    ctx.animator.play('idle', { speed: 0.3 });
    ctx.currentAnimation = 'idle';
  }

  onTick(ctx: StateContext, _dt: number): void {
    // 用 isUserIdle 标志，不用 lastMouseActivityTime
    if (!ctx.isUserIdle) {
      ctx._requestTransition('wake');
      return;
    }

    // 困倦 60 秒后 → 睡觉
    if (performance.now() - this.enterTime > 60000) {
      ctx._requestTransition('sleep');
    }
  }

  onExit(_ctx: StateContext): void {}
}