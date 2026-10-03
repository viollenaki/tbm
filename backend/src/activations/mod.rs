pub mod handlers;
pub mod models;
pub mod repository;
pub mod schemas;
pub mod service;

use crate::core::state::AppState;
use axum::{
    routing::{get, post},
    Router,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/users/{user_id}/activations",
            get(handlers::get_user_activations),
        )
        .route(
            "/users/{user_id}/activations",
            post(handlers::activate_voucher),
        )
}
