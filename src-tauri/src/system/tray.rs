use tauri::menu::{Menu, MenuItem, CheckMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIcon};
use tauri::Emitter;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use crate::{log_info, log_error};

static TRAY: Mutex<Option<TrayIcon>> = Mutex::new(None);
static PAUSED: AtomicBool = AtomicBool::new(false);

pub fn is_paused() -> bool {
    PAUSED.load(Ordering::Relaxed)
}

fn build_menu(app_handle: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let startup_enabled = super::startup::is_startup_enabled();
    let paused = PAUSED.load(Ordering::Relaxed);

    let startup_item = CheckMenuItem::with_id(
        app_handle, "startup", "开机启动", true, startup_enabled, None::<&str>,
    )?;
    let pause_item = CheckMenuItem::with_id(
        app_handle, "pause", "暂停渲染", true, paused, None::<&str>,
    )?;
    let open_log = MenuItem::with_id(app_handle, "open_log", "打开日志", true, None::<&str>)?;
    let separator = MenuItem::with_id(app_handle, "sep1", "───", false, None::<&str>)?;
    let quit = MenuItem::with_id(app_handle, "quit", "退出", true, None::<&str>)?;

    Ok(Menu::with_items(app_handle, &[&startup_item, &pause_item, &open_log, &separator, &quit])?)
}

fn update_menu(app_handle: &tauri::AppHandle) {
    if let Ok(menu) = build_menu(app_handle) {
        if let Ok(guard) = TRAY.lock() {
            if let Some(ref tray) = *guard {
                tray.set_menu(Some(menu)).ok();
            }
        }
    }
}

fn open_log_file() {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    if let Some(log_path) = crate::logger::get_latest_log_path() {
        let path_str = log_path.to_string_lossy().to_string();
        if log_path.exists() {
            let file_wide: Vec<u16> = OsStr::new(&path_str)
                .encode_wide().chain(std::iter::once(0)).collect();
            let verb_wide: Vec<u16> = OsStr::new("open")
                .encode_wide().chain(std::iter::once(0)).collect();

            unsafe {
                use crate::winapi_common::ShellExecuteW;
                ShellExecuteW(0, verb_wide.as_ptr(), file_wide.as_ptr(),
                    std::ptr::null(), std::ptr::null(), 5);
            }
            log_info!("tray", "打开日志: {}", path_str);
        } else {
            let dir = log_path.parent().unwrap();
            let _ = std::fs::create_dir_all(dir);
            let dir_str = dir.to_string_lossy().to_string();
            let dir_wide: Vec<u16> = OsStr::new(&dir_str)
                .encode_wide().chain(std::iter::once(0)).collect();
            let verb_wide: Vec<u16> = OsStr::new("open")
                .encode_wide().chain(std::iter::once(0)).collect();

            unsafe {
                use crate::winapi_common::ShellExecuteW;
                ShellExecuteW(0, verb_wide.as_ptr(), dir_wide.as_ptr(),
                    std::ptr::null(), std::ptr::null(), 5);
            }
            log_info!("tray", "日志不存在，打开目录: {}", dir_str);
        }
    }
}

fn build_tray(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_menu(app_handle)?;

    let tray = TrayIconBuilder::new()
        .icon(app_handle.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("小爱同学 - 桌面助手")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "startup" => {
                    let currently = super::startup::is_startup_enabled();
                    if currently {
                        if let Err(e) = super::startup::disable_startup() {
                            log_error!("tray", "取消开机启动失败: {}", e);
                        }
                    } else {
                        if let Err(e) = super::startup::enable_startup() {
                            log_error!("tray", "设置开机启动失败: {}", e);
                        }
                    }
                    update_menu(app);
                }
                "pause" => {
                    let was_paused = PAUSED.load(Ordering::Relaxed);
                    PAUSED.store(!was_paused, Ordering::Relaxed);

                    if !was_paused {
                        let _ = app.emit("tray:pause", ());
                        log_info!("tray", "已暂停渲染");
                    } else {
                        let _ = app.emit("tray:resume", ());
                        log_info!("tray", "已恢复渲染");
                    }
                    update_menu(app);
                }
                "open_log" => {
                    open_log_file();
                }
                "quit" => {
                    crate::wallpaper::inject::cleanup();
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app_handle)?;

    *TRAY.lock().unwrap() = Some(tray);
    log_info!("tray", "系统托盘已创建");
    Ok(())
}

pub fn create_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    build_tray(app.handle())
}

pub fn recreate_tray(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    if let Ok(mut guard) = TRAY.lock() {
        if let Some(old) = guard.take() {
            drop(old);
        }
    }
    build_tray(app_handle)
}