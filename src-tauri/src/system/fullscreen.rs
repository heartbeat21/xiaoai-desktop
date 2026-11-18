use std::thread;
use std::time::Duration;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use crate::winapi_common::*;
use crate::log_info;

const MONITOR_DEFAULTTONEAREST: u32 = 2;
const GWL_STYLE: i32 = -16;
const WS_POPUP: i32 = 0x80000000u32 as i32;

// ── 全屏检测逻辑 ──────────────────────────────────────────

fn is_fullscreen_app() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd == 0 {
            return false;
        }

        let mut class_name_buf = [0u16; 256];
        let len = GetClassNameW(hwnd, class_name_buf.as_mut_ptr(), 256);
        if len == 0 {
            return false;
        }
        let class_name: String = String::from_utf16_lossy(&class_name_buf[..len as usize]);

        let skip_classes = ["Progman", "WorkerW", "Shell_TrayWnd", "NotifyIconOverflowWindow"];
        if skip_classes.iter().any(|&c| c == class_name) {
            return false;
        }

        let style = GetWindowLongW(hwnd, GWL_STYLE);
        if style & WS_POPUP != 0 {
            return true;
        }

        let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return false;
        }
        if rect.right <= rect.left || rect.bottom <= rect.top {
            return false;
        }

        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if monitor == 0 {
            return false;
        }

        let mut mi = MONITORINFOEXW {
            cb_size: std::mem::size_of::<MONITORINFOEXW>() as u32,
            rc_monitor: RECT { left: 0, top: 0, right: 0, bottom: 0 },
            rc_work: RECT { left: 0, top: 0, right: 0, bottom: 0 },
            dw_flags: 0,
            sz_device: [0; 32],
        };
        if GetMonitorInfoW(monitor, &mut mi) == 0 {
            return false;
        }

        let monitor_area = ((mi.rc_monitor.right - mi.rc_monitor.left)
            * (mi.rc_monitor.bottom - mi.rc_monitor.top)) as f64;
        if monitor_area <= 0.0 {
            return false;
        }

        let overlap_left = rect.left.max(mi.rc_monitor.left);
        let overlap_top = rect.top.max(mi.rc_monitor.top);
        let overlap_right = rect.right.min(mi.rc_monitor.right);
        let overlap_bottom = rect.bottom.min(mi.rc_monitor.bottom);
        if overlap_right <= overlap_left || overlap_bottom <= overlap_top {
            return false;
        }

        let overlap_area = ((overlap_right - overlap_left)
            * (overlap_bottom - overlap_top)) as f64;
        overlap_area / monitor_area >= 0.98
    }
}

// ── 启动定时检测线程 ──────────────────────────────────────

pub fn start_fullscreen_monitor(app: AppHandle, interval_ms: u64) {
    thread::spawn(move || {
        let mut was_fullscreen = false;
        loop {
            thread::sleep(Duration::from_millis(interval_ms));
            let is_fullscreen = is_fullscreen_app();

            if is_fullscreen && !was_fullscreen {
                log_info!("fullscreen", "全屏应用检测到，暂停渲染");
                let _ = app.emit("fullscreen:enter", ());
                was_fullscreen = true;
            } else if !is_fullscreen && was_fullscreen {
                log_info!("fullscreen", "退出全屏，恢复渲染");
                let _ = app.emit("fullscreen:exit", ());
                was_fullscreen = false;
            }
        }
    });
}

// ── 电源/休眠事件监听 ─────────────────────────────────────

static SUSPENDED: AtomicBool = AtomicBool::new(false);

pub fn start_power_monitor(app: AppHandle) {
    thread::spawn(move || {
        let mut last_uptime = unsafe { GetTickCount64() };
        loop {
            thread::sleep(Duration::from_secs(5));
            let now_uptime = unsafe { GetTickCount64() };
            let diff = now_uptime.saturating_sub(last_uptime);

            if diff > 15000 {
                if !SUSPENDED.load(Ordering::Relaxed) {
                    SUSPENDED.store(true, Ordering::Relaxed);
                    log_info!("power", "检测到系统休眠，暂停渲染");
                    let _ = app.emit("system:suspend", ());
                }
            } else {
                if SUSPENDED.load(Ordering::Relaxed) {
                    SUSPENDED.store(false, Ordering::Relaxed);
                    log_info!("power", "系统唤醒，恢复渲染");
                    let _ = app.emit("system:resume", ());
                }
            }
            last_uptime = now_uptime;
        }
    });
}