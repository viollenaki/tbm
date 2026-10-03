use anyhow::Context;
use sqlx::{postgres::PgPoolOptions, PgPool};

pub async fn create_pool(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(database_url)
        .await
        .with_context(|| format!("Failed to connect to database at {database_url}"))?;

    Ok(pool)
}

pub async fn run_migrations(pool: &PgPool) -> anyhow::Result<()> {
    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .context("Failed to run database migrations")?;
    tracing::info!("Migrations applied successfully.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use sqlx::postgres::PgConnectOptions;
    use std::str::FromStr;

    #[test]
    fn test_cloudsql_socket_url_parsing() {
        let url = "postgres://postgres:dummy_test_password@localhost/tbm_vouchers?host=/cloudsql/project-id:region:instance";
        let opts = PgConnectOptions::from_str(url);
        assert!(opts.is_ok(), "Failed to parse: {:?}", opts.err());
    }
}
