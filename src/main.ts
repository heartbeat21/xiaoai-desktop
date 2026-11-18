import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { SpriteSheet } from './character/sprite-sheet';
import { AnimationPlayer } from './character/animation-player';
import { Movement } from './character/movement';
import { StateMachine, StateContext } from './ai/state-machine';
import { IdleState } from './ai/states/idle-state';
import { CuriousState } from './ai/states/curious-state';
import { FollowState } from './ai/states/follow-state';
import { SleepyState } from './ai/states/sleepy-state';
import { SleepState } from './ai/states/sleep-state';
import { WakeState } from './ai/states/wake-state';
import { PokeState } from './ai/states/poke-state';
import { LoveState } from './ai/states/love-state';
import { ChitchatState } from './ai/states/chitchat-state';
import { DragState } from './ai/states/drag-state';
import { TimeSystem } from './scene/time-system';
import { SceneManager } from './scene/scene-manager';

interface MousePayload {
  x: number;
  y: number;
  velocity_x: number;
  velocity_y: number;
  timestamp: number;
}

interface ScreenInfo {
  width: number;
  height: number;
  dpi_scale: number;
}

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[main] 找不到 canvas 元素');
    return;
  }
  const ctx = canvas.getContext('2d')!;
  if (!ctx) {
    console.error('[main] 无法获取 2d 上下文');
    return;
  }

  // [SAFE] get_screen_info 失败时用默认值
  let screen: ScreenInfo;
  try {
    screen = await invoke<ScreenInfo>('get_screen_info');
  } catch (err) {
    console.warn('[main] get_screen_info 失败，使用默认值', err);
    screen = { width: 1920, height: 1080, dpi_scale: 1.0 };
  }

  await new Promise<void>(r => requestAnimationFrame(() => r()));

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  const scaleX = screen.width / (canvas.width || 1);
  const scaleY = screen.height / (canvas.height || 1);

  // [SAFE] SpriteSheet.load 内部已有 fallback，不会抛出
  const idleSheet = await SpriteSheet.load(
    '/assets/characters/xiaoai/animations/idle/idle.png',
    '/assets/characters/xiaoai/animations/idle/idle.json'
  );
  const walkSheet = await SpriteSheet.load(
    '/assets/characters/xiaoai/animations/walk/walk.png',
    '/assets/characters/xiaoai/animations/walk/walk.json'
  );

  // [SAFE] 资源加载状态提示
  if (idleSheet.isFallback) {
    console.warn('[main] idle sprite 使用占位图');
  }
  if (walkSheet.isFallback) {
    console.warn('[main] walk sprite 使用占位图');
  }

  const player = new AnimationPlayer();
  player.registerClip('idle', idleSheet, 0);
  player.registerClip('walk', walkSheet, 0);
  player.play('idle', { speed: 0.5 });

  const charSize = 180;
  const startX = (canvas.width - charSize) / 2;
  const startY = canvas.height - charSize;
  const movement = new Movement(startX, startY, charSize);
  movement.setScreenSize(canvas.width, canvas.height);

  const timeSystem = new TimeSystem();
  (window as any).timeSystem = timeSystem;

  const sceneManager = new SceneManager(timeSystem);
  (window as any).sceneManager = sceneManager;
  sceneManager.setCanvasSize(canvas.width, canvas.height);

  const stateCtx: StateContext = {
    mouseX: startX + charSize / 2,
    mouseY: startY + charSize,
    mouseDistance: 0,
    isMouseOnCharacter: false,
    lastMouseActivityTime: performance.now(),
    characterCenterX: 0,
    characterCenterY: 0,
    charSize,
    movement,
    animator: player,
    deltaTime: 0,
    currentTime: performance.now(),
    idleSeconds: 0,
    isUserIdle: false,
    currentAnimation: 'idle',
    renderFacing: 1,
    pendingClick: null,
    pendingDblClick: null,
    mouseOnCharacterStartTime: 0,
    _requestTransition: () => {},
  };

  const stateMachine = new StateMachine(stateCtx);
  stateMachine.registerState('idle', new IdleState());
  stateMachine.registerState('curious', new CuriousState());
  stateMachine.registerState('follow', new FollowState());
  stateMachine.registerState('sleepy', new SleepyState());
  stateMachine.registerState('sleep', new SleepState());
  stateMachine.registerState('wake', new WakeState());
  stateMachine.registerState('poke', new PokeState());
  stateMachine.registerState('love', new LoveState());
  stateMachine.registerState('chitchat', new ChitchatState());
  stateMachine.registerState('drag', new DragState());
  stateMachine.transition('idle');

  const sleepState = stateMachine.getState('sleep') as SleepState;
  const loveState = stateMachine.getState('love') as LoveState;
  const chitchatState = stateMachine.getState('chitchat') as ChitchatState;

  let idleStartTime = 0;
  let isUserIdle = false;

  function wakeUp() {
    if (isUserIdle) {
      isUserIdle = false;
      idleStartTime = 0;
      stateCtx.isUserIdle = false;
      stateCtx.idleSeconds = 0;
    }
  }

  let isMouseDown = false;
  let isRenderingPaused = false;

  let lastClickTime = 0;
  let lastClickX = 0;
  let lastClickY = 0;

  await listen<MousePayload>('mouse:move', (event) => {
    try {
      const newX = event.payload.x / scaleX;
      const newY = event.payload.y / scaleY;
      if (Math.abs(newX - stateCtx.mouseX) > 1 || Math.abs(newY - stateCtx.mouseY) > 1) {
        stateCtx.mouseX = newX;
        stateCtx.mouseY = newY;
        stateCtx.lastMouseActivityTime = performance.now();
      }
    } catch (err) {
      console.warn('[mouse:move] 处理异常', err);
    }
  });

  await listen<any>('mouse:click', (event) => {
    try {
      isMouseDown = true;

      const now = performance.now();
      const x = event.payload.x / scaleX;
      const y = event.payload.y / scaleY;

      stateCtx.lastMouseActivityTime = now;
      wakeUp();

      const timeDiff = now - lastClickTime;
      const dist = Math.sqrt((x - lastClickX) ** 2 + (y - lastClickY) ** 2);

      if (timeDiff < 400 && dist < 15) {
        stateCtx.pendingClick = null;
        stateCtx.pendingDblClick = { x, y, time: now };
        console.log('[DBLCLICK] detected at', Math.round(x), Math.round(y));
        lastClickTime = 0;
      } else {
        if (!stateCtx.pendingDblClick) {
          stateCtx.pendingClick = {
            x, y,
            button: event.payload.button,
            time: now,
          };
        }
        lastClickTime = now;
      }

      lastClickX = x;
      lastClickY = y;
    } catch (err) {
      console.warn('[mouse:click] 处理异常', err);
    }
  });

  await listen<any>('mouse:release', (_event) => {
    isMouseDown = false;
  });

  await listen<any>('user:idle', (event) => {
    try {
      isUserIdle = true;
      idleStartTime = performance.now();
      stateCtx.idleSeconds = event.payload?.idleSeconds ?? 180;
    } catch (err) {
      console.warn('[user:idle] 处理异常', err);
    }
  });

  await listen<any>('user:active', () => {
    wakeUp();
  });

  // [FS] 全屏应用检测：暂停/恢复渲染
  await listen<any>('fullscreen:enter', () => {
    isRenderingPaused = true;
    console.log('[FS] 全屏应用进入，暂停壁纸渲染');
  });

  await listen<any>('fullscreen:exit', () => {
    isRenderingPaused = false;
    lastTimestamp = 0;
    console.log('[FS] 全屏应用退出，恢复壁纸渲染');
  });

  // [POWER] 电源管理：休眠暂停 / 唤醒恢复
  await listen<any>('system:suspend', () => {
    isRenderingPaused = true;
    console.log('[POWER] 系统休眠，暂停壁纸渲染');
  });

  await listen<any>('system:resume', () => {
    isRenderingPaused = false;
    lastTimestamp = 0;
    console.log('[POWER] 系统唤醒，恢复壁纸渲染');
  });

  // [TRAY] 托盘暂停/恢复
  await listen<any>('tray:pause', () => {
    isRenderingPaused = true;
    console.log('[TRAY] 托盘暂停渲染');
  });

  await listen<any>('tray:resume', () => {
    isRenderingPaused = false;
    lastTimestamp = 0;
    console.log('[TRAY] 托盘恢复渲染');
  });

  // [SAFE] 全局未捕获异常监控（渲染循环外）
  window.addEventListener('error', (e) => {
    console.error('[SAFE] 未捕获错误:', e.message, e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[SAFE] 未捕获 Promise 拒绝:', e.reason);
  });

  let lastTimestamp = 0;
  let renderErrorCount = 0; // [SAFE] 连续渲染错误计数

  function renderLoop(timestamp: number) {
    // [FS/TRAY/POWER] 暂停时跳过绘制
    if (isRenderingPaused) {
      requestAnimationFrame(renderLoop);
      return;
    }

    try {
      const dt = lastTimestamp > 0 ? Math.min(timestamp - lastTimestamp, 500) : 16; // [SAFE] dt 上限 500ms
      lastTimestamp = timestamp;
      const now = performance.now();

      sceneManager.update(dt);

      if (isUserIdle && idleStartTime > 0) {
        stateCtx.isUserIdle = true;
        stateCtx.idleSeconds = (now - idleStartTime) / 1000;
      }

      const dblClick = stateCtx.pendingDblClick;
      if (dblClick) {
        stateCtx.pendingDblClick = null;
        const current = stateMachine.getCurrentStateId();
        if (current !== 'sleep' && current !== 'sleepy' && current !== 'wake' && current !== 'love') {
          stateMachine.transition('love');
        }
      }

      stateMachine.update(dt);
      movement.update();

      if (stateMachine.getCurrentStateId() === 'drag' && !isMouseDown) {
        stateMachine.transition('idle');
      }

      const currentState = stateMachine.getCurrentStateId();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sceneManager.render(ctx, canvas.width, canvas.height);

      let shakeX = 0;
      if (currentState === 'poke') {
        shakeX = (stateMachine.getState('poke') as PokeState).getShakeOffset?.() || 0;
      }

      const drawX = movement.x + shakeX;
      const facing = stateCtx.renderFacing;
      if (facing === -1) {
        ctx.save();
        ctx.translate(drawX + charSize, movement.y);
        ctx.scale(-1, 1);
        player.update(timestamp, ctx, 0, 0, charSize, charSize);
        ctx.restore();
      } else {
        player.update(timestamp, ctx, drawX, movement.y, charSize, charSize);
      }

      if (currentState === 'sleep') {
        sleepState.renderZzz(ctx);
      }
      if (currentState === 'love') {
        loveState.renderHearts(ctx);
      }
      if (currentState === 'chitchat') {
        chitchatState.renderBubble(ctx);
      }

      const click = stateCtx.pendingClick;
      if (click && now - click.time > 200) {
        stateCtx.pendingClick = null;
      }
      const dbl = stateCtx.pendingDblClick;
      if (dbl && now - dbl.time > 500) {
        stateCtx.pendingDblClick = null;
      }

      renderErrorCount = 0; // [SAFE] 成功则重置
    } catch (err) {
      renderErrorCount++;
      if (renderErrorCount <= 5) {
        console.warn(`[SAFE] 渲染异常 (${renderErrorCount}/5):`, err);
      }
      if (renderErrorCount > 100) {
        console.error('[SAFE] 连续 100 次渲染异常，暂停渲染循环');
        return; // 不再 requestAnimationFrame
      }
    }

    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
}

// [SAFE] main 整体 try-catch
main().catch((err) => {
  console.error('[main] 致命错误，程序无法启动:', err);
  // 画一个红色错误提示
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = canvas.clientWidth || 400;
      canvas.height = canvas.clientHeight || 300;
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff4444';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('壁纸加载失败', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillStyle = '#cc6666';
      ctx.font = '12px sans-serif';
      ctx.fillText(String(err).slice(0, 80), canvas.width / 2, canvas.height / 2 + 10);
    }
  }
});