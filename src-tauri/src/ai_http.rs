use std::time::Duration;

use reqwest::header::CONTENT_TYPE;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiCompatibleHttpResponse {
    status: u16,
    content_type: String,
    body_text: String,
}

#[tauri::command]
pub async fn send_openai_compatible_request(
    url: String,
    api_key: String,
    body_text: String,
    timeout_ms: u64,
) -> Result<OpenAiCompatibleHttpResponse, String> {
    let url = reqwest::Url::parse(&url).map_err(|error| {
        eprintln!("Invalid OpenAI compatible URL: {error}");
        "服务地址不正确。".to_string()
    })?;

    match url.scheme() {
        "http" | "https" => {}
        _ => return Err("服务地址只支持 http 或 https。".to_string()),
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms.clamp(1_000, 120_000)))
        .build()
        .map_err(|error| {
            eprintln!("Failed to build AI HTTP client: {error}");
            "无法连接到 AI 服务，请检查服务地址或网络。".to_string()
        })?;

    let mut request = client
        .post(url)
        .header(CONTENT_TYPE, "application/json")
        .body(body_text);

    if !api_key.trim().is_empty() {
        request = request.bearer_auth(api_key);
    }

    let response = request.send().await.map_err(|error| {
        eprintln!("OpenAI compatible HTTP request failed: {error}");
        if error.is_timeout() {
            "AI 服务响应超时，请检查网关或稍后再试。".to_string()
        } else {
            "无法连接到 AI 服务，请检查服务地址或网络。".to_string()
        }
    })?;

    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body_text = response.text().await.map_err(|error| {
        eprintln!("Failed to read OpenAI compatible HTTP response body: {error}");
        "AI 服务响应读取失败，请稍后重试。".to_string()
    })?;

    Ok(OpenAiCompatibleHttpResponse {
        status,
        content_type,
        body_text,
    })
}
