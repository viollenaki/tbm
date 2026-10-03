use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::models::ActivationWithProduct;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ActivateVoucherRequest {
    pub product_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ActivationDto {
    pub id: Uuid,
    pub user_id: Uuid,
    pub product_id: Uuid,
    pub product_name: String,
    pub activated_at: DateTime<Utc>,
    pub remaining_quantity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ActivationHistoryItemDto {
    pub id: Uuid,
    pub user_id: Uuid,
    pub product_id: Uuid,
    pub product_name: String,
    pub activated_at: DateTime<Utc>,
}

impl From<ActivationWithProduct> for ActivationHistoryItemDto {
    fn from(a: ActivationWithProduct) -> Self {
        Self {
            id: a.id,
            user_id: a.user_id,
            product_id: a.product_id,
            product_name: a.product_name,
            activated_at: a.activated_at,
        }
    }
}
