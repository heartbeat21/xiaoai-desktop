use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use super::inject;
use tauri::Manager;
use crate::winapi_common::*;
use crate::{log_info, log_error};

static APP_HANDLE: Mutex<Option<tauri::AppHandle>> = Mutex::new(None);
static TASKBAR_MSG_ID: AtomicU32 = AtomicU32::new(0);
static RESTART_COUNT: AtomicU32 = AtomicU32::new(0);

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

pub fn start_monitor(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        unsafe {
            let msg_name = to_wide("TaskbarCreated");
            let taskbar_msg = RegisterWindowMessageW(msg_name.as_ptr());
            if taskbar_msg == 0 {
                log_error!("recovery", "无法注册 TaskbarCreated 消息");
                return;
            }
            log_info!("recovery", "TaskbarCreated 消息 ID: {}", taskbar_msg);

            let class_name = to_wide("XiaoaiRecoveryHook");
            let instance = GetModuleHandleW(std::ptr::null());
            let wndclass = WNDCLASSEXW {
                cb_size: std::mem::size_of::<WNDCLASSEXW>() as u32,
                style: 0,
                lpfn_wnd_proc: recovery_wndproc as *const () as usize,
                cb_cls_extra: 0,
                cb_wnd_extra: 0,
                h_instance: instance,
                h_icon: 0,
                h_cursor: 0,
                hbr_background: 0,
                lpsz_menu_name: std::ptr::null(),
                lpsz_class_name: class_name.as_ptr(),
                h_icon_sm: 0,
            };
            RegisterClassExW(&wndclass);

            let hook_hwnd = CreateWindowExW(
                0, class_name.as_ptr(), std::ptr::null(), 0,
                0, 0, 1, 1, 0, 0, instance, std::ptr::null_mut(),
            );
            if hook_hwnd == 0 {
                log_error!("recovery", "无法创建钩子窗口");
                return;
            }

            APP_HANDLE.lock().unwrap().replace(app_handle);
            TASKBAR_MSG_ID.store(taskbar_msg, Ordering::SeqCst);
            log_info!("recovery", "Explorer 重启恢复监控已启动（消息驱动）");

            let mut msg = std::mem::zeroed::<MSG>();
            while GetMessageW(&mut msg, hook_hwnd, 0, 0) > 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
            DestroyWindow(hook_hwnd);
        }
    });
}

unsafe extern "system" fn recovery_wndproc(hwnd: HWND, msg: DWORD, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    let taskbar_msg = TASKBAR_MSG_ID.load(Ordering::SeqCst);
    if msg == taskbar_msg && taskbar_msg != 0 {
        log_info!("recovery", "收到 TaskbarCreated 广播！Explorer 已重启");
        std::thread::sleep(std::time::Duration::from_millis(100));

        if let Ok(guard) = APP_HANDLE.lock() {
            if let Some(ref app_handle) = *guard {
                let count = RESTART_COUNT.fetch_add(1, Ordering::SeqCst);
                let label = format!("desktop-{}", count);

                inject::trigger_workerw_creation();
                std::thread::sleep(std::time::Duration::from_millis(100));

                match tauri::WebviewWindowBuilder::new(
                    app_handle, &label,
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .transparent(true)
                .decorations(false)
                .visible(false)
                .build()
                {
                    Ok(new_window) => {
                        let new_hwnd = new_window.hwnd().unwrap().0 as isize;
                        match inject::inject_into_desktop(new_hwnd) {
                            Ok(()) => {
                                new_window.show().ok();
                                for (wlabel, window) in app_handle.webview_windows() {
                                    if wlabel != label { window.close().ok(); }
                                }
                                let _ = super::super::system::tray::recreate_tray(app_handle);
                                log_info!("recovery", "恢复成功！");
                            }
                            Err(e) => {
                                log_error!("recovery", "注入失败: {}", e);
                                new_window.close().ok();
                            }
                        }
                    }
                    Err(e) => log_error!("recovery", "创建窗口失败: {}", e),
                }
            }
        }
    }
    DefWindowProcW(hwnd, msg, wparam, lparam)
}