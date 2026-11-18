/**
 * 动画播放器
 * 参考技术设计文档 9.2 节 AnimationPlayer 接口
 */

import { SpriteSheet, type FrameRect } from './sprite-sheet';

export interface PlayOptions {
  speed?: number;       // 播放速度倍率，默认 1.0
  loop?: boolean;       // 是否循环，覆盖 clip 默认值
  onComplete?: () => void;
  priority?: number;    // 动画优先级（高可打断低）
}

interface AnimationClip {
  sheet: SpriteSheet;
  name: string;
  fps: number;
  loop: boolean;
  priority: number;
}

export class AnimationPlayer {
  private clips: Map<string, AnimationClip> = new Map();
  private currentClip: AnimationClip | null = null;
  private currentFrame: number = 0;
  private playbackSpeed: number = 1.0;
  private lastFrameTime: number = 0;
  private isPlaying: boolean = false;
  private onComplete: (() => void) | null = null;
  private overrideLoop: boolean | null = null;

  /**
   * 注册一个动画片段
   */
  registerClip(name: string, sheet: SpriteSheet, priority: number = 0): void {
    this.clips.set(name, {
      sheet,
      name,
      fps: sheet.meta.fps,
      loop: sheet.meta.loop,
      priority,
    });
  }

  /**
   * 播放指定动画
   * 参考文档 9.3 节过渡规则：高优先级可打断低优先级
   */
  play(name: string, options?: PlayOptions): void {
    const clip = this.clips.get(name);
    if (!clip) {
      console.warn(`动画 "${name}" 未注册`);
      return;
    }

    // 优先级检查：同级不打断，高优先级打断低优先级
    if (this.currentClip && clip.priority < this.currentClip.priority) {
      return;
    }

    this.currentClip = clip;
    this.currentFrame = 0;
    this.playbackSpeed = options?.speed ?? 1.0;
    this.overrideLoop = options?.loop ?? null;
    this.onComplete = options?.onComplete ?? null;
    this.isPlaying = true;
    this.lastFrameTime = 0;
  }

  /**
   * 每帧调用：更新动画状态并绘制到 Canvas
   * @returns 当前帧的裁剪矩形，供外部使用（如脏区域计算）
   */
  update(timestamp: number, ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number): FrameRect | null {
    if (!this.currentClip || !this.isPlaying) return null;

    const clip = this.currentClip;
    const fps = clip.fps * this.playbackSpeed;
    const frameInterval = 1000 / fps;

    // 帧推进
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = timestamp;
    }

    const elapsed = timestamp - this.lastFrameTime;
    if (elapsed >= frameInterval) {
      const framesToAdvance = Math.floor(elapsed / frameInterval);
      this.lastFrameTime = timestamp - (elapsed % frameInterval);

      const totalFrames = clip.sheet.meta.frameCount;
      const shouldLoop = this.overrideLoop ?? clip.loop;

      this.currentFrame += framesToAdvance;

      if (this.currentFrame >= totalFrames) {
        if (shouldLoop) {
          this.currentFrame = this.currentFrame % totalFrames;
        } else {
          this.currentFrame = totalFrames - 1;
          this.isPlaying = false;
          this.onComplete?.();
        }
      }
    }

    // 绘制当前帧
    const rect = clip.sheet.getFrameRect(this.currentFrame);
    ctx.drawImage(
      clip.sheet.image,
      rect.sx, rect.sy, rect.sw, rect.sh,
      dx, dy, dw, dh
    );

    return rect;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get frame(): number {
    return this.currentFrame;
  }

  stop(): void {
    this.isPlaying = false;
  }
}