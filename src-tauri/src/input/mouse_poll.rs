use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use std::thread;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};
use crate::winapi_common::*;
use crate::{log_info, log_warn};

// ============================================================
// 判断前台窗口是否为桌面
// ============================================================
fn is_desktop_foreground() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return false;
        }
        let mut buf = [0u16; 64];
        let len = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
        if len <= 0 {
            return false;
        }
        let class_name = String::from_utf16_lossy(&buf[..len as usize]);
        class_name == "Progman" || class_name == "WorkerW"
    }
}

// ============================================================
// 事件载荷
// ============================================================
#[derive(Clone, serde::Serialize)]
pub struct MouseMovePayload {
    pub x: f64,
    pub y: f64,
    pub screen_x: i32,
    pub screen_y: i32,
    pub velocity_x: f64,
    pub velocity_y: f64,
    pub timestamp: u64,
}

static RUNNING: AtomicBool = AtomicBool::new(false);

/// 启动鼠标轮询线程
pub fn start_mouse_polling(app: AppHandle) {
    if RUNNING.swap(true, Ordering::SeqCst) {
        log_warn!("mouse_poll", "已运行，跳过重复启动");
        return;
    }

    log_info!("mouse_poll", "启动鼠标轮询线程");

    thread::spawn(move || {
        let mut last_x: f64 = 0.0;
        let mut last_y: f64 = 0.0;
        let mut last_time: u64 = 0;
        let mut was_desktop = false;

        loop {
            if !RUNNING.load(Ordering::SeqCst) {
                log_info!("mouse_poll", "停止轮询");
                break;
            }

            let desktop_active = is_desktop_foreground();

            if desktop_active != was_desktop {
                if desktop_active {
                    log_info!("mouse_poll", "桌面激活，开始追踪鼠标");
                } else {
                    log_info!("mouse_poll", "桌面被遮挡，暂停追踪");
                }
                was_desktop = desktop_active;
            }

            if desktop_active {
                let mut point = POINT { x: 0, y: 0 };
                let ok = unsafe { GetCursorPos(&mut point) };

                if ok != 0 {
                    let now_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64;

                    let dt = if last_time > 0 {
                        (now_ms - last_time) as f64 / 1000.0
                    } else {
                        0.016
                    };

                    let velocity_x = if dt > 0.0 { (point.x as f64 - last_x) / dt } else { 0.0 };
                    let velocity_y = if dt > 0.0 { (point.y as f64 - last_y) / dt } else { 0.0 };

                    let payload = MouseMovePayload {
                        x: point.x as f64,
                        y: point.y as f64,
                        screen_x: point.x,
                        screen_y: point.y,
                        velocity_x,
                        velocity_y,
                        timestamp: now_ms,
                    };

                    let _ = app.emit("mouse:move", &payload);

                    last_x = point.x as f64;
                    last_y = point.y as f64;
                    last_time = now_ms;
                }
            } else {
                last_time = 0;
            }

            thread::sleep(Duration::from_millis(33));
        }
    });
}

pub fn stop_mouse_polling() {
    RUNNING.store(false, Ordering::SeqCst);
}