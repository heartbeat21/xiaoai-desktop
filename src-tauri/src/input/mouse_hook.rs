use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, Ordering};
use std::sync::OnceLock;
use tauri::Emitter;
use crate::winapi_common::*;
use crate::{log_info, log_warn, log_error};

// ============================================================
// 常量
// ============================================================
const WH_MOUSE_LL: i32 = 14;
const WM_LBUTTONDOWN: u32 = 0x0201;
const WM_LBUTTONUP: u32 = 0x0202;
const WM_RBUTTONDOWN: u32 = 0x0204;
const WM_LBUTTONDBLCLK: u32 = 0x0203;
const WM_QUIT: u32 = 0x0012;

// ============================================================
// 模块状态
// ============================================================
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
static RUNNING: AtomicBool = AtomicBool::new(false);

// ============================================================
// 钩子回调
// ============================================================
unsafe extern "system" fn mouse_hook_proc(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if n_code >= 0 && l_param != 0 {
        let info = &*(l_param as *const MSLLHOOKSTRUCT);
        let x = info.pt.x as f64;
        let y = info.pt.y as f64;
        let timestamp = info.time as u64;

        if let Some(app) = APP_HANDLE.get() {
            match w_param as u32 {
                WM_LBUTTONDOWN => {
                    let _ = app.emit("mouse:click", &serde_json::json!({
                        "x": x, "y": y, "button": "left", "timestamp": timestamp
                    }));
                }
                WM_RBUTTONDOWN => {
                    let _ = app.emit("mouse:click", &serde_json::json!({
                        "x": x, "y": y, "button": "right", "timestamp": timestamp
                    }));
                }
                WM_LBUTTONDBLCLK => {
                    let _ = app.emit("mouse:dblclick", &serde_json::json!({
                        "x": x, "y": y, "timestamp": timestamp
                    }));
                }
                WM_LBUTTONUP => {
                    let _ = app.emit("mouse:release", &serde_json::json!({
                        "x": x, "y": y, "timestamp": timestamp
                    }));
                }
                _ => {}
            }
        }
    }
    CallNextHookEx(0, n_code, w_param, l_param)
}

// ============================================================
// 启动
// ============================================================
pub fn start(app_handle: tauri::AppHandle) {
    if RUNNING.swap(true, Ordering::SeqCst) {
        log_warn!("mouse_hook", "已运行，跳过重复启动");
        return;
    }

    let _ = APP_HANDLE.set(app_handle);

    std::thread::Builder::new()
        .name("mouse-hook".into())
        .spawn(move || {
            let tid = unsafe { GetCurrentThreadId() };
            HOOK_THREAD_ID.store(tid, Ordering::Relaxed);
            log_info!("mouse_hook", "钩子线程已启动, tid={}", tid);

            let hook = unsafe {
                SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook_proc), std::ptr::null_mut(), 0)
            };

            if hook == 0 {
                log_error!("mouse_hook", "SetWindowsHookExW 失败");
                RUNNING.store(false, Ordering::SeqCst);
                return;
            }

            HOOK_HANDLE.store(hook, Ordering::Release);
            log_info!("mouse_hook", "鼠标钩子已安装");

            let mut msg = unsafe { std::mem::zeroed::<MSG>() };
            loop {
                let ret = unsafe { GetMessageW(&mut msg, 0, 0, 0) };
                if ret == 0 || ret == -1 {
                    break;
                }
                unsafe {
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }

            let h = HOOK_HANDLE.swap(0, Ordering::AcqRel);
            if h != 0 {
                unsafe { UnhookWindowsHookEx(h) };
            }
            RUNNING.store(false, Ordering::SeqCst);
            log_info!("mouse_hook", "钩子线程退出，钩子已卸载");
        })
        .expect("failed to spawn mouse hook thread");
}

// ============================================================
// 停止
// ============================================================
pub fn stop() {
    if !RUNNING.load(Ordering::SeqCst) {
        return;
    }

    let h = HOOK_HANDLE.swap(0, Ordering::AcqRel);
    if h != 0 {
        unsafe { UnhookWindowsHookEx(h) };
        log_info!("mouse_hook", "stop() 中卸载钩子");
    }

    let tid = HOOK_THREAD_ID.load(Ordering::Relaxed);
    if tid != 0 {
        unsafe { PostThreadMessageW(tid, WM_QUIT, 0, 0) };
    }
}