import { StateHandler, StateContext } from '../state-machine';

interface Heart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  scale: number;
}

export class LoveState implements StateHandler {
  private timer: number = 0;
  private hearts: Heart[] = [];

  onEnter(ctx: StateContext): void {
    this.timer = 0;
    this.hearts = [];
    ctx.animator.play('idle', { speed: 0.8 });
    ctx.currentAnimation = 'idle';

    // 生成 6 颗爱心，从角色头顶随机方向散开
    for (let i = 0; i < 6; i++) {
      const angle = (Math.random() - 0.5) * Math.PI;
      const speed = 30 + Math.random() * 40;
      this.hearts.push({
        x: ctx.characterCenterX + (Math.random() - 0.5) * 40,
        y: ctx.movement.y + 10,
        vx: Math.sin(angle) * speed,
        vy: -speed,
        opacity: 1,
        scale: 0.5 + Math.random() * 0.5,
      });
    }
  }

  onTick(_ctx: StateContext, dt: number): void {
    this.timer += dt;
    const dtSec = dt / 1000;

    for (const h of this.hearts) {
      h.x += h.vx * dtSec;
      h.y += h.vy * dtSec;
      h.vy += 30 * dtSec; // 轻微重力
      h.opacity = Math.max(0, h.opacity - dtSec * 0.5);
    }

    if (this.timer > 2000) {
      _ctx._requestTransition('idle');
    }
  }

  renderHearts(ctx: CanvasRenderingContext2D): void {
    for (const h of this.hearts) {
      if (h.opacity <= 0) continue;
      ctx.save();
      ctx.globalAlpha = h.opacity;
      ctx.font = `${Math.round(20 * h.scale)}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#ff6b8a';
      ctx.textAlign = 'center';
      ctx.fillText('♥', h.x, h.y);
      ctx.restore();
    }
  }

  onExit(_ctx: StateContext): void {
    this.hearts = [];
  }
}