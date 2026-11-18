import { StateHandler, StateContext } from '../state-machine';

export class DragState implements StateHandler {
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;

  onEnter(ctx: StateContext): void {
    this.lastMouseX = ctx.mouseX;
    this.lastMouseY = ctx.mouseY;
    this.velocityX = 0;
    this.velocityY = 0;
    ctx.animator.play('idle', { speed: 1.5 });
    ctx.currentAnimation = 'idle';
  }

  onTick(ctx: StateContext, dt: number): void {
    // 计算鼠标速度
    const dx = ctx.mouseX - this.lastMouseX;
    const dy = ctx.mouseY - this.lastMouseY;
    const dtSec = dt / 1000;
    if (dtSec > 0) {
      this.velocityX = dx / dtSec;
      this.velocityY = dy / dtSec;
    }

    this.lastMouseX = ctx.mouseX;
    this.lastMouseY = ctx.mouseY;

    // 角色直接跟随鼠标（无延迟）
    ctx.movement.setPosition(
      ctx.mouseX - ctx.charSize / 2,
      ctx.mouseY - ctx.charSize
    );
  }

  onExit(ctx: StateContext): void {
    const throwDist = 80;
    const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
    if (speed > 100) {
      const nx = this.velocityX / speed;
      const ny = this.velocityY / speed;
      const targetX = ctx.movement.x + nx * throwDist;
      const targetY = ctx.movement.y + ny * throwDist;
      ctx.movement.setRawTarget(targetX, targetY);  // ← 改这里
    }
  }

  getVelocity(): { x: number; y: number } {
    return { x: this.velocityX, y: this.velocityY };
  }
}