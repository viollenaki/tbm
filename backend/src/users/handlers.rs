use axum::{extract::State, Json};

use super::{schemas::UserDto, service::UserService};
use crate::core::{
    error::{AppError, ErrorResponse},
    state::AppState,
};

#[utoipa::path(
    get,
    path = "/api/v1/users",
    tag = "Users",
    responses(
        (status = 200, description = "List of all users", body = Vec<UserDto>),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn list_users(State(state): State<AppState>) -> Result<Json<Vec<UserDto>>, AppError> {
    let users = UserService::list_users(&state.pool).await?;
    Ok(Json(users))
}
