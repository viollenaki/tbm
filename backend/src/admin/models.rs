use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct VoucherBalance {
    pub user_id: Uuid,
    pub product_id: Uuid,
    pub quantity: i32,
}
