use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use super::{
    schemas::{SetBalanceRequest, SetBalanceResponse},
    service::AdminService,
};
use crate::core::{
    error::{AppError, ErrorResponse},
    state::AppState,
};

#[utoipa::path(
    put,
    path = "/api/v1/admin/users/{user_id}/balances/{product_id}",
    tag = "Admin",
    params(
        ("user_id" = Uuid, Path, description = "User UUID"),
        ("product_id" = Uuid, Path, description = "Product UUID")
    ),
    request_body = SetBalanceRequest,
    responses(
        (status = 200, description = "Voucher balance updated successfully", body = SetBalanceResponse),
        (status = 404, description = "User or product not found", body = ErrorResponse),
        (status = 422, description = "Validation error", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn set_voucher_balance(
    State(state): State<AppState>,
    Path((user_id, product_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<SetBalanceRequest>,
) -> Result<Json<SetBalanceResponse>, AppError> {
    let result =
        AdminService::set_balance(&state.pool, user_id, product_id, payload.quantity).await?;
    Ok(Json(result))
}
