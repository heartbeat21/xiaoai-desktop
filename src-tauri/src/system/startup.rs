// src-tauri/src/system/startup.rs

use crate::log_info; // [LOG]

const KEY_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APP_NAME: &str = "xiaoai-desktop";

// ── Windows API 声明 ──────────────────────────────────────

const HKEY_CURRENT_USER: isize = 0x80000001u32 as isize;
const KEY_READ: u32 = 0x20019;
const KEY_WRITE: u32 = 0x20006;
const REG_SZ: u32 = 1;
const ERROR_SUCCESS: i32 = 0;
const ERROR_FILE_NOT_FOUND: i32 = 2;

extern "system" {
    fn RegOpenKeyExW(
        hkey: isize,
        sub_key: *const u16,
        options: u32,
        desired: u32,
        result: *mut isize,
    ) -> i32;

    fn RegSetValueExW(
        hkey: isize,
        value_name: *const u16,
        reserved: u32,
        reg_type: u32,
        data: *const u8,
        data_len: u32,
    ) -> i32;

    fn RegDeleteValueW(
        hkey: isize,
        value_name: *const u16,
    ) -> i32;

    fn RegQueryValueExW(
        hkey: isize,
        value_name: *const u16,
        reserved: *mut u32,
        reg_type: *mut u32,
        data: *mut u8,
        data_len: *mut u32,
    ) -> i32;

    fn RegCloseKey(hkey: isize) -> i32;
}

// ── 辅助函数 ──────────────────────────────────────────────

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn open_run_key(write: bool) -> Result<isize, String> {
    let wide_path = to_wide(KEY_PATH);
    let access = if write { KEY_WRITE } else { KEY_READ };
    let mut hkey: isize = 0;
    let result = unsafe {
        RegOpenKeyExW(HKEY_CURRENT_USER, wide_path.as_ptr(), 0, access, &mut hkey)
    };
    if result == ERROR_SUCCESS {
        Ok(hkey)
    } else {
        Err(format!("RegOpenKeyExW failed: {}", result))
    }
}

// ── 公开 API ──────────────────────────────────────────────

pub fn is_startup_enabled() -> bool {
    let hkey = match open_run_key(false) {
        Ok(h) => h,
        Err(_) => return false,
    };

    let wide_name = to_wide(APP_NAME);
    let mut data_len: u32 = 0;
    let mut reg_type: u32 = 0;
    let mut reserved: u32 = 0;

    let result = unsafe {
        RegQueryValueExW(
            hkey,
            wide_name.as_ptr(),
            &mut reserved,
            &mut reg_type,
            std::ptr::null_mut(),
            &mut data_len,
        )
    };

    unsafe { RegCloseKey(hkey); }

    result == ERROR_SUCCESS && data_len > 0
}

pub fn enable_startup() -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("获取可执行文件路径失败: {}", e))?;
    let exe_path_str = exe_path.to_string_lossy().to_string();

    let hkey = open_run_key(true)?;
    let wide_name = to_wide(APP_NAME);
    let wide_value: Vec<u16> = exe_path_str.encode_utf16().chain(std::iter::once(0)).collect();
    let data_len = (wide_value.len() * 2) as u32;

    let result = unsafe {
        RegSetValueExW(
            hkey,
            wide_name.as_ptr(),
            0,
            REG_SZ,
            wide_value.as_ptr() as *const u8,
            data_len,
        )
    };

    unsafe { RegCloseKey(hkey); }

    if result == ERROR_SUCCESS {
        log_info!("startup", "已设置开机启动: {}", exe_path_str);
        Ok(())
    } else {
        Err(format!("RegSetValueExW failed: {}", result))
    }
}

pub fn disable_startup() -> Result<(), String> {
    let hkey = open_run_key(true)?;
    let wide_name = to_wide(APP_NAME);

    let result = unsafe { RegDeleteValueW(hkey, wide_name.as_ptr()) };

    unsafe { RegCloseKey(hkey); }

    if result == ERROR_SUCCESS || result == ERROR_FILE_NOT_FOUND {
        log_info!("startup", "已取消开机启动");
        Ok(())
    } else {
        Err(format!("RegDeleteValueW failed: {}", result))
    }
}