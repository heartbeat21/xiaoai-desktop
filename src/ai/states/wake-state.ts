import { StateHandler, StateContext } from '../state-machine';

export class WakeState implements StateHandler {
  private timer: number = 0;

  onEnter(ctx: StateContext): void {
    this.timer = 0;
    ctx.animator.play('idle', { speed: 0.8 });
    ctx.currentAnimation = 'idle';
  }

  onTick(ctx: StateContext, dt: number): void {
    this.timer += dt;

    // 1.5 秒后回到 idle
    if (this.timer > 1500) {
      ctx._requestTransition('idle');
    }
  }

  onExit(_ctx: StateContext): void {}
}