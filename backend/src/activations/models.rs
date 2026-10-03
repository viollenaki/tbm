use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct Activation {
    pub id: Uuid,
    pub user_id: Uuid,
    pub product_id: Uuid,
    pub activated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct ActivationWithProduct {
    pub id: Uuid,
    pub user_id: Uuid,
    pub product_id: Uuid,
    pub product_name: String,
    pub activated_at: DateTime<Utc>,
}
