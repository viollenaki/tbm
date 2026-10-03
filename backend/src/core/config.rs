use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub host: String,
    pub port: u16,
    pub rust_log: String,
    pub rate_limit_enabled: bool,
    pub rate_limit_requests_per_minute: u32,
    pub rate_limit_burst: u32,
}

impl Config {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:postgres@localhost:5432/tbm_vouchers".to_string()
        });

        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

        let port = env::var("PORT")
            .or_else(|_| env::var("BACKEND_PORT"))
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(8080);

        let rust_log = env::var("RUST_LOG").unwrap_or_else(|_| "info,backend=debug".to_string());

        let rate_limit_enabled = env::var("RATE_LIMIT_ENABLED")
            .map(|v| v != "false" && v != "0")
            .unwrap_or(true);

        let rate_limit_requests_per_minute = env::var("RATE_LIMIT_PER_MINUTE")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(60);

        let rate_limit_burst = env::var("RATE_LIMIT_BURST")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(30);

        Self {
            database_url,
            host,
            port,
            rust_log,
            rate_limit_enabled,
            rate_limit_requests_per_minute,
            rate_limit_burst,
        }
    }
}
