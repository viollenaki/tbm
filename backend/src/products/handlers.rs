use axum::{extract::State, Json};

use super::{schemas::ProductDto, service::ProductService};
use crate::core::{
    error::{AppError, ErrorResponse},
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/v1/products",
    tag = "Products",
    responses(
        (status = 200, description = "List of all products", body = Vec<ProductDto>),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn list_products(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProductDto>>, AppError> {
    let products = ProductService::list_products(&state.pool).await?;
    Ok(Json(products))
}
