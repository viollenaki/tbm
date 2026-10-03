use sqlx::PgPool;
use uuid::Uuid;

use super::models::User;

pub struct UserRepository;

impl UserRepository {
    pub async fn find_all(pool: &PgPool) -> Result<Vec<User>, sqlx::Error> {
        let users =
            sqlx::query_as::<_, User>("SELECT id, name, created_at FROM users ORDER BY name ASC")
                .fetch_all(pool)
                .await?;

        Ok(users)
    }

    pub async fn exists(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(1) FROM users WHERE id = $1")
            .bind(id)
            .fetch_one(pool)
            .await?;

        Ok(count.0 > 0)
    }
}
