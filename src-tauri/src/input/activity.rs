use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::Emitter;
use crate::winapi_common::*;
use crate::{log_info, log_warn};

// ============================================================
// 模块状态
// ============================================================
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static RUNNING: AtomicBool = AtomicBool::new(false);

// 空闲阈值（秒）
const IDLE_THRESHOLD_SECS: u64 = 180;

// ============================================================
// 获取空闲秒数
// ============================================================
fn get_idle_seconds() -> u64 {
    unsafe {
        let mut info = LASTINPUTINFO {
            cb_size: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dw_time: 0,
        };
        if GetLastInputInfo(&mut info) != 0 {
            let tick = GetTickCount();
            let elapsed = tick.wrapping_sub(info.dw_time);
            elapsed as u64 / 1000
        } else {
            0
        }
    }
}

// ============================================================
// 启动
// ============================================================
pub fn start(app_handle: tauri::AppHandle) {
    if RUNNING.swap(true, Ordering::SeqCst) {
        log_warn!("activity", "已运行，跳过重复启动");
        return;
    }

    let _ = APP_HANDLE.set(app_handle);

    std::thread::Builder::new()
        .name("activity-monitor".into())
        .spawn(move || {
            log_info!("activity", "空闲监控已启动，阈值={}秒", IDLE_THRESHOLD_SECS);

            let mut was_idle = false;

            while RUNNING.load(Ordering::Relaxed) {
                let idle_secs = get_idle_seconds();
                let is_idle = idle_secs >= IDLE_THRESHOLD_SECS;

                if let Some(app) = APP_HANDLE.get() {
                    if is_idle && !was_idle {
                        let _ = app.emit("user:idle", &serde_json::json!({
                            "idleSeconds": idle_secs,
                            "isActive": false
                        }));
                        log_info!("activity", "用户进入空闲 ({}秒)", idle_secs);
                    } else if !is_idle && was_idle {
                        let _ = app.emit("user:active", &serde_json::json!({
                            "idleSeconds": 0,
                            "isActive": true
                        }));
                        log_info!("activity", "用户恢复活跃");
                    }
                }

                was_idle = is_idle;
                std::thread::sleep(Duration::from_secs(2));
            }

            log_info!("activity", "空闲监控已停止");
        })
        .expect("failed to spawn activity monitor thread");
}

// ============================================================
// 停止
// ============================================================
pub fn stop() {
    if RUNNING.load(Ordering::SeqCst) {
        RUNNING.store(false, Ordering::SeqCst);
        log_info!("activity", "正在停止空闲监控");
    }
}