// src-tauri/src/logger.rs
// 轻量级日志系统：按日期分文件，写入 exe 同级 logs 目录

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::SystemTime;

static LOG_FILE: Mutex<Option<PathBuf>> = Mutex::new(None);
static LOG_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);

/// 初始化日志系统，传入 exe 所在目录
pub fn init(exe_dir: &std::path::Path) {
    let log_dir = exe_dir.join("logs");

    if let Err(e) = fs::create_dir_all(&log_dir) {
        eprintln!("[log] 创建日志目录失败: {}", e);
        return;
    }

    // 清理 30 天前的日志
    cleanup_old_logs(&log_dir, 30);

    let log_file = log_dir.join(get_log_filename());

    // 写入启动分隔线
    let timestamp = format_timestamp();
    let separator = format!("\n{:=<60}\n[{}] 应用启动\n{:=<60}\n", "", timestamp, "");

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file) {
        let _ = file.write_all(separator.as_bytes());
    }

    *LOG_FILE.lock().unwrap() = Some(log_file);
    *LOG_DIR.lock().unwrap() = Some(log_dir);

    println!("[log] 日志系统已初始化");
}

/// 获取最新日志文件路径（供外部打开）
pub fn get_latest_log_path() -> Option<PathBuf> {
    if let Ok(guard) = LOG_FILE.lock() {
        guard.clone()
    } else {
        None
    }
}

/// 写入日志
pub fn log(level: &str, target: &str, message: &str) {
    let timestamp = format_timestamp();
    let line = format!("[{}] [{:<5}] [{}] {}\n", timestamp, level, target, message);

    #[cfg(debug_assertions)]
    print!("{}", line);

    // 检查日期是否变化，如果变了就切换到新文件
    check_date_roll();

    if let Ok(guard) = LOG_FILE.lock() {
        if let Some(ref path) = *guard {
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
                let _ = file.write_all(line.as_bytes());
            }
        }
    }
}

/// 检查是否需要按天滚动日志
fn check_date_roll() {
    let new_name = get_log_filename();

    if let Ok(mut guard) = LOG_FILE.lock() {
        if let Some(ref current) = *guard {
            if current.file_name().map_or(false, |f| f.to_string_lossy() != new_name) {
                // 日期变了，切换到新文件
                if let Some(ref dir) = *LOG_DIR.lock().unwrap() {
                    let new_path = dir.join(&new_name);
                    *guard = Some(new_path);
                }
            }
        }
    }
}

/// 按日期生成日志文件名
fn get_log_filename() -> String {
    let (year, month, day) = get_current_date();
    format!("app_{:04}-{:02}-{:02}.log", year, month, day)
}

/// 快捷宏
#[macro_export]
macro_rules! log_info {
    ($target:expr, $($arg:tt)*) => {
        $crate::logger::log("INFO", $target, &format!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_warn {
    ($target:expr, $($arg:tt)*) => {
        $crate::logger::log("WARN", $target, &format!($($arg)*))
    };
}

#[macro_export]
macro_rules! log_error {
    ($target:expr, $($arg:tt)*) => {
        $crate::logger::log("ERROR", $target, &format!($($arg)*))
    };
}

fn format_timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let secs_today = now % 86400;
    let hour = secs_today / 3600;
    let minute = (secs_today % 3600) / 60;
    let second = secs_today % 60;

    let days = now / 86400;
    let (year, month, day) = days_to_ymd(days);

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        year, month, day, hour, minute, second
    )
}

fn get_current_date() -> (u64, u64, u64) {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = now / 86400;
    days_to_ymd(days)
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut year = 1970;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let leap = is_leap(year);
    let month_days: [u64; 12] = [
        31, if leap { 29 } else { 28 }, 31, 30, 31, 30,
        31, 31, 30, 31, 30, 31,
    ];

    let mut month = 1;
    for &md in &month_days {
        if days < md {
            break;
        }
        days -= md;
        month += 1;
    }

    (year, month, days + 1)
}

fn is_leap(year: u64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

fn cleanup_old_logs(log_dir: &PathBuf, keep_days: u64) {
    let max_age = keep_days * 86400;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if let Ok(entries) = fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            // 只清理 app_*.log 文件，不动其他文件
            if name.starts_with("app_") && name.ends_with(".log") {
                if let Ok(meta) = fs::metadata(&path) {
                    if let Ok(modified) = meta.modified() {
                        let age = now.saturating_sub(
                            modified
                                .duration_since(SystemTime::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        );
                        if age > max_age {
                            let _ = fs::remove_file(&path);
                        }
                    }
                }
            }
        }
    }
}