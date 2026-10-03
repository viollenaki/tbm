use std::net::SocketAddr;
use utoipa::OpenApi;

use backend_lib::{
    api,
    core::{
        config::Config,
        db::{create_pool, run_migrations},
        openapi::ApiDoc,
        state::AppState,
    },
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // CLI flag to output OpenAPI schema without database connection
    if std::env::args().any(|arg| arg == "--print-openapi") {
        let spec = ApiDoc::openapi().to_pretty_json()?;
        println!("{spec}");
        return Ok(());
    }

    let config = Config::from_env();

    tracing_subscriber::fmt()
        .with_env_filter(&config.rust_log)
        .init();

    tracing::info!(
        "Starting Voucher Service backend on {}:{}",
        config.host,
        config.port
    );

    let pool = create_pool(&config.database_url).await?;
    run_migrations(&pool).await?;

    let rate_limiter = std::sync::Arc::new(backend_lib::core::rate_limit::RateLimiter::new(
        backend_lib::core::rate_limit::RateLimiterConfig {
            enabled: config.rate_limit_enabled,
            requests_per_minute: config.rate_limit_requests_per_minute,
            burst_capacity: config.rate_limit_burst,
        },
    ));

    let limiter_cleaner = rate_limiter.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            limiter_cleaner.cleanup(std::time::Duration::from_secs(600));
        }
    });

    let state = AppState::with_limiter(pool, rate_limiter);
    let app = api::create_router(state);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Swagger UI available at http://{}/swagger-ui", addr);
    tracing::info!(
        "OpenAPI spec available at http://{}/api-docs/openapi.json",
        addr
    );

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server stopped gracefully.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C, starting shutdown...");
        },
        _ = terminate => {
            tracing::info!("Received SIGTERM, starting shutdown...");
        },
    }
}
