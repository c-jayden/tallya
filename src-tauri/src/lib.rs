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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    daily_report_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateWeeklyReportInput {
    start_date: String,
    end_date: String,
    memories: Vec<DailyMemoryForReport>,
    #[serde(default = "default_report_length")]
    report_length: String,
    #[serde(default = "default_report_tone")]
    report_tone: String,
    #[serde(default = "default_report_focus")]
    report_focus: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateRangeReportInput {
    #[serde(default = "default_report_type")]
    report_type: String,
    start_date: String,
    end_date: String,
    memories: Vec<DailyMemoryForReport>,
    #[serde(default = "default_report_length")]
    report_length: String,
    #[serde(default = "default_report_tone")]
    report_tone: String,
    #[serde(default = "default_report_focus")]
    report_focus: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DailyMemoryForReport {
    id: String,
    date: String,
    raw_content: String,
    supplements: DailyMemorySupplements,
    generated: Option<GeneratedDailyMemory>,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneratedReportContent {
    #[serde(default)]
    title: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    highlights: Vec<String>,
    #[serde(default)]
    completed_items: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    problems: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    next_week_plan: Option<String>,
    #[serde(default)]
    markdown: String,
}

fn default_report_length() -> String {
    "standard".to_string()
}

fn default_report_type() -> String {
    "weekly".to_string()
}

fn default_report_tone() -> String {
    "natural".to_string()
}

fn default_report_focus() -> String {
    "outcomes".to_string()
}

impl GenerateWeeklyReportInput {
    fn into_range_report_input(self) -> GenerateRangeReportInput {
        GenerateRangeReportInput {
            report_type: "weekly".to_string(),
            start_date: self.start_date,
            end_date: self.end_date,
            memories: self.memories,
            report_length: self.report_length,
            report_tone: self.report_tone,
            report_focus: self.report_focus,
        }
    }
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
    codex_model: String,
) -> Result<GeneratedDailyMemory, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_codex_daily_memory_generation(input, codex_command, codex_model)
    })
    .await
    .map_err(|error| {
        eprintln!("Codex task join failed: {error}");
        "Codex 生成失败，请检查 Codex CLI 是否可用。".to_string()
    })?
}

#[tauri::command]
async fn generate_weekly_report_with_codex(
    input: GenerateWeeklyReportInput,
    codex_command: String,
    codex_model: String,
) -> Result<GeneratedReportContent, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_codex_range_report_generation(
            input.into_range_report_input(),
            codex_command,
            codex_model,
        )
    })
    .await
    .map_err(|error| {
        eprintln!("Codex weekly report task join failed: {error}");
        "Codex 生成失败，请检查 Codex CLI 是否可用。".to_string()
    })?
}

#[tauri::command]
async fn generate_range_report_with_codex(
    input: GenerateRangeReportInput,
    codex_command: String,
    codex_model: String,
) -> Result<GeneratedReportContent, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_codex_range_report_generation(input, codex_command, codex_model)
    })
    .await
    .map_err(|error| {
        eprintln!("Codex range report task join failed: {error}");
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
    codex_model: String,
) -> Result<GeneratedDailyMemory, String> {
    let prompt = build_codex_prompt(&input);
    run_codex_prompt_generation(
        prompt,
        codex_command,
        codex_model,
        "daily-memory",
        |raw_output| parse_generated_daily_memory(raw_output, &input),
    )
}

fn run_codex_range_report_generation(
    input: GenerateRangeReportInput,
    codex_command: String,
    codex_model: String,
) -> Result<GeneratedReportContent, String> {
    let prompt = build_codex_range_report_prompt(&input);
    run_codex_prompt_generation(
        prompt,
        codex_command,
        codex_model,
        "range-report",
        |raw_output| parse_generated_range_report(raw_output, &input),
    )
}

fn run_codex_prompt_generation<T>(
    prompt: String,
    codex_command: String,
    codex_model: String,
    output_kind: &str,
    parse_output: impl FnOnce(&str) -> Result<T, String>,
) -> Result<T, String> {
    let output_path = create_codex_output_path(output_kind);
    let mut child = spawn_codex_cli(&codex_command, &codex_model, &output_path)?;

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

                return parse_output(&raw_output);
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
    model: &str,
    output_path: &std::path::Path,
) -> Result<std::process::Child, String> {
    let mut last_error = None;
    let codex_model = normalize_codex_model(model);

    for command in get_command_candidates(command)? {
        match Command::new(&command)
            .args([
                "exec",
                "--ephemeral",
                "--skip-git-repo-check",
                "--color",
                "never",
                "-m",
                codex_model.as_str(),
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

fn normalize_codex_model(model: &str) -> String {
    let model = model.trim();

    if model.is_empty() {
        return "gpt-5.4-mini".to_string();
    }

    model.to_string()
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
JSON keys: summary:string, completedItems:string[], keyOutcome?:string, problems?:string, tomorrowPlan?:string, extraNote?:string, dailyReportText?:string.
规则：不编造；只做轻度归纳和润色；未提及的可选字段用 "" 或省略。completedItems 必须是字符串数组，控制在 3-5 条；合并相近事项；每条尽量是完整动作；不要把同一件事拆成过多细碎步骤。keyOutcome 有明确可交付成果时直接提炼；没有明确成果但有多个完成事项时，保守总结一个阶段性产出；不要虚构业务结果或夸大价值。输入很少且无法判断时才留空。
dailyReportText 是适合复制到企业微信、飞书、日报表格或公司日报系统的日报文本；基于输入和结构化结果轻度整理，不要照抄原文，不要写成周报、复盘报告或领导评价。默认优先一段自然文本；信息明显分为完成事项、问题、计划时可分点，但最多 3 个分组，不要为了分点而分点。总体控制在 80-300 字；不要使用 Markdown 标题符号；不要输出“本次未提及”；不要暴露 AI 分析痕迹。
输入：{input_json}
"#
    )
}

#[cfg(test)]
fn build_codex_weekly_report_prompt(input: &GenerateWeeklyReportInput) -> String {
    build_codex_range_report_prompt(&input.clone().into_range_report_input())
}

fn build_codex_range_report_prompt(input: &GenerateRangeReportInput) -> String {
    let input_json = serde_json::to_string(input).unwrap_or_else(|_| "{}".to_string());
    let length_instruction = report_length_instruction(&input.report_length);
    let tone_instruction = report_tone_instruction(&input.report_tone);
    let focus_instruction = report_focus_instruction(&input.report_focus);
    let single_memory_instruction = report_single_memory_instruction(input);
    let is_custom = input.report_type == "custom";
    let report_name = if is_custom {
        "自定义范围工作总结"
    } else {
        "本周周报"
    };
    let title_instruction = if is_custom {
        "title 根据时间范围生成，例如：2026年6月1日-6月7日工作总结。"
    } else {
        "title 使用适合本周范围的周报标题。"
    };
    let plan_key_instruction = if is_custom {
        "nextWeekPlan 表示该范围后的下一步计划，根据明日计划、未完成事项和问题保守提炼；没有则返回空字符串。"
    } else {
        "nextWeekPlan 根据明日计划、未完成事项和问题保守提炼；没有则返回空字符串。"
    };

    format!(
        r#"请根据输入中的 daily memories 整理一份中文{report_name}。只输出合法 JSON，不要 markdown code fence、解释、代码块或工具调用。
JSON keys: title:string, summary:string, highlights:string[], completedItems:string[], problems?:string, nextWeekPlan?:string, markdown:string.
规则：
- 只能使用输入里已经存在的工作记忆，不要编造没有做过的事情。
- 可以做归纳、合并和润色，语气遵守 Tallya 的产品性格：温和、克制、清楚，不鸡血、不像任务监督或绩效评价。
- {title_instruction}
- {length_instruction}
- {single_memory_instruction}
- {tone_instruction}
- {focus_instruction}
- completedItems 合并相近事项，避免把同一件事拆得过碎。
- problems 只总结 daily memories 中提到的问题或风险；没有则返回空字符串。
- {plan_key_instruction}
- markdown 是一份可直接复制的报告文本，使用中文标题和分节。
- markdown 不要包含多余空行；section 之间最多一个空行；不要输出空 section；不要用空行撑篇幅。
输入：{input_json}
"#
    )
}

fn report_length_instruction(value: &str) -> &'static str {
    match value {
        "brief" => {
            "报告详略：精简。summary 1 句话；highlights 2-3 条；completedItems 2-3 条；problems 最多 1 句话；nextWeekPlan 最多 1 句话；markdown 控制在 250-450 字。不要为了凑结构强行扩写，合并相近事项。"
        }
        "detailed" => {
            "报告详略：详细。summary 2-3 句话；highlights 4-6 条；completedItems 5-8 条；problems 和 nextWeekPlan 可以适度展开；markdown 控制在 800-1200 字。"
        }
        _ => {
            "报告详略：标准。summary 1-2 句话；highlights 3-5 条；completedItems 3-6 条；problems 和 nextWeekPlan 各 1 段；markdown 控制在 500-800 字。"
        }
    }
}

fn report_single_memory_instruction(input: &GenerateRangeReportInput) -> &'static str {
    if input.report_length == "brief" && input.memories.len() == 1 {
        return "当前只有 1 条工作记忆，整体进一步压缩：highlights 最多 2 条，completedItems 最多 2 条，problems 和 nextWeekPlan 只保留必要内容，不要把同一条记忆拆成过多项目。";
    }

    "如果可用工作记忆较少，不要为了篇幅扩写或重复表达。"
}

fn report_tone_instruction(value: &str) -> &'static str {
    match value {
        "formal" => "报告语气：正式。适合发给上级或团队，表达更规范，但不要官样化。",
        "retrospective" => "报告语气：复盘型。更关注阶段进展、问题和下一步计划，但不要编造反思。",
        _ => "报告语气：自然。表达自然、清楚，像轻量工作回顾，不要过度正式。",
    }
}

fn report_focus_instruction(value: &str) -> &'static str {
    match value {
        "completed-items" => "报告重点：完成事项优先。优先突出本周完成的具体事项。",
        "risks" => "报告重点：问题风险优先。优先突出问题、风险、阻塞和后续跟进。",
        _ => "报告重点：关键产出优先。优先突出关键产出和阶段性进展。",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weekly_report_prompt_includes_brief_length_rules() {
        let input = weekly_input("brief", "natural", "outcomes");

        let prompt = build_codex_weekly_report_prompt(&input);

        assert!(prompt.contains("报告详略：精简"));
        assert!(prompt.contains("markdown 控制在 250-450 字"));
        assert!(prompt.contains("highlights 2-3 条"));
        assert!(prompt.contains("只有 1 条工作记忆"));
        assert!(prompt.contains("highlights 最多 2 条"));
    }

    #[test]
    fn weekly_report_prompt_includes_tone_and_focus_rules() {
        let input = weekly_input("detailed", "retrospective", "risks");

        let prompt = build_codex_weekly_report_prompt(&input);

        assert!(prompt.contains("报告语气：复盘型"));
        assert!(prompt.contains("报告重点：问题风险优先"));
        assert!(prompt.contains("不要编造反思"));
    }

    #[test]
    fn custom_report_prompt_includes_range_type_and_preferences() {
        let mut input =
            weekly_input("brief", "formal", "completed-items").into_range_report_input();
        input.report_type = "custom".to_string();
        input.end_date = "2026-06-03".to_string();

        let prompt = build_codex_range_report_prompt(&input);

        assert!(prompt.contains("自定义范围工作总结"));
        assert!(prompt.contains("2026年6月1日-6月7日工作总结"));
        assert!(prompt.contains("报告语气：正式"));
        assert!(prompt.contains("报告重点：完成事项优先"));
        assert!(prompt.contains("\"reportType\":\"custom\""));
    }

    #[test]
    fn normalize_codex_model_uses_fast_default_for_empty_input() {
        assert_eq!(normalize_codex_model(""), "gpt-5.4-mini");
        assert_eq!(normalize_codex_model("  gpt-5.5  "), "gpt-5.5");
    }

    #[test]
    fn command_candidates_reject_empty_commands() {
        assert!(get_command_candidates("   ").is_err());
    }

    #[test]
    fn command_candidates_are_cross_platform_safe() {
        let candidates = get_command_candidates("codex").expect("codex command candidates");

        #[cfg(target_os = "windows")]
        assert_eq!(candidates, vec!["codex", "codex.cmd", "codex.exe"]);

        #[cfg(not(target_os = "windows"))]
        assert_eq!(candidates, vec!["codex"]);
    }

    #[test]
    fn parse_daily_memory_rejects_empty_and_invalid_json_without_running_codex() {
        let input = GenerateDailyMemoryInput {
            date: "2026-06-08".to_string(),
            raw_content: "work note".to_string(),
            supplements: None,
        };

        assert!(parse_generated_daily_memory("", &input).is_err());
        assert!(parse_generated_daily_memory("not json", &input).is_err());
    }

    #[test]
    fn parse_range_report_rejects_empty_and_invalid_json_without_running_codex() {
        let input = weekly_input("standard", "natural", "outcomes").into_range_report_input();

        assert!(parse_generated_range_report("", &input).is_err());
        assert!(parse_generated_range_report("not json", &input).is_err());
    }

    #[test]
    fn normalize_report_text_collapses_extra_blank_lines() {
        let normalized = normalize_report_text("# Title\n\n\n## Summary\n\nText\n\n\n- A");

        assert_eq!(normalized, "# Title\n\n## Summary\n\nText\n\n- A");
    }

    fn weekly_input(
        report_length: &str,
        report_tone: &str,
        report_focus: &str,
    ) -> GenerateWeeklyReportInput {
        GenerateWeeklyReportInput {
            start_date: "2026-06-01".to_string(),
            end_date: "2026-06-07".to_string(),
            report_length: report_length.to_string(),
            report_tone: report_tone.to_string(),
            report_focus: report_focus.to_string(),
            memories: vec![DailyMemoryForReport {
                id: "daily-memory-2026-06-01".to_string(),
                date: "2026-06-01".to_string(),
                raw_content: "完成 SQLite 迁移。".to_string(),
                supplements: DailyMemorySupplements {
                    project_topic: None,
                    tomorrow_plan: Some("继续整理报告能力。".to_string()),
                    extra_note: None,
                },
                generated: Some(GeneratedDailyMemory {
                    summary: "完成 SQLite 迁移。".to_string(),
                    completed_items: vec!["迁移本地存储".to_string()],
                    key_outcome: None,
                    problems: None,
                    tomorrow_plan: Some("继续整理报告能力。".to_string()),
                    extra_note: None,
                    daily_report_text: None,
                }),
                status: "generated".to_string(),
                created_at: "2026-06-01T01:00:00.000Z".to_string(),
                updated_at: "2026-06-01T02:00:00.000Z".to_string(),
            }],
        }
    }
}

fn create_codex_output_path(output_kind: &str) -> std::path::PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let output_dir = get_tallya_codex_dir();
    let _ = fs::create_dir_all(&output_dir);

    output_dir.join(format!(
        "tallya-codex-{output_kind}-{}-{timestamp}.json",
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
        daily_report_text: normalize_optional_string(generated.daily_report_text),
    })
}

fn parse_generated_range_report(
    raw_output: &str,
    input: &GenerateRangeReportInput,
) -> Result<GeneratedReportContent, String> {
    let raw_output = raw_output.trim();

    if raw_output.is_empty() {
        return Err("AI 没有返回有效报告内容，请重试。".to_string());
    }

    let parsed = serde_json::from_str::<GeneratedReportContent>(raw_output).map_err(|error| {
        eprintln!("Codex weekly report output is not valid JSON: {error}");
        "AI 返回内容不是合法 JSON，请重试。".to_string()
    })?;

    normalize_generated_range_report(parsed, input)
}

fn normalize_generated_range_report(
    generated: GeneratedReportContent,
    input: &GenerateRangeReportInput,
) -> Result<GeneratedReportContent, String> {
    let title = if generated.title.trim().is_empty() {
        default_report_title(input)
    } else {
        generated.title.trim().to_string()
    };
    let summary = generated.summary.trim().to_string();
    let highlights = normalize_string_list(generated.highlights, Some(5));
    let completed_items = normalize_string_list(generated.completed_items, None);
    let problems = normalize_optional_string(generated.problems);
    let next_week_plan = normalize_optional_string(generated.next_week_plan);
    let mut report = GeneratedReportContent {
        title,
        summary,
        highlights,
        completed_items,
        problems,
        next_week_plan,
        markdown: normalize_report_text(&generated.markdown),
    };

    if report.markdown.is_empty() {
        report.markdown = build_range_report_markdown(&report, input);
    }

    if report.summary.is_empty()
        && report.highlights.is_empty()
        && report.completed_items.is_empty()
        && report.markdown.trim().is_empty()
    {
        return Err("AI 没有返回有效报告内容，请重试。".to_string());
    }

    Ok(report)
}

fn normalize_string_list(values: Vec<String>, limit: Option<usize>) -> Vec<String> {
    let values = values
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty());

    match limit {
        Some(limit) => values.take(limit).collect(),
        None => values.collect(),
    }
}

fn build_range_report_markdown(
    report: &GeneratedReportContent,
    input: &GenerateRangeReportInput,
) -> String {
    let mut sections = vec![
        format!("# {}", report.title),
        String::new(),
        format!("时间范围：{} - {}", input.start_date, input.end_date),
    ];

    if !report.summary.is_empty() {
        sections.push(String::new());
        sections.push("## 总结".to_string());
        sections.push(report.summary.clone());
    }

    push_markdown_list(&mut sections, "本周重点", &report.highlights);
    push_markdown_list(&mut sections, "完成事项", &report.completed_items);

    if let Some(problems) = &report.problems {
        sections.push(String::new());
        sections.push("## 问题与风险".to_string());
        sections.push(problems.clone());
    }

    if let Some(next_week_plan) = &report.next_week_plan {
        sections.push(String::new());
        sections.push(if input.report_type == "custom" {
            "## 下一步计划".to_string()
        } else {
            "## 下周计划".to_string()
        });
        sections.push(next_week_plan.clone());
    }

    sections.join("\n")
}

fn default_report_title(input: &GenerateRangeReportInput) -> String {
    if input.report_type == "custom" {
        return format!("{}-{}工作总结", input.start_date, input.end_date);
    }

    "本周周报".to_string()
}

fn normalize_report_text(text: &str) -> String {
    let mut output = String::new();
    let mut blank_lines = 0;

    for line in text.replace("\r\n", "\n").lines() {
        let trimmed_line = line.trim_end();

        if trimmed_line.trim().is_empty() {
            blank_lines += 1;

            if blank_lines <= 1 && !output.is_empty() {
                output.push('\n');
            }

            continue;
        }

        if !output.is_empty() {
            output.push('\n');
        }

        output.push_str(trimmed_line);
        blank_lines = 0;
    }

    output.trim().to_string()
}

fn push_markdown_list(sections: &mut Vec<String>, title: &str, items: &[String]) {
    if items.is_empty() {
        return;
    }

    sections.push(String::new());
    sections.push(format!("## {title}"));
    sections.extend(items.iter().map(|item| format!("- {item}")));
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            generate_range_report_with_codex,
            generate_weekly_report_with_codex,
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
