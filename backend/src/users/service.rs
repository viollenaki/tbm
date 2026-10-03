use sqlx::PgPool;
use uuid::Uuid;

use super::{repository::UserRepository, schemas::UserDto};
use crate::core::error::AppError;

pub struct UserService;

impl UserService {
    pub async fn list_users(pool: &PgPool) -> Result<Vec<UserDto>, AppError> {
        let users = UserRepository::find_all(pool).await?;
        Ok(users.into_iter().map(UserDto::from).collect())
    }

    pub async fn check_exists(pool: &PgPool, id: Uuid) -> Result<bool, AppError> {
        let exists = UserRepository::exists(pool, id).await?;
        Ok(exists)
    }
}
