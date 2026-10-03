use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct Product {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}
