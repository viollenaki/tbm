use sqlx::PgPool;
use uuid::Uuid;

use super::{repository::ProductRepository, schemas::ProductDto};
use crate::core::error::AppError;

pub struct ProductService;

impl ProductService {
    pub async fn list_products(pool: &PgPool) -> Result<Vec<ProductDto>, AppError> {
        let products = ProductRepository::find_all(pool).await?;
        Ok(products.into_iter().map(ProductDto::from).collect())
    }

    pub async fn check_exists(pool: &PgPool, id: Uuid) -> Result<bool, AppError> {
        let exists = ProductRepository::exists(pool, id).await?;
        Ok(exists)
    }
}
