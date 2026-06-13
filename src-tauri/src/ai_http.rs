use std::{net::IpAddr, time::Duration};

use reqwest::header::{HeaderName, HeaderValue, ACCEPT, CONTENT_TYPE};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiCompatibleHttpResponse {
    pub status: u16,
    pub content_type: String,
    pub body_text: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpHeader {
    pub name: String,
    pub value: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayProbeResult {
    reachable: bool,
    detail: Option<String>,
}

#[tauri::command]
pub async fn send_openai_compatible_request(
    url: String,
    api_key: String,
    body_text: String,
    timeout_ms: u64,
) -> Result<OpenAiCompatibleHttpResponse, String> {
    let mut headers = Vec::new();

    if !api_key.trim().is_empty() {
        headers.push(AiHttpHeader {
            name: "authorization".to_string(),
            value: format!("Bearer {}", api_key.trim()),
        });
    }

    send_ai_http_request(url, body_text, timeout_ms, headers).await
}

#[tauri::command]
pub async fn send_ai_http_request(
    url: String,
    body_text: String,
    timeout_ms: u64,
    headers: Vec<AiHttpHeader>,
) -> Result<OpenAiCompatibleHttpResponse, String> {
    let url = reqwest::Url::parse(&url).map_err(|error| {
        eprintln!("Invalid AI HTTP URL: {error}");
        "服务地址不正确。".to_string()
    })?;

    match url.scheme() {
        "http" | "https" => {}
        _ => return Err("服务地址只支持 http 或 https。".to_string()),
    }

    let client = openai_compatible_http_client_builder(
        &url,
        Duration::from_millis(timeout_ms.clamp(1_000, 120_000)),
    )
    .build()
    .map_err(|error| {
        eprintln!("Failed to build AI HTTP client: {error}");
        "无法连接到 AI 服务，请检查服务地址或网络。".to_string()
    })?;

    let mut request = client
        .post(url)
        .header(CONTENT_TYPE, "application/json")
        .body(body_text);

    for header in headers {
        let name = HeaderName::from_bytes(header.name.trim().as_bytes()).map_err(|error| {
            eprintln!("Invalid AI HTTP header name: {error}");
            "AI 请求头不正确。".to_string()
        })?;
        let value = HeaderValue::from_str(header.value.trim()).map_err(|error| {
            eprintln!("Invalid AI HTTP header value: {error}");
            "AI 请求头不正确。".to_string()
        })?;

        request = request.header(name, value);
    }

    let response = request.send().await.map_err(|error| {
        eprintln!("AI HTTP request failed: {error}");
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
        eprintln!("Failed to read AI HTTP response body: {error}");
        "AI 服务响应读取失败，请稍后重试。".to_string()
    })?;

    Ok(OpenAiCompatibleHttpResponse {
        status,
        content_type,
        body_text,
    })
}

#[tauri::command]
pub async fn probe_openai_compatible_gateway(
    url: String,
    timeout_ms: u64,
) -> Result<GatewayProbeResult, String> {
    let url = match reqwest::Url::parse(&url) {
        Ok(url) => url,
        Err(error) => {
            eprintln!("Invalid OpenAI compatible gateway probe URL: {error}");
            return Ok(unreachable_probe("网关地址不正确"));
        }
    };

    match url.scheme() {
        "http" | "https" => {}
        _ => return Ok(unreachable_probe("服务地址只支持 http 或 https")),
    }

    let client = openai_compatible_http_client_builder(
        &url,
        Duration::from_millis(timeout_ms.clamp(500, 15_000)),
    )
    .build()
    .map_err(|error| {
        eprintln!("Failed to build AI gateway probe HTTP client: {error}");
        "无法连接到 AI 服务，请检查服务地址或网络。".to_string()
    })?;

    let response = match client
        .get(url)
        .header(ACCEPT, "application/json")
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            eprintln!("OpenAI compatible gateway probe failed: {error}");
            let detail = if error.is_timeout() {
                "检测超时"
            } else {
                "无法连接"
            };

            return Ok(unreachable_probe(detail));
        }
    };

    let status = response.status();
    if !status.is_success() {
        return Ok(unreachable_probe(format!("HTTP {}", status.as_u16())));
    }

    let body_text = response.text().await.map_err(|error| {
        eprintln!("Failed to read OpenAI compatible gateway probe response body: {error}");
        "AI 服务响应读取失败，请稍后重试。".to_string()
    })?;

    if serde_json::from_str::<serde_json::Value>(&body_text).is_err() {
        return Ok(unreachable_probe("响应不是 JSON"));
    }

    Ok(GatewayProbeResult {
        reachable: true,
        detail: None,
    })
}

fn unreachable_probe(detail: impl Into<String>) -> GatewayProbeResult {
    GatewayProbeResult {
        reachable: false,
        detail: Some(detail.into()),
    }
}

fn openai_compatible_http_client_builder(
    url: &reqwest::Url,
    timeout: Duration,
) -> reqwest::ClientBuilder {
    let builder = reqwest::Client::builder().timeout(timeout);

    if is_loopback_url(url) {
        builder.no_proxy()
    } else {
        builder
    }
}

fn is_loopback_url(url: &reqwest::Url) -> bool {
    match url.host_str() {
        Some(host) if host.eq_ignore_ascii_case("localhost") => true,
        Some(host) => host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback()),
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };

    #[test]
    fn probe_gateway_accepts_successful_json_response() {
        let url = serve_once(
            "HTTP/1.1 200 OK",
            "application/json",
            r#"{"data":[{"id":"gpt-test"}]}"#,
        );

        let result = tauri::async_runtime::block_on(probe_openai_compatible_gateway(url, 1_500))
            .expect("probe result");

        assert!(result.reachable);
        assert_eq!(result.detail, None);
    }

    #[test]
    fn probe_gateway_rejects_non_json_response() {
        let url = serve_once("HTTP/1.1 200 OK", "text/plain", "ok");

        let result = tauri::async_runtime::block_on(probe_openai_compatible_gateway(url, 1_500))
            .expect("probe result");

        assert!(!result.reachable);
        assert_eq!(result.detail.as_deref(), Some("响应不是 JSON"));
    }

    #[test]
    fn send_ai_http_request_forwards_custom_headers() {
        let (url, received_request) =
            serve_once_with_capture("HTTP/1.1 200 OK", "application/json", r#"{"ok":true}"#);

        let result = tauri::async_runtime::block_on(send_ai_http_request(
            url,
            r#"{"ping":true}"#.to_string(),
            1_500,
            vec![
                AiHttpHeader {
                    name: "x-api-key".to_string(),
                    value: "test-key".to_string(),
                },
                AiHttpHeader {
                    name: "anthropic-version".to_string(),
                    value: "2023-06-01".to_string(),
                },
            ],
        ))
        .expect("http response");

        assert_eq!(result.status, 200);
        let request = received_request.recv().expect("captured request");
        assert!(request.contains("x-api-key: test-key"));
        assert!(request.contains("anthropic-version: 2023-06-01"));
    }

    fn serve_once(
        status_line: &'static str,
        content_type: &'static str,
        body: &'static str,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        let addr = listener.local_addr().expect("server addr");

        thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept request");
            let mut buffer = [0_u8; 1024];
            let _ = stream.read(&mut buffer);
            let response = format!(
                "{status_line}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );

            stream
                .write_all(response.as_bytes())
                .expect("write response");
        });

        format!("http://{addr}/v1/models")
    }

    fn serve_once_with_capture(
        status_line: &'static str,
        content_type: &'static str,
        body: &'static str,
    ) -> (String, std::sync::mpsc::Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        let addr = listener.local_addr().expect("server addr");
        let (sender, receiver) = std::sync::mpsc::channel();

        thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept request");
            let mut buffer = [0_u8; 4096];
            let bytes_read = stream.read(&mut buffer).expect("read request");
            sender
                .send(String::from_utf8_lossy(&buffer[..bytes_read]).to_string())
                .expect("send captured request");
            let response = format!(
                "{status_line}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );

            stream
                .write_all(response.as_bytes())
                .expect("write response");
        });

        (format!("http://{addr}/v1/messages"), receiver)
    }
}
