use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
#[cfg(not(target_os = "windows"))]
use tauri_plugin_notification::NotificationExt;

const CODEX_CLI_TIMEOUT: Duration = Duration::from_secs(60);
const CODEX_CLI_CHECK_TIMEOUT: Duration = Duration::from_secs(8);
const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_EVENT_FOCUS_ENTRY: &str = "tray://focus-entry";
const TRAY_EVENT_OPEN_SEARCH: &str = "tray://open-search";
const TRAY_EVENT_OPEN_SETTINGS: &str = "tray://open-settings";
const TRAY_EVENT_WINDOW_HIDDEN: &str = "tray://window-hidden";
#[cfg(target_os = "windows")]
const TALLYA_NOTIFICATION_APP_ID: &str = "com.tallya";
#[cfg(target_os = "windows")]
const TALLYA_NOTIFICATION_APP_NAME: &str = "Tallya";

#[derive(Clone)]
struct AppWindowState {
    close_to_tray: Arc<AtomicBool>,
    is_quitting: Arc<AtomicBool>,
}

impl Default for AppWindowState {
    fn default() -> Self {
        Self {
            close_to_tray: Arc::new(AtomicBool::new(true)),
            is_quitting: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateDailyMemoryInput {
    date: String,
    raw_content: String,
    supplements: Option<DailyMemorySupplements>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DailyMemorySupplements {
    project_topic: Option<String>,
    tomorrow_plan: Option<String>,
    extra_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratedDailyMemory {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    completed_items: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    key_outcome: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    problems: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tomorrow_plan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    extra_note: Option<String>,
}

#[tauri::command]
async fn check_codex_cli(command: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_codex_cli_check(command))
        .await
        .map_err(|error| {
            eprintln!("Codex check task join failed: {error}");
            "未检测到 Codex，请检查命令路径或登录状态。".to_string()
        })?
}

#[tauri::command]
async fn generate_daily_memory_with_codex(
    input: GenerateDailyMemoryInput,
    codex_command: String,
) -> Result<GeneratedDailyMemory, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_codex_daily_memory_generation(input, codex_command)
    })
    .await
    .map_err(|error| {
        eprintln!("Codex task join failed: {error}");
        "Codex 生成失败，请检查 Codex CLI 是否可用。".to_string()
    })?
}

#[tauri::command]
fn send_tallya_notification(app: tauri::AppHandle, body: String) -> Result<(), String> {
    send_system_notification(app, body).map_err(|error| {
        eprintln!("Failed to send Tallya notification: {error}");
        "发送测试通知失败，请检查系统通知权限。".to_string()
    })
}

#[tauri::command]
fn set_window_behavior(
    state: tauri::State<'_, AppWindowState>,
    close_to_tray: bool,
) -> Result<(), String> {
    state
        .close_to_tray
        .store(close_to_tray, Ordering::SeqCst);
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
fn send_system_notification(app: tauri::AppHandle, body: String) -> Result<(), String> {
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

#[cfg(not(target_os = "windows"))]
fn send_system_notification(app: tauri::AppHandle, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Tallya")
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

fn run_codex_daily_memory_generation(
    input: GenerateDailyMemoryInput,
    codex_command: String,
) -> Result<GeneratedDailyMemory, String> {
    let prompt = build_codex_prompt(&input);
    let output_path = create_codex_output_path();
    let mut child = spawn_codex_cli(&codex_command, &output_path)?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(prompt.as_bytes()).map_err(|error| {
            eprintln!("Failed to write Codex prompt: {error}");
            "Codex 生成失败，请检查 Codex CLI 是否可用。".to_string()
        })?;
    }

    let started_at = Instant::now();

    while started_at.elapsed() < CODEX_CLI_TIMEOUT {
        match child.try_wait() {
            Ok(Some(_)) => {
                let output = child.wait_with_output().map_err(|error| {
                    eprintln!("Failed to read Codex output: {error}");
                    "Codex 生成失败，请检查 Codex CLI 是否可用。".to_string()
                })?;

                if !output.status.success() {
                    eprintln!(
                        "Codex CLI exited with {:?}: {}",
                        output.status.code(),
                        String::from_utf8_lossy(&output.stderr)
                    );
                    let _ = fs::remove_file(&output_path);
                    return Err("Codex 生成失败，请检查 Codex CLI 是否可用。".to_string());
                }

                let raw_output = read_codex_last_message(&output_path)
                    .unwrap_or_else(|| String::from_utf8_lossy(&output.stdout).to_string());
                let _ = fs::remove_file(&output_path);

                return parse_generated_daily_memory(&raw_output, &input);
            }
            Ok(None) => {
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                eprintln!("Failed to poll Codex CLI: {error}");
                let _ = child.kill();
                let _ = fs::remove_file(&output_path);
                return Err("Codex 生成失败，请检查 Codex CLI 是否可用。".to_string());
            }
        }
    }

    let _ = child.kill();
    let _ = fs::remove_file(&output_path);
    Err("生成超时，请稍后重试。".to_string())
}

fn spawn_codex_cli(
    command: &str,
    output_path: &std::path::Path,
) -> Result<std::process::Child, String> {
    let mut last_error = None;

    for command in get_command_candidates(command)? {
        match Command::new(&command)
            .args([
                "exec",
                "--ephemeral",
                "--skip-git-repo-check",
                "--color",
                "never",
                "-c",
                "model_reasoning_effort=\"low\"",
                "-c",
                "features.fast_mode=true",
                "-c",
                "service_tier=\"fast\"",
                "--output-last-message",
                output_path.to_string_lossy().as_ref(),
                "-",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(child) => {
                return Ok(child);
            }
            Err(error) => {
                eprintln!("Failed to start Codex CLI with {command}: {error}");
                last_error = Some(error);
            }
        }
    }

    if let Some(error) = last_error {
        eprintln!("Failed to start Codex CLI after trying candidates: {error}");
    }

    Err("Codex 生成失败，请检查 Codex CLI 是否可用。".to_string())
}

fn run_codex_cli_check(command: String) -> Result<String, String> {
    let mut last_error = None;

    for command in get_command_candidates(&command)? {
        match Command::new(&command)
            .arg("--version")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(mut child) => {
                let started_at = Instant::now();

                while started_at.elapsed() < CODEX_CLI_CHECK_TIMEOUT {
                    match child.try_wait() {
                        Ok(Some(_)) => {
                            let output = child.wait_with_output().map_err(|error| {
                                eprintln!("Failed to read Codex check output: {error}");
                                "未检测到 Codex，请检查命令路径或登录状态。".to_string()
                            })?;

                            if !output.status.success() {
                                eprintln!(
                                    "Codex check exited with {:?}: {}",
                                    output.status.code(),
                                    String::from_utf8_lossy(&output.stderr)
                                );
                                return Err(
                                    "未检测到 Codex，请检查命令路径或登录状态。".to_string()
                                );
                            }

                            let version =
                                String::from_utf8_lossy(&output.stdout).trim().to_string();
                            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

                            return Ok(if !version.is_empty() {
                                version
                            } else if !stderr.is_empty() {
                                stderr
                            } else {
                                "Codex 可用".to_string()
                            });
                        }
                        Ok(None) => thread::sleep(Duration::from_millis(100)),
                        Err(error) => {
                            eprintln!("Failed to poll Codex check: {error}");
                            let _ = child.kill();
                            return Err("未检测到 Codex，请检查命令路径或登录状态。".to_string());
                        }
                    }
                }

                let _ = child.kill();
                return Err("检测 Codex 超时，请稍后重试。".to_string());
            }
            Err(error) => {
                eprintln!("Failed to start Codex check with {command}: {error}");
                last_error = Some(error);
            }
        }
    }

    if let Some(error) = last_error {
        eprintln!("Failed to check Codex CLI after trying candidates: {error}");
    }

    Err("未检测到 Codex，请检查命令路径或登录状态。".to_string())
}

fn get_command_candidates(command: &str) -> Result<Vec<String>, String> {
    let command = command.trim().trim_matches('"');

    if command.is_empty() {
        return Err("未检测到 Codex，请检查命令路径或登录状态。".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let path = std::path::Path::new(command);
        let is_plain_command =
            !command.contains('\\') && !command.contains('/') && path.extension().is_none();

        if is_plain_command {
            return Ok(vec![
                command.to_string(),
                format!("{command}.cmd"),
                format!("{command}.exe"),
            ]);
        }
    }

    Ok(vec![command.to_string()])
}

fn build_codex_prompt(input: &GenerateDailyMemoryInput) -> String {
    let input_json = serde_json::to_string(input).unwrap_or_else(|_| "{}".to_string());

    // The frontend stores structured memories, so Codex must return strict JSON
    // instead of prose that would be hard to validate or recover from.
    format!(
        r#"把输入整理为中文今日工作记忆。只输出合法 JSON，不要 markdown、解释、代码块或工具调用。
JSON keys: summary:string, completedItems:string[], keyOutcome?:string, problems?:string, tomorrowPlan?:string, extraNote?:string.
规则：不编造；只做轻度归纳和润色；未提及的可选字段用 "" 或省略。completedItems 必须是字符串数组，控制在 3-5 条；合并相近事项；每条尽量是完整动作；不要把同一件事拆成过多细碎步骤。keyOutcome 有明确可交付成果时直接提炼；没有明确成果但有多个完成事项时，保守总结一个阶段性产出；不要虚构业务结果或夸大价值。输入很少且无法判断时才留空。
输入：{input_json}
"#
    )
}

fn create_codex_output_path() -> std::path::PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let output_dir = get_tallya_codex_dir();
    let _ = fs::create_dir_all(&output_dir);

    output_dir.join(format!(
        "tallya-codex-daily-memory-{}-{timestamp}.json",
        std::process::id()
    ))
}

fn get_tallya_codex_dir() -> std::path::PathBuf {
    home_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join(".tallya")
        .join("codex")
}

fn home_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(std::path::PathBuf::from)
}

fn read_codex_last_message(path: &std::path::Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn parse_generated_daily_memory(
    raw_output: &str,
    input: &GenerateDailyMemoryInput,
) -> Result<GeneratedDailyMemory, String> {
    let raw_output = raw_output.trim();

    if raw_output.is_empty() {
        return Err("AI 没有返回有效内容，请重试。".to_string());
    }

    let parsed = serde_json::from_str::<GeneratedDailyMemory>(raw_output).map_err(|error| {
        eprintln!("Codex output is not valid JSON: {error}");
        "AI 返回内容不是合法 JSON，请重试。".to_string()
    })?;

    normalize_generated_daily_memory(parsed, input)
}

fn normalize_generated_daily_memory(
    generated: GeneratedDailyMemory,
    input: &GenerateDailyMemoryInput,
) -> Result<GeneratedDailyMemory, String> {
    let summary = if generated.summary.trim().is_empty() {
        summarize_raw_content(&input.raw_content)
    } else {
        generated.summary.trim().to_string()
    };

    if summary.is_empty() {
        return Err("AI 没有返回有效内容，请重试。".to_string());
    }

    Ok(GeneratedDailyMemory {
        summary,
        completed_items: generated
            .completed_items
            .into_iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .collect(),
        key_outcome: normalize_optional_string(generated.key_outcome),
        problems: normalize_optional_string(generated.problems),
        tomorrow_plan: normalize_optional_string(generated.tomorrow_plan),
        extra_note: normalize_optional_string(generated.extra_note),
    })
}

fn summarize_raw_content(raw_content: &str) -> String {
    let normalized = raw_content.split_whitespace().collect::<Vec<_>>().join(" ");

    if normalized.chars().count() <= 72 {
        return normalized;
    }

    let summary = normalized.chars().take(72).collect::<String>();

    format!("{summary}...")
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn setup_tray(app: &mut tauri::App, state: AppWindowState) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("open", "打开 Tallya")
        .text("record-today", "记录今天")
        .text("search", "搜索记忆")
        .text("settings", "设置")
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

                if should_hide {
                    api.prevent_close();
                    let _ = window_for_close.hide();
                    let _ = app_handle.emit(TRAY_EVENT_WINDOW_HIDDEN, ());
                }
            }
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let window_state = AppWindowState::default();

            app.manage(window_state.clone());
            setup_tray(app, window_state.clone())?;
            setup_close_to_tray(app, window_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_codex_cli,
            generate_daily_memory_with_codex,
            hide_main_window,
            quit_app,
            send_tallya_notification,
            set_window_behavior,
            show_main_window,
            toggle_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
