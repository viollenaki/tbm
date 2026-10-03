use std::{
    collections::HashMap,
    net::IpAddr,
    sync::Mutex,
    time::{Duration, Instant},
};

use axum::{
    extract::{Request, State},
    http::{header, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use tracing::warn;

use crate::core::{error::ErrorResponse, state::AppState};

/// Configuration parameters for the in-memory token-bucket rate limiter.
#[derive(Debug, Clone)]
pub struct RateLimiterConfig {
    pub enabled: bool,
    pub requests_per_minute: u32,
    pub burst_capacity: u32,
}

impl Default for RateLimiterConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            requests_per_minute: 60,
            burst_capacity: 30,
        }
    }
}

/// Token-bucket state per IP address.
struct ClientBucket {
    tokens: f64,
    last_update: Instant,
}

/// Thread-safe in-memory IP rate limiter using the Token Bucket algorithm.
pub struct RateLimiter {
    config: RateLimiterConfig,
    buckets: Mutex<HashMap<IpAddr, ClientBucket>>,
}

impl RateLimiter {
    pub fn new(config: RateLimiterConfig) -> Self {
        Self {
            config,
            buckets: Mutex::new(HashMap::new()),
        }
    }

    pub fn disabled() -> Self {
        Self::new(RateLimiterConfig {
            enabled: false,
            requests_per_minute: 60,
            burst_capacity: 30,
        })
    }

    /// Evaluates if the IP is allowed to proceed.
    /// Returns `Ok(())` if allowed, or `Err(retry_after_seconds)` if rate limit exceeded.
    pub fn check(&self, ip: IpAddr) -> Result<(), u64> {
        if !self.config.enabled {
            return Ok(());
        }

        let mut buckets = match self.buckets.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };

        let now = Instant::now();
        let capacity = self.config.burst_capacity as f64;
        let refill_rate = (self.config.requests_per_minute as f64) / 60.0; // tokens per second

        let bucket = buckets.entry(ip).or_insert_with(|| ClientBucket {
            tokens: capacity,
            last_update: now,
        });

        let elapsed = now.duration_since(bucket.last_update).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * refill_rate).min(capacity);
        bucket.last_update = now;

        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            Ok(())
        } else {
            let needed = 1.0 - bucket.tokens;
            let retry_after_sec = (needed / refill_rate).ceil() as u64;
            Err(retry_after_sec.max(1))
        }
    }

    /// Periodically cleans up inactive IP entries to prevent memory leaks.
    pub fn cleanup(&self, max_idle: Duration) {
        let mut buckets = match self.buckets.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };

        let now = Instant::now();
        buckets.retain(|_, bucket| now.duration_since(bucket.last_update) < max_idle);
    }
}

/// Extracts client IP address from proxy headers (X-Forwarded-For, X-Real-IP)
/// or falls back to localhost if not behind a proxy.
fn extract_client_ip(req: &Request) -> IpAddr {
    // 1. Check X-Forwarded-For (standard reverse-proxy client IP header)
    if let Some(forwarded) = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
    {
        if let Some(first_ip) = forwarded.split(',').next() {
            if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                return ip;
            }
        }
    }

    // 2. Check X-Real-IP
    if let Some(real_ip) = req.headers().get("x-real-ip").and_then(|h| h.to_str().ok()) {
        if let Ok(ip) = real_ip.trim().parse::<IpAddr>() {
            return ip;
        }
    }

    // 3. Fallback localhost IP for direct local invocations
    IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1))
}

/// Identifies paths that are exempt from rate limiting (health probes and documentation).
fn is_exempt_path(path: &str) -> bool {
    path == "/health"
        || path == "/api/v1/health"
        || path.starts_with("/swagger-ui")
        || path.starts_with("/api-docs")
}

/// Axum middleware function that enforces IP-based rate limiting on incoming HTTP requests.
pub async fn rate_limit_middleware(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    if is_exempt_path(req.uri().path()) {
        return next.run(req).await;
    }

    let ip = extract_client_ip(&req);

    match state.rate_limiter.check(ip) {
        Ok(()) => next.run(req).await,
        Err(retry_after) => {
            warn!(
                client_ip = %ip,
                path = %req.uri().path(),
                retry_after_sec = retry_after,
                "Rate limit exceeded"
            );

            let body = Json(ErrorResponse {
                code: "RATE_LIMIT_EXCEEDED".to_string(),
                message: format!(
                    "Превышен лимит запросов. Пожалуйста, повторите попытку через {} сек.",
                    retry_after
                ),
            });

            let mut response = (StatusCode::TOO_MANY_REQUESTS, body).into_response();
            if let Ok(header_val) = HeaderValue::from_str(&retry_after.to_string()) {
                response
                    .headers_mut()
                    .insert(header::RETRY_AFTER, header_val);
            }
            response
        }
    }
}
