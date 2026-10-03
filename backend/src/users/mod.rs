pub mod handlers;
pub mod models;
pub mod repository;
pub mod schemas;
pub mod service;

use crate::core::state::AppState;
use axum::{routing::get, Router};

pub fn router() -> Router<AppState> {
    Router::new().route("/users", get(handlers::list_users))
}
