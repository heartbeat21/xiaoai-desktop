// src-tauri/src/winapi_common.rs
// Windows API 公共声明，避免跨模块签名冲突

#![allow(non_snake_case)]

// ── 类型别名 ──────────────────────────────────────────────

pub type HWND = isize;
pub type HDC = isize;
pub type HMONITOR = isize;
pub type HHOOK = isize;
pub type HMENU = isize;
pub type HMODULE = isize;

pub type DWORD = u32;
pub type WORD = u16;
pub type LONG = i32;
pub type BOOL = i32;
pub type WPARAM = usize;
pub type LPARAM = isize;
pub type LRESULT = isize;
pub type ATOM = u16;

// ── 结构体 ────────────────────────────────────────────────

#[repr(C)]
pub struct POINT {
    pub x: LONG,
    pub y: LONG,
}

#[repr(C)]
pub struct RECT {
    pub left: LONG,
    pub top: LONG,
    pub right: LONG,
    pub bottom: LONG,
}

#[repr(C)]
pub struct MARGINS {
    pub left: i32,
    pub right: i32,
    pub top: i32,
    pub bottom: i32,
}

#[repr(C)]
pub struct MONITORINFOEXW {
    pub cb_size: DWORD,
    pub rc_monitor: RECT,
    pub rc_work: RECT,
    pub dw_flags: DWORD,
    pub sz_device: [u16; 32],
}

#[repr(C)]
pub struct LASTINPUTINFO {
    pub cb_size: DWORD,
    pub dw_time: DWORD,
}

#[repr(C)]
pub struct MSLLHOOKSTRUCT {
    pub pt: POINT,
    pub mouse_data: DWORD,
    pub flags: DWORD,
    pub time: DWORD,
    pub dw_extra_info: usize,
}

#[repr(C)]
pub struct MSG {
    pub hwnd: HWND,
    pub message: DWORD,
    pub w_param: WPARAM,
    pub l_param: LPARAM,
    pub time: DWORD,
    pub pt: POINT,
}

#[repr(C)]
pub struct WNDCLASSEXW {
    pub cb_size: u32,
    pub style: u32,
    pub lpfn_wnd_proc: usize,
    pub cb_cls_extra: i32,
    pub cb_wnd_extra: i32,
    pub h_instance: HWND,
    pub h_icon: HWND,
    pub h_cursor: HWND,
    pub hbr_background: HWND,
    pub lpsz_menu_name: *const u16,
    pub lpsz_class_name: *const u16,
    pub h_icon_sm: HWND,
}

// ── 回调类型 ──────────────────────────────────────────────

pub type WNDENUMPROC = Option<unsafe extern "system" fn(hwnd: HWND, lparam: isize) -> BOOL>;
pub type HOOKPROC = Option<unsafe extern "system" fn(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT>;
pub type WNDPROC = usize;

// ── 公共 API 声明 ────────────────────────────────────────

unsafe extern "system" {
    // 窗口管理
    pub fn FindWindowW(lp_class_name: *const u16, lp_window_name: *const u16) -> HWND;
    pub fn FindWindowExW(hwnd_parent: HWND, hwnd_child_after: HWND, lpsz_class: *const u16, lpsz_window: *const u16) -> HWND;
    pub fn SetParent(hWndChild: HWND, hWndNewParent: HWND) -> HWND;
    pub fn SetWindowPos(hWnd: HWND, hWndInsertAfter: HWND, X: i32, Y: i32, cx: i32, cy: i32, uFlags: u32) -> BOOL;
    pub fn GetClassNameW(hWnd: HWND, lpClassName: *mut u16, nMaxCount: i32) -> i32;
    pub fn GetWindowLongW(hWnd: HWND, nIndex: i32) -> i32;
    pub fn GetWindowRect(hWnd: HWND, lpRect: *mut RECT) -> BOOL;
    pub fn IsWindow(hWnd: HWND) -> BOOL;
    pub fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
    pub fn IsZoomed(hWnd: HWND) -> BOOL;
    pub fn DestroyWindow(hWnd: HWND) -> BOOL;
    pub fn CreateWindowExW(dwExStyle: DWORD, lpClassName: *const u16, lpWindowName: *const u16, dwStyle: DWORD, x: i32, y: i32, nWidth: i32, nHeight: i32, hWndParent: HWND, hMenu: HMENU, hInstance: HMODULE, lpParam: *mut core::ffi::c_void) -> HWND;
    pub fn DefWindowProcW(hWnd: HWND, msg: DWORD, w_param: WPARAM, l_param: LPARAM) -> LRESULT;
    pub fn RegisterClassExW(lpwcx: *const WNDCLASSEXW) -> ATOM;
    pub fn GetForegroundWindow() -> HWND;
    pub fn GetSystemMetrics(nIndex: i32) -> i32;
    pub fn EnumWindows(lpEnumFunc: WNDENUMPROC, lParam: isize) -> BOOL;
    pub fn MonitorFromWindow(hWnd: HWND, dwFlags: DWORD) -> HMONITOR;
    pub fn GetMonitorInfoW(hMonitor: HMONITOR, lpmi: *mut MONITORINFOEXW) -> BOOL;
    pub fn SendMessageTimeoutW(hWnd: HWND, msg: DWORD, w_param: WPARAM, l_param: LPARAM, fuFlags: DWORD, uTimeout: DWORD, lpdwResult: *mut usize) -> isize;
    pub fn RegisterWindowMessageW(lpString: *const u16) -> DWORD;

    // DWM
    pub fn DwmExtendFrameIntoClientArea(hWnd: HWND, pMarInset: *const MARGINS) -> i32;

    // 设备上下文
    pub fn GetDC(hWnd: HWND) -> HDC;
    pub fn GetDeviceCaps(hdc: HDC, nIndex: i32) -> i32;
    pub fn ReleaseDC(hWnd: HWND, hdc: HDC) -> i32;

    // 消息循环
    pub fn GetMessageW(lpMsg: *mut MSG, hWnd: HWND, wMsgFilterMin: DWORD, wMsgFilterMax: DWORD) -> BOOL;
    pub fn TranslateMessage(lpMsg: *const MSG) -> BOOL;
    pub fn DispatchMessageW(lpMsg: *const MSG) -> LRESULT;
    pub fn PostThreadMessageW(id_thread: DWORD, msg: DWORD, w_param: WPARAM, l_param: LPARAM) -> BOOL;
    pub fn GetCurrentThreadId() -> DWORD;

    // 鼠标
    pub fn GetCursorPos(lpPoint: *mut POINT) -> BOOL;

    // 输入检测
    pub fn GetLastInputInfo(plii: *mut LASTINPUTINFO) -> BOOL;
    pub fn GetTickCount() -> DWORD;
    pub fn GetTickCount64() -> u64;

    // 钩子
    pub fn SetWindowsHookExW(id_hook: i32, lpfn: HOOKPROC, hmod: *mut core::ffi::c_void, dw_thread_id: DWORD) -> HHOOK;
    pub fn CallNextHookEx(hhk: HHOOK, n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT;
    pub fn UnhookWindowsHookEx(hhk: HHOOK) -> BOOL;

    // 模块
    pub fn GetModuleHandleW(lpModuleName: *const u16) -> HMODULE;

    // 注册表
    pub fn RegOpenKeyExW(hKey: isize, lpSubKey: *const u16, ulOptions: DWORD, samDesired: DWORD, phkResult: *mut isize) -> i32;
    pub fn RegSetValueExW(hKey: isize, lpValueName: *const u16, dwReserved: DWORD, dwType: DWORD, lpData: *const u8, cbData: DWORD) -> i32;
    pub fn RegDeleteValueW(hKey: isize, lpValueName: *const u16) -> i32;
    pub fn RegQueryValueExW(hKey: isize, lpValueName: *const u16, lpReserved: *mut DWORD, lpType: *mut DWORD, lpData: *mut u8, lpcbData: *mut DWORD) -> i32;
    pub fn RegCloseKey(hKey: isize) -> i32;

    // Shell
    pub fn ShellExecuteW(hwnd: HWND, lpOperation: *const u16, lpFile: *const u16, lpParameters: *const u16, lpDirectory: *const u16, nShowCmd: i32) -> isize;
}