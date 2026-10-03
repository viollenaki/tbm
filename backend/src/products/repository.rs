use sqlx::PgPool;
use uuid::Uuid;

use super::models::Product;

pub struct ProductRepository;

impl ProductRepository {
    pub async fn find_all(pool: &PgPool) -> Result<Vec<Product>, sqlx::Error> {
        let products = sqlx::query_as::<_, Product>(
            "SELECT id, name, created_at FROM products ORDER BY name ASC",
        )
        .fetch_all(pool)
        .await?;

        Ok(products)
    }

    pub async fn exists(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(1) FROM products WHERE id = $1")
            .bind(id)
            .fetch_one(pool)
            .await?;

        Ok(count.0 > 0)
    }
}
