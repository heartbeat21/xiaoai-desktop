import { StateHandler, StateContext } from '../state-machine';

export class SleepState implements StateHandler {
  private timer: number = 0;
  private phase: 'waiting' | 'showing' | 'fadeout' | 'cooldown' = 'waiting';
  private x: number = 0;
  private y: number = 0;
  private startY: number = 0;
  private opacity: number = 0;

  onEnter(ctx: StateContext): void {
    ctx.animator.play('idle', { speed: 0.15 });
    ctx.currentAnimation = 'idle';
    this.timer = 0;
    this.phase = 'waiting';
    this.opacity = 0;
  }

  onTick(ctx: StateContext, dt: number): void {
    if (!ctx.isUserIdle) {
      ctx._requestTransition('wake');
      return;
    }

    this.timer += dt;

    switch (this.phase) {
      case 'waiting':
        if (this.timer > 2000) {
          this.spawnZzz(ctx);
        }
        break;

      case 'showing':
        // 向上飘，持续 2 秒
        this.y = this.startY - (this.timer / 1000) * 60;
        if (this.timer > 2000) {
          this.phase = 'fadeout';
          this.timer = 0;
          this.startY = this.y;
        }
        break;

      case 'fadeout':
        // 淡出 1 秒，同时继续上飘
        this.opacity = Math.max(0, 1 - this.timer / 1000);
        this.y = this.startY - (this.timer / 1000) * 30;
        if (this.timer > 1000) {
          this.opacity = 0;
          this.phase = 'cooldown';
          this.timer = 0;
        }
        break;

      case 'cooldown':
        // 消失后等 3 秒再飘下一个
        if (this.timer > 3000) {
          this.spawnZzz(ctx);
        }
        break;
    }
  }

  private spawnZzz(ctx: StateContext): void {
    this.x = ctx.characterCenterX + 30;
    this.y = ctx.movement.y - 10;
    this.startY = this.y;
    this.opacity = 1;
    this.timer = 0;
    this.phase = 'showing';
  }

  renderZzz(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== 'showing' && this.phase !== 'fadeout') return;
    if (this.opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = '#aaccff';
    ctx.textAlign = 'center';
    ctx.fillText('Zzz', this.x, this.y);
    ctx.restore();
  }

  onExit(_ctx: StateContext): void {
    this.opacity = 0;
    this.phase = 'waiting';
  }
}