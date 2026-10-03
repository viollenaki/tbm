use sqlx::PgPool;
use uuid::Uuid;

use super::{repository::VoucherRepository, schemas::VoucherBalanceDto};
use crate::{core::error::AppError, users::service::UserService};

pub struct VoucherService;

impl VoucherService {
    pub async fn get_user_balances(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<VoucherBalanceDto>, AppError> {
        let user_exists = UserService::check_exists(pool, user_id).await?;
        if !user_exists {
            return Err(AppError::NotFound(format!(
                "Пользователь с id {user_id} не найден"
            )));
        }

        let balances = VoucherRepository::find_balances_by_user(pool, user_id).await?;
        Ok(balances.into_iter().map(VoucherBalanceDto::from).collect())
    }
}
