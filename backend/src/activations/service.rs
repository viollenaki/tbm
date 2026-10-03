use sqlx::PgPool;
use uuid::Uuid;

use super::{
    repository::ActivationRepository,
    schemas::{ActivationDto, ActivationHistoryItemDto},
};
use crate::{core::error::AppError, users::service::UserService};

pub struct ActivationService;

impl ActivationService {
    pub async fn get_user_activations(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<ActivationHistoryItemDto>, AppError> {
        let user_exists = UserService::check_exists(pool, user_id).await?;
        if !user_exists {
            return Err(AppError::NotFound(format!(
                "Пользователь с id {user_id} не найден"
            )));
        }

        let history = ActivationRepository::find_history_by_user(pool, user_id).await?;
        Ok(history
            .into_iter()
            .map(ActivationHistoryItemDto::from)
            .collect())
    }

    pub async fn activate_voucher(
        pool: &PgPool,
        user_id: Uuid,
        product_id: Uuid,
    ) -> Result<ActivationDto, AppError> {
        let (activation, remaining_quantity) =
            ActivationRepository::activate_atomic(pool, user_id, product_id).await?;

        Ok(ActivationDto {
            id: activation.id,
            user_id: activation.user_id,
            product_id: activation.product_id,
            product_name: activation.product_name,
            activated_at: activation.activated_at,
            remaining_quantity,
        })
    }
}
