use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct UserProductBalance {
    pub product_id: Uuid,
    pub product_name: String,
    pub quantity: i32,
}
