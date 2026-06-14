use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProxyConfig {
    pub enabled: bool,
    pub proxy_type: String, // "socks5", "http", "none"
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub per_torrent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrivacySettings {
    pub proxy: ProxyConfig,
    pub killswitch_enabled: bool,
    pub rotate_peer_id: bool,
    pub blocklist_enabled: bool,
    pub blocklist_path: Option<String>,
    pub blocklist_count: usize,
}

pub struct Blocklist {
    // Blocked IPv4 ranges stored as (start, end) u32 pairs
    ranges: Vec<(u32, u32)>,
}

impl Blocklist {
    pub fn new() -> Self {
        Self { ranges: Vec::new() }
    }

    /// Load a PeerGuardian .p2p or .dat file
    pub fn load_from_file(path: &str) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let mut ranges = Vec::new();

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') { continue; }

            // P2P format: "description:start-end"
            let range_part = if let Some(colon) = line.rfind(':') {
                &line[colon + 1..]
            } else {
                line
            };

            if let Some((start_str, end_str)) = range_part.split_once('-') {
                let start = parse_ip(start_str.trim());
                let end = parse_ip(end_str.trim());
                if let (Some(s), Some(e)) = (start, end) {
                    ranges.push((s, e));
                }
            }
        }

        ranges.sort_unstable();
        Ok(Self { ranges })
    }

    pub fn is_blocked(&self, ip: &str) -> bool {
        if let Some(ip_u32) = parse_ip(ip) {
            return self.ranges.binary_search_by(|(start, end)| {
                if ip_u32 < *start { std::cmp::Ordering::Greater }
                else if ip_u32 > *end { std::cmp::Ordering::Less }
                else { std::cmp::Ordering::Equal }
            }).is_ok();
        }
        false
    }

    pub fn count(&self) -> usize {
        self.ranges.len()
    }
}

fn parse_ip(ip: &str) -> Option<u32> {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 { return None; }
    let octets: Option<Vec<u32>> = parts.iter().map(|p| p.parse::<u32>().ok()).collect();
    let octets = octets?;
    Some((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3])
}

/// Test if the current proxy connection is working by hitting an external IP check
pub async fn do_test_proxy(config: &ProxyConfig) -> Result<String> {
    if !config.enabled || config.host.is_empty() {
        // No proxy - return real IP
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?;
        let resp: serde_json::Value = client.get("https://api64.ipify.org?format=json")
            .send().await?.json().await?;
        return Ok(resp["ip"].as_str().unwrap_or("unknown").to_string());
    }

    let proxy_url = format!("{}://{}:{}", config.proxy_type, config.host, config.port);
    let mut proxy = reqwest::Proxy::all(&proxy_url)?;
    if let (Some(user), Some(pass)) = (&config.username, &config.password) {
        proxy = proxy.basic_auth(user, pass);
    }

    let client = reqwest::Client::builder()
        .proxy(proxy)
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    let resp: serde_json::Value = client
        .get("https://api64.ipify.org?format=json")
        .send().await?.json().await?;

    Ok(resp["ip"].as_str().unwrap_or("unknown").to_string())
}

/// Check for DNS leaks by comparing IPs from multiple endpoints
pub async fn check_ip_leak() -> Result<Vec<String>> {
    let endpoints = vec![
        "https://api64.ipify.org?format=json",
        "https://api.my-ip.io/v2/ip.json",
    ];

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let mut ips = Vec::new();
    for endpoint in endpoints {
        if let Ok(resp) = client.get(endpoint).send().await {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                let ip = json.get("ip")
                    .or_else(|| json.get("ip_address"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string();
                ips.push(ip);
            }
        }
    }

    Ok(ips)
}
