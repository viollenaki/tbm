use sqlx::PgPool;
use std::sync::Arc;

use crate::core::rate_limit::{RateLimiter, RateLimiterConfig};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub rate_limiter: Arc<RateLimiter>,
}

impl AppState {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool,
            rate_limiter: Arc::new(RateLimiter::new(RateLimiterConfig::default())),
        }
    }

    pub fn with_limiter(pool: PgPool, rate_limiter: Arc<RateLimiter>) -> Self {
        Self { pool, rate_limiter }
    }
}
