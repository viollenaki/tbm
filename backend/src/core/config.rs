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
    /// Copies `.env.example` to `.env` in the current working directory when
    /// `.env` is missing, so a fresh checkout works with `cargo run` out of the box.
    /// Silently does nothing if the example file is absent (e.g. inside containers).
    fn bootstrap_env_file() {
        let env_path = std::path::Path::new(".env");
        let example_path = std::path::Path::new(".env.example");
        if !env_path.exists() && example_path.exists() {
            match std::fs::copy(example_path, env_path) {
                Ok(_) => eprintln!("Created .env from .env.example"),
                Err(e) => eprintln!("Failed to create .env from .env.example: {e}"),
            }
        }
    }

    pub fn from_env() -> Self {
        Self::bootstrap_env_file();
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
