use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "windows")]
const CODEX_CLI_COMMANDS: &[&str] = &["codex.cmd", "codex.exe", "codex"];

#[cfg(not(target_os = "windows"))]
const CODEX_CLI_COMMANDS: &[&str] = &["codex"];

const CODEX_CLI_TIMEOUT: Duration = Duration::from_secs(60);

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
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn generate_daily_memory_with_codex(
    input: GenerateDailyMemoryInput,
) -> Result<GeneratedDailyMemory, String> {
    tauri::async_runtime::spawn_blocking(move || run_codex_daily_memory_generation(input))
        .await
        .map_err(|error| {
            eprintln!("Codex task join failed: {error}");
            "Codex 生成失败，请检查 Codex CLI 是否可用。".to_string()
        })?
}

fn run_codex_daily_memory_generation(
    input: GenerateDailyMemoryInput,
) -> Result<GeneratedDailyMemory, String> {
    let prompt = build_codex_prompt(&input);
    let output_path = create_codex_output_path();
    let mut child = spawn_codex_cli(&output_path)?;

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

fn spawn_codex_cli(output_path: &std::path::Path) -> Result<std::process::Child, String> {
    let mut last_error = None;

    for command in CODEX_CLI_COMMANDS {
        match Command::new(command)
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

fn build_codex_prompt(input: &GenerateDailyMemoryInput) -> String {
    let input_json = serde_json::to_string(input).unwrap_or_else(|_| "{}".to_string());

    format!(
        r#"把输入整理为中文今日工作记忆。只输出合法 JSON，不要 markdown、解释、代码块或工具调用。
JSON keys: summary:string, completedItems:string[], keyOutcome?:string, problems?:string, tomorrowPlan?:string, extraNote?:string.
规则：不编造；只做轻度归纳和润色；未提及的可选字段用 "" 或省略。
completedItems：必须是字符串数组，控制在 3-5 条；合并相近事项；每条尽量是完整动作；不要把同一件事拆成过多细碎步骤。
keyOutcome：有明确可交付成果时直接提炼；没有明确成果但有多个完成事项时，保守总结一个阶段性产出；不要虚构业务结果或夸大价值。输入很少且无法判断时才留空。
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            generate_daily_memory_with_codex
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
