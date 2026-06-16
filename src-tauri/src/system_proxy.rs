// Single source of truth for the OS proxy, so every HTTP client in the app takes
// the same route other apps/the browser use. Windows: the WinINET system proxy
// (registry). Other platforms: None — reqwest falls back to HTTP(S)_PROXY env vars.
pub fn system_proxy_url() -> Option<String> {
    read_system_proxy()
}

// Applies the system proxy to a reqwest client builder when one is set. Callers
// must bypass loopback themselves (local gateways should never be proxied).
pub fn apply_system_proxy(builder: reqwest::ClientBuilder) -> reqwest::ClientBuilder {
    match system_proxy_url().and_then(|url| reqwest::Proxy::all(url).ok()) {
        Some(proxy) => builder.proxy(proxy),
        None => builder,
    }
}

#[cfg(target_os = "windows")]
fn read_system_proxy() -> Option<String> {
    let key = windows_registry::CURRENT_USER
        .open(r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
        .ok()?;

    if key.get_u32("ProxyEnable").unwrap_or(0) == 0 {
        return None;
    }

    normalize_proxy_server(&key.get_string("ProxyServer").ok()?)
}

#[cfg(not(target_os = "windows"))]
fn read_system_proxy() -> Option<String> {
    None
}

// ProxyServer is either a single "host:port" (all protocols) or a per-protocol
// list "http=host:port;https=host:port;socks=...". Prefer https, then http.
#[cfg(target_os = "windows")]
fn normalize_proxy_server(server: &str) -> Option<String> {
    let trimmed = server.trim();

    if trimmed.is_empty() {
        return None;
    }

    if trimmed.contains('=') {
        let mut http_proxy = None;

        for part in trimmed.split(';') {
            if let Some((scheme, value)) = part.split_once('=') {
                match scheme.trim().to_ascii_lowercase().as_str() {
                    "https" => return Some(ensure_proxy_scheme(value.trim())),
                    "http" => http_proxy = Some(ensure_proxy_scheme(value.trim())),
                    _ => {}
                }
            }
        }

        return http_proxy;
    }

    Some(ensure_proxy_scheme(trimmed))
}

#[cfg(target_os = "windows")]
fn ensure_proxy_scheme(value: &str) -> String {
    if value.contains("://") {
        value.to_string()
    } else {
        format!("http://{value}")
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::normalize_proxy_server;

    #[test]
    fn parses_single_proxy() {
        assert_eq!(
            normalize_proxy_server("127.0.0.1:7890").as_deref(),
            Some("http://127.0.0.1:7890"),
        );
    }

    #[test]
    fn prefers_https_in_per_protocol_list() {
        assert_eq!(
            normalize_proxy_server("http=127.0.0.1:7890;https=127.0.0.1:7891").as_deref(),
            Some("http://127.0.0.1:7891"),
        );
    }

    #[test]
    fn falls_back_to_http_when_no_https() {
        assert_eq!(
            normalize_proxy_server("ftp=127.0.0.1:21;http=127.0.0.1:7890").as_deref(),
            Some("http://127.0.0.1:7890"),
        );
    }

    #[test]
    fn keeps_explicit_scheme() {
        assert_eq!(
            normalize_proxy_server("socks5://127.0.0.1:1080").as_deref(),
            Some("socks5://127.0.0.1:1080"),
        );
    }

    #[test]
    fn empty_is_none() {
        assert_eq!(normalize_proxy_server("   "), None);
    }
}
