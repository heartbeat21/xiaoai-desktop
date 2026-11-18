/**
 * 角色移动控制
 */
export class Movement {
  x: number;
  y: number;

  private targetX: number;
  private targetY: number;
  private charSize: number;
  private screenWidth: number;
  private screenHeight: number;

  velocityX = 0;
  velocityY = 0;

  private readonly lerpSpeed = 0.1;
  private readonly followThreshold = 80;
  private readonly curiousThreshold = 200;

  constructor(startX: number, startY: number, charSize: number) {
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.targetY = startY;
    this.charSize = charSize;
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }

  setScreenSize(w: number, h: number): void {
    this.screenWidth = w;
    this.screenHeight = h;
  }

  setTarget(mx: number, my: number): void {
    this.targetX = mx - this.charSize * 0.5;
    this.targetY = my - this.charSize;
  }

  distanceToTarget(): number {
    const cx = this.x + this.charSize * 0.5;
    const cy = this.y + this.charSize;
    const tx = this.targetX + this.charSize * 0.5;
    const ty = this.targetY + this.charSize;
    return Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
  }

  setPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    this.x = x;
    this.y = y;
    this.clampToBounds();
  }

  // 设置角色目标位置（角色坐标，不加偏移）
  setRawTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  private clampToBounds(): void {
    this.x = Math.max(0, Math.min(this.x, this.screenWidth - this.charSize));
    this.y = Math.max(0, Math.min(this.y, this.screenHeight - this.charSize));
  }

  update(): boolean {
    const prevX = this.x;
    const prevY = this.y;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;

    // 直接线性插值向目标移动
    this.x += dx * this.lerpSpeed;
    this.y += dy * this.lerpSpeed;

    // 边界限制
    this.x = Math.max(0, Math.min(this.x, this.screenWidth - this.charSize));
    this.y = Math.max(0, Math.min(this.y, this.screenHeight - this.charSize));

    // 记录实际速度（用于朝向判断）
    this.velocityX = this.x - prevX;
    this.velocityY = this.y - prevY;

    // 位移足够大才算"在移动"
    return Math.abs(this.velocityX) > 0.01 || Math.abs(this.velocityY) > 0.01;
  }

  getFacingDirection(): number {
    if (Math.abs(this.velocityX) < 0.2) return 0;
    return this.velocityX > 0 ? 1 : -1;
  }

  getState(): 'idle' | 'curious' | 'follow' {
    const dist = this.distanceToTarget();
    if (dist < this.followThreshold) return 'follow';
    if (dist < this.curiousThreshold) return 'curious';
    return 'idle';
  }
}