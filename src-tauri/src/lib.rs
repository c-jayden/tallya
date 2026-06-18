use std::{
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::{
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
#[cfg(not(target_os = "windows"))]
use tauri_plugin_notification::NotificationExt;

mod ai_http;
mod codex;
mod system_proxy;

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_EVENT_FOCUS_ENTRY: &str = "tray://focus-entry";
const TRAY_EVENT_OPEN_SEARCH: &str = "tray://open-search";
const TRAY_EVENT_OPEN_SETTINGS: &str = "tray://open-settings";
const TRAY_EVENT_CHECK_UPDATE: &str = "tray://check-update";
const TRAY_EVENT_WINDOW_HIDDEN: &str = "tray://window-hidden";
const TRAY_EVENT_CLOSE_BLOCKED: &str = "tray://close-blocked";
const TRAY_EVENT_OPEN_THREADS: &str = "tray://open-threads";
#[cfg(target_os = "windows")]
const TALLYA_NOTIFICATION_APP_ID: &str = "com.tallya";
#[cfg(target_os = "windows")]
const TALLYA_NOTIFICATION_APP_NAME: &str = "Tallya";

#[derive(Clone)]
struct AppWindowState {
    close_to_tray: Arc<AtomicBool>,
    is_quitting: Arc<AtomicBool>,
    active_ai_task: Arc<AtomicBool>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MainWindowStateSnapshot {
    visible: bool,
    minimized: bool,
    focused: bool,
}

impl Default for AppWindowState {
    fn default() -> Self {
        Self {
            close_to_tray: Arc::new(AtomicBool::new(true)),
            is_quitting: Arc::new(AtomicBool::new(false)),
            active_ai_task: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[tauri::command]
fn send_tallya_notification(app: tauri::AppHandle, body: String) -> Result<(), String> {
    send_system_notification(app, body, None).map_err(|error| {
        eprintln!("Failed to send Tallya notification: {error}");
        "发送测试通知失败，请检查系统通知权限。".to_string()
    })
}

// Like send_tallya_notification, but clicking it also opens the threads hub (where
// the pending merges live). Only the Windows toast carries the click action; on
// other platforms clicking just brings the app forward.
#[tauri::command]
fn send_merge_nudge_notification(app: tauri::AppHandle, body: String) -> Result<(), String> {
    send_system_notification(app, body, Some(TRAY_EVENT_OPEN_THREADS)).map_err(|error| {
        eprintln!("Failed to send merge-nudge notification: {error}");
        "发送通知失败，请检查系统通知权限。".to_string()
    })
}

#[tauri::command]
fn set_window_behavior(
    state: tauri::State<'_, AppWindowState>,
    close_to_tray: bool,
) -> Result<(), String> {
    state.close_to_tray.store(close_to_tray, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    show_and_focus_main_window(&app);
    Ok(())
}

#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "未找到主窗口。".to_string())?;

    window.hide().map_err(|error| {
        eprintln!("Failed to hide main window: {error}");
        "隐藏主窗口失败，请稍后重试。".to_string()
    })
}

// Mirrors the pending-merge count onto the OS app badge (macOS dock / Linux
// launcher). `None` clears it. Best-effort: a windowing backend that can't render
// a numeric badge (notably Windows, where it'd need a taskbar overlay) just no-ops
// rather than erroring — the in-app badge stays the source of truth.
#[tauri::command]
fn set_badge_count(app: tauri::AppHandle, count: Option<u32>) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "未找到主窗口。".to_string())?;

    let badge = match count {
        Some(value) if value > 0 => Some(i64::from(value)),
        _ => None,
    };

    if let Err(error) = window.set_badge_count(badge) {
        eprintln!("Failed to set badge count: {error}");
    }

    Ok(())
}

#[tauri::command]
fn set_active_ai_task_running(
    state: tauri::State<'_, AppWindowState>,
    active: bool,
) -> Result<(), String> {
    state.active_ai_task.store(active, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn get_main_window_state(app: tauri::AppHandle) -> Result<MainWindowStateSnapshot, String> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "未找到主窗口。".to_string())?;

    Ok(MainWindowStateSnapshot {
        visible: window.is_visible().unwrap_or(false),
        minimized: window.is_minimized().unwrap_or(false),
        focused: window.is_focused().unwrap_or(false),
    })
}

#[tauri::command]
fn toggle_main_window(app: tauri::AppHandle) -> Result<(), String> {
    toggle_main_window_visibility(&app)
}

fn toggle_main_window_visibility(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_minimized = window.is_minimized().unwrap_or(false);
        let is_focused = window.is_focused().unwrap_or(false);

        if is_visible && !is_minimized && is_focused {
            return window.hide().map_err(|error| {
                eprintln!("Failed to hide main window: {error}");
                "隐藏主窗口失败，请稍后重试。".to_string()
            });
        }
    }

    show_and_focus_main_window(app);
    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle, state: tauri::State<'_, AppWindowState>) -> Result<(), String> {
    state.is_quitting.store(true, Ordering::SeqCst);
    app.exit(0);
    Ok(())
}

#[cfg(target_os = "windows")]
fn send_system_notification(
    app: tauri::AppHandle,
    body: String,
    on_activate_event: Option<&'static str>,
) -> Result<(), String> {
    use tauri_winrt_notification::{Duration as ToastDuration, Scenario, Toast};

    ensure_windows_notification_app_id()?;

    let app_for_activation = app.clone();

    Toast::new(TALLYA_NOTIFICATION_APP_ID)
        .title(TALLYA_NOTIFICATION_APP_NAME)
        .text1(&body)
        .duration(ToastDuration::Short)
        .scenario(Scenario::Reminder)
        .on_activated(move |_| {
            show_and_focus_main_window(&app_for_activation);
            if let Some(event) = on_activate_event {
                let _ = app_for_activation.emit(event, ());
            }
            Ok(())
        })
        .show()
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn ensure_windows_notification_app_id() -> Result<(), String> {
    let key = windows_registry::CURRENT_USER
        .create(format!(
            r"SOFTWARE\Classes\AppUserModelId\{TALLYA_NOTIFICATION_APP_ID}"
        ))
        .map_err(|error| error.to_string())?;

    key.set_string("DisplayName", TALLYA_NOTIFICATION_APP_NAME)
        .map_err(|error| error.to_string())?;
    key.set_string("IconBackgroundColor", "0")
        .map_err(|error| error.to_string())
}

fn show_and_focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

// Exposes the OS proxy so the frontend can pass it to the updater's
// `check({ proxy })` (its reqwest client doesn't read the Windows system proxy
// on its own). All native HTTP clients use the same source — see `system_proxy`.
#[tauri::command]
fn get_system_proxy() -> Option<String> {
    system_proxy::system_proxy_url()
}

#[cfg(not(target_os = "windows"))]
fn send_system_notification(
    app: tauri::AppHandle,
    body: String,
    // The plugin notification can't route a click back to JS without action-type
    // listeners, so non-Windows platforms ignore this and just show the toast.
    _on_activate_event: Option<&'static str>,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Tallya")
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

// window. CREATE_NO_WINDOW keeps it hidden; no-op on other platforms.
pub(crate) fn suppress_console_window(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = command;
    }
}

// Open the app's data ("data") or logs ("logs") directory in the OS file
// manager. Done in Rust to avoid the JS fs/opener plugin scope pitfalls that
// made the previous implementation fail on macOS.
#[tauri::command]
fn open_app_directory(app: tauri::AppHandle, kind: String) -> Result<(), String> {
    use tauri::Manager;

    let base = app.path().app_data_dir().map_err(|error| {
        eprintln!("Failed to resolve app data dir: {error}");
        "无法定位应用数据目录。".to_string()
    })?;
    let dir = if kind == "logs" {
        base.join("logs")
    } else {
        base
    };

    std::fs::create_dir_all(&dir).map_err(|error| {
        eprintln!("Failed to create directory {dir:?}: {error}");
        "无法创建目录。".to_string()
    })?;

    reveal_directory(&dir)
}

fn reveal_directory(dir: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let program = "xdg-open";

    let mut command = Command::new(program);
    command.arg(dir);
    suppress_console_window(&mut command);

    command.spawn().map_err(|error| {
        eprintln!("Failed to open directory {dir:?}: {error}");
        "打开目录失败。".to_string()
    })?;

    Ok(())
}

fn setup_tray(app: &mut tauri::App, state: AppWindowState) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("open", "打开 Tallya")
        .text("record-today", "记录今天")
        .text("search", "搜索记忆")
        .text("settings", "设置")
        .text("check-update", "检查更新")
        .separator()
        .text("quit", "退出")
        .build()?;
    let app_icon = app.default_window_icon().cloned();

    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .tooltip("Tallya / 职迹")
        .show_menu_on_left_click(false);

    if let Some(icon) = app_icon {
        tray = tray.icon(icon);
    }

    let menu_state = state.clone();

    tray.on_menu_event(move |app, event| match event.id().as_ref() {
        "open" => {
            show_and_focus_main_window(app);
        }
        "record-today" => {
            show_and_focus_main_window(app);
            let _ = app.emit(TRAY_EVENT_FOCUS_ENTRY, ());
        }
        "search" => {
            show_and_focus_main_window(app);
            let _ = app.emit(TRAY_EVENT_OPEN_SEARCH, ());
        }
        "settings" => {
            show_and_focus_main_window(app);
            let _ = app.emit(TRAY_EVENT_OPEN_SETTINGS, ());
        }
        "check-update" => {
            show_and_focus_main_window(app);
            let _ = app.emit(TRAY_EVENT_CHECK_UPDATE, ());
        }
        "quit" => {
            menu_state.is_quitting.store(true, Ordering::SeqCst);
            app.exit(0);
        }
        _ => {}
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            let _ = toggle_main_window_visibility(tray.app_handle());
        }
    })
    .build(app)?;

    Ok(())
}

fn setup_close_to_tray(app: &mut tauri::App, state: AppWindowState) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let app_handle = app.handle().clone();
        let window_for_close = window.clone();

        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let should_hide = state.close_to_tray.load(Ordering::SeqCst)
                    && !state.is_quitting.load(Ordering::SeqCst);
                let should_block_close = state.active_ai_task.load(Ordering::SeqCst)
                    && !state.is_quitting.load(Ordering::SeqCst);

                if should_hide {
                    api.prevent_close();
                    let _ = window_for_close.hide();
                    let _ = app_handle.emit(TRAY_EVENT_WINDOW_HIDDEN, ());
                } else if should_block_close {
                    api.prevent_close();
                    let _ = app_handle.emit(TRAY_EVENT_CLOSE_BLOCKED, ());
                }
            }
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            let window_state = AppWindowState::default();

            app.manage(window_state.clone());
            setup_tray(app, window_state.clone())?;
            setup_close_to_tray(app, window_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            codex::analyze_report_style_with_codex,
            codex::check_codex_cli,
            codex::generate_daily_memory_with_codex,
            codex::generate_range_report_with_codex,
            codex::generate_weekly_report_with_codex,
            get_main_window_state,
            get_system_proxy,
            hide_main_window,
            open_app_directory,
            quit_app,
            send_merge_nudge_notification,
            send_tallya_notification,
            set_active_ai_task_running,
            set_badge_count,
            set_window_behavior,
            show_main_window,
            codex::suggest_clarifications_with_codex,
            codex::suggest_thread_link_with_codex,
            codex::suggest_report_gaps_with_codex,
            ai_http::probe_openai_compatible_gateway,
            ai_http::send_ai_http_request,
            ai_http::send_openai_compatible_request,
            toggle_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
