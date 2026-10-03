pub mod handlers;
pub mod models;
pub mod repository;
pub mod schemas;
pub mod service;

use crate::core::state::AppState;
use axum::{routing::put, Router};

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/admin/users/{user_id}/balances/{product_id}",
        put(handlers::set_voucher_balance),
    )
}
