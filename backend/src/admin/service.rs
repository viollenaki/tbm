use sqlx::PgPool;
use uuid::Uuid;

use super::{repository::AdminRepository, schemas::SetBalanceResponse};
use crate::{
    core::error::AppError, products::service::ProductService, users::service::UserService,
};

pub struct AdminService;

impl AdminService {
    pub async fn set_balance(
        pool: &PgPool,
        user_id: Uuid,
        product_id: Uuid,
        quantity: i32,
    ) -> Result<SetBalanceResponse, AppError> {
        if quantity < 0 {
            return Err(AppError::ValidationError(
                "Количество ваучеров не может быть отрицательным".to_string(),
            ));
        }

        let user_exists = UserService::check_exists(pool, user_id).await?;
        if !user_exists {
            return Err(AppError::NotFound(format!(
                "Пользователь с id {user_id} не найден"
            )));
        }

        let product_exists = ProductService::check_exists(pool, product_id).await?;
        if !product_exists {
            return Err(AppError::NotFound(format!(
                "Продукт с id {product_id} не найден"
            )));
        }

        let balance = AdminRepository::upsert_balance(pool, user_id, product_id, quantity).await?;
        Ok(SetBalanceResponse::from(balance))
    }
}
