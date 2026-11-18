use std::sync::Mutex;
use crate::winapi_common::*;
use crate::log_info;

pub type HWND = isize;

static TARGET_WORKERW: Mutex<isize> = Mutex::new(0);

const SMTO_NORMAL: u32 = 0x0000;
const SWP_NOZORDER: u32 = 0x0004;
const SWP_FRAMECHANGED: u32 = 0x0020;

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: isize) -> i32 {
    let mut class_name = [0u16; 256];
    let len = GetClassNameW(hwnd, class_name.as_mut_ptr(), 256);
    if len > 0 {
        let name = String::from_utf16_lossy(&class_name[..len as usize]);
        if name == "WorkerW" {
            let shell_class = to_wide("SHELLDLL_DefView");
            let child = FindWindowExW(hwnd, 0, shell_class.as_ptr(), std::ptr::null());
            if child == 0 {
                *(lparam as *mut HWND) = hwnd;
            }
        }
    }
    1
}

pub fn inject_into_desktop(our_hwnd: isize) -> Result<(), String> {
    unsafe {
        let progman_class = to_wide("Progman");
        let progman = FindWindowW(progman_class.as_ptr(), std::ptr::null());
        if progman == 0 {
            return Err("找不到 Progman 窗口".into());
        }

        let mut result: usize = 0;
        SendMessageTimeoutW(progman, 0x052C, 0x0D, 0, SMTO_NORMAL, 1000, &mut result);
        SendMessageTimeoutW(progman, 0x052C, 0x0D, 1, SMTO_NORMAL, 1000, &mut result);

        let mut target: HWND = 0;
        EnumWindows(Some(enum_callback), &mut target as *mut _ as isize);
        if target == 0 {
            return Err("未找到目标 WorkerW".into());
        }

        SetParent(our_hwnd, target);

        let sw = GetSystemMetrics(0);
        let sh = GetSystemMetrics(1);
        SetWindowPos(our_hwnd, 0, 0, 0, sw, sh, SWP_NOZORDER | SWP_FRAMECHANGED);

        let margins = MARGINS { left: -1, right: -1, top: -1, bottom: -1 };
        DwmExtendFrameIntoClientArea(our_hwnd, &margins);

        *TARGET_WORKERW.lock().unwrap() = target;
        log_info!("inject", "注入成功, 屏幕: {}x{}", sw, sh);

        Ok(())
    }
}

pub fn get_screen_size() -> (u32, u32) {
    unsafe { (GetSystemMetrics(0) as u32, GetSystemMetrics(1) as u32) }
}

pub fn get_dpi_scale() -> f64 {
    unsafe {
        let hdc = GetDC(0);
        let dpi = GetDeviceCaps(hdc, 88);
        ReleaseDC(0, hdc);
        dpi as f64 / 96.0
    }
}

pub fn is_workerw_valid() -> bool {
    let val = *TARGET_WORKERW.lock().unwrap();
    if val == 0 { return false; }
    unsafe { IsWindow(val) != 0 }
}

pub fn trigger_workerw_creation() {
    unsafe {
        let progman_class = to_wide("Progman");
        let progman = FindWindowW(progman_class.as_ptr(), std::ptr::null());
        if progman != 0 {
            let mut result: usize = 0;
            SendMessageTimeoutW(progman, 0x052C, 0x0D, 0, SMTO_NORMAL, 1000, &mut result);
            SendMessageTimeoutW(progman, 0x052C, 0x0D, 1, SMTO_NORMAL, 1000, &mut result);
        }
    }
}

pub fn cleanup() {
    let val = *TARGET_WORKERW.lock().unwrap();
    if val == 0 {
        log_info!("inject", "cleanup: 无 WorkerW 需要清理");
        return;
    }
    unsafe { ShowWindow(val, 0); }
    log_info!("inject", "cleanup: 已隐藏 WorkerW");
}