use axum::{
    http::{header, Method},
    response::Json,
    routing::get,
    Router,
};
use serde_json::{json, Value};
use tower_http::cors::CorsLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    activations, admin,
    core::{openapi::ApiDoc, state::AppState},
    products, users, vouchers,
};

#[utoipa::path(
    get,
    path = "/api/v1/health",
    tag = "Health",
    responses(
        (status = 200, description = "Service health check", body = Value, example = json!({"status": "ok"}))
    )
)]
pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
            header::ORIGIN,
        ]);

    let openapi_spec = ApiDoc::openapi();

    let api_v1 = Router::new()
        .route("/health", get(health_check))
        .merge(users::router())
        .merge(products::router())
        .merge(vouchers::router())
        .merge(activations::router())
        .merge(admin::router());

    Router::new()
        .route("/health", get(health_check))
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", openapi_spec))
        .nest("/api/v1", api_v1)
        .layer(cors)
        .with_state(state)
}
