import { StateHandler, StateContext } from '../state-machine';

const MESSAGES = [
  '你好呀~',
  '今天天气不错呢',
  '你在忙什么呀？',
  '要不要休息一下？',
  '嘿嘿~',
  '我在这里哦',
  '想和我玩吗？',
  '别戳我啦~',
];

export class ChitchatState implements StateHandler {
  private timer: number = 0;
  private message: string = '';
  private bubbleOpacity: number = 0;
  private bubbleX: number = 0;
  private bubbleY: number = 0;

  onEnter(ctx: StateContext): void {
    this.timer = 0;
    this.message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    this.bubbleOpacity = 0;
    this.bubbleX = ctx.characterCenterX;
    this.bubbleY = ctx.movement.y - 30;
  }

  onTick(_ctx: StateContext, dt: number): void {
    this.timer += dt;

    // 淡入 0.3s → 显示 3s → 淡出 0.5s
    if (this.timer < 300) {
      this.bubbleOpacity = Math.min(1, this.timer / 300);
    } else if (this.timer < 3300) {
      this.bubbleOpacity = 1;
    } else if (this.timer < 3800) {
      this.bubbleOpacity = Math.max(0, 1 - (this.timer - 3300) / 500);
    } else {
      _ctx._requestTransition('idle');
    }
  }

  renderBubble(ctx: CanvasRenderingContext2D): void {
    if (this.bubbleOpacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.bubbleOpacity;

    // 测量文字宽度
    ctx.font = '14px "Segoe UI", sans-serif';
    const textWidth = ctx.measureText(this.message).width;
    const padding = 12;
    const bw = textWidth + padding * 2;
    const bh = 30;
    const bx = this.bubbleX - bw / 2;
    const by = this.bubbleY - bh;

    // 气泡背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.stroke();

    // 小三角
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(this.bubbleX - 5, by + bh);
    ctx.lineTo(this.bubbleX + 5, by + bh);
    ctx.lineTo(this.bubbleX, by + bh + 8);
    ctx.closePath();
    ctx.fill();

    // 文字
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.message, this.bubbleX, by + bh / 2);

    ctx.restore();
  }

  onExit(_ctx: StateContext): void {
    this.bubbleOpacity = 0;
  }
}