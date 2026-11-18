import { StateHandler, StateContext } from '../state-machine';
import { randomInterval } from '../randomizer';

const IDLE_TO_SLEEPY_SECS = 180;

export class IdleState implements StateHandler {
  private canTransition: boolean = true;
  private cooldownTimer: number = 0;
  private driftTimer: number = 0;
  private nextDriftTime: number = 0;

  onEnter(ctx: StateContext): void {
    this.canTransition = false;
    this.cooldownTimer = 0;
    this.driftTimer = 0;
    this.nextDriftTime = randomInterval(30, 90);
    if (ctx.currentAnimation !== 'idle') {
      ctx.animator.play('idle', { speed: 0.5 });
      ctx.currentAnimation = 'idle';
    }
  }

  onTick(ctx: StateContext, dt: number): void {
    const facing = ctx.movement.getFacingDirection();
    ctx.renderFacing = facing !== 0 ? facing : 1;

    // 冷却期
    if (!this.canTransition) {
      this.cooldownTimer += dt;
      if (this.cooldownTimer > 1000) {
        this.canTransition = true;
      }
      return;
    }

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

    // 鼠标靠近且最近 2 秒动过 → curious
    const timeSinceMovement = ctx.currentTime - ctx.lastMouseActivityTime;
    if (ctx.mouseDistance < 160 && timeSinceMovement < 2000) {
      ctx._requestTransition('curious');
      return;
    }

    // 长时间无输入 → sleepy
    if (ctx.isUserIdle && ctx.idleSeconds > IDLE_TO_SLEEPY_SECS) {
      ctx._requestTransition('sleepy');
      return;
    }

    // === 随机漂移 ===
    this.driftTimer += dt;
    if (this.driftTimer > this.nextDriftTime) {
      this.driftTimer = 0;
      this.nextDriftTime = randomInterval(30, 90);

      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 100;
      const targetX = ctx.movement.x + Math.cos(angle) * dist;
      const targetY = ctx.movement.y + Math.sin(angle) * dist;

      const maxX = (window.innerWidth || 1536) - ctx.charSize;
      const maxY = (window.innerHeight || 864) - ctx.charSize;
      ctx.movement.setRawTarget(
        Math.max(0, Math.min(maxX, targetX)),
        Math.max(0, Math.min(maxY, targetY))
      );

      ctx.animator.play('walk', { speed: 0.5 });
      ctx.currentAnimation = 'walk';

      setTimeout(() => {
        if (ctx.currentAnimation === 'walk') {
          ctx.animator.play('idle', { speed: 0.5 });
          ctx.currentAnimation = 'idle';
        }
      }, 3000);
    }
  }

  onExit(_ctx: StateContext): void {}
}