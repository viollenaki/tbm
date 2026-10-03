use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use super::{schemas::VoucherBalanceDto, service::VoucherService};
use crate::core::{
    error::{AppError, ErrorResponse},
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/v1/users/{user_id}/balances",
    tag = "Vouchers",
    params(
        ("user_id" = Uuid, Path, description = "User UUID")
    ),
    responses(
        (status = 200, description = "User voucher balances across all products", body = Vec<VoucherBalanceDto>),
        (status = 404, description = "User not found", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn get_user_balances(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<VoucherBalanceDto>>, AppError> {
    let balances = VoucherService::get_user_balances(&state.pool, user_id).await?;
    Ok(Json(balances))
}
