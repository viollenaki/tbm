use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use super::{
    schemas::{ActivateVoucherRequest, ActivationDto, ActivationHistoryItemDto},
    service::ActivationService,
};
use crate::core::{
    error::{AppError, ErrorResponse},
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/v1/users/{user_id}/activations",
    tag = "Activations",
    params(
        ("user_id" = Uuid, Path, description = "User UUID")
    ),
    responses(
        (status = 200, description = "User activation history (newest first)", body = Vec<ActivationHistoryItemDto>),
        (status = 404, description = "User not found", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn get_user_activations(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<ActivationHistoryItemDto>>, AppError> {
    let history = ActivationService::get_user_activations(&state.pool, user_id).await?;
    Ok(Json(history))
}

#[utoipa::path(
    post,
    path = "/api/v1/users/{user_id}/activations",
    tag = "Activations",
    params(
        ("user_id" = Uuid, Path, description = "User UUID")
    ),
    request_body = ActivateVoucherRequest,
    responses(
        (status = 200, description = "Voucher activated successfully", body = ActivationDto),
        (status = 404, description = "User or product not found", body = ErrorResponse),
        (status = 409, description = "No vouchers left for this product", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn activate_voucher(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(payload): Json<ActivateVoucherRequest>,
) -> Result<Json<ActivationDto>, AppError> {
    let activation =
        ActivationService::activate_voucher(&state.pool, user_id, payload.product_id).await?;
    Ok(Json(activation))
}
