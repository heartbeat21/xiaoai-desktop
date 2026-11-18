#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::ffi::c_void;

use xiaoai_desktop_lib::wallpaper;
use xiaoai_desktop_lib::system;
use xiaoai_desktop_lib::input;
use xiaoai_desktop_lib::logger;
use xiaoai_desktop_lib::{log_info, log_error};

#[derive(serde::Serialize)]
struct ScreenInfo {
    width: u32,
    height: u32,
    dpi_scale: f64,
}

#[tauri::command]
fn get_screen_info() -> ScreenInfo {
    let (sw, sh) = wallpaper::inject::get_screen_size();
    let dpi_scale = wallpaper::inject::get_dpi_scale();
    ScreenInfo { width: sw, height: sh, dpi_scale }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_screen_info])
        .setup(|app| {
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            logger::init(&exe_dir);

            log_info!("main", "应用启动中...");

            let window = app.get_webview_window("main").unwrap();
            let hwnd = window.hwnd().unwrap().0 as *mut c_void;
            log_info!("main", "获取窗口句柄成功");

            if let Err(e) = wallpaper::inject::inject_into_desktop(hwnd as isize) {
                log_error!("main", "壁纸注入失败: {}", e);
            } else {
                log_info!("main", "壁纸注入成功");
            }

            window.show().ok();
            #[cfg(debug_assertions)]
                window.open_devtools();

            let app_handle = app.handle().clone();

            input::mouse_poll::start_mouse_polling(app_handle.clone());
            input::mouse_hook::start(app_handle.clone());
            input::activity::start(app_handle.clone());

            wallpaper::recovery::start_monitor(app_handle.clone());

            system::fullscreen::start_fullscreen_monitor(app_handle.clone(), 2000);
            system::fullscreen::start_power_monitor(app_handle.clone());

            system::tray::create_tray(app)?;

            ctrlc::set_handler(|| {
                input::mouse_hook::stop();
                input::activity::stop();
                wallpaper::inject::cleanup();
                std::process::exit(0);
            }).ok();

            log_info!("main", "所有模块初始化完成");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("程序运行失败");
}