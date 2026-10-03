use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::models::VoucherBalance;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SetBalanceRequest {
    pub quantity: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SetBalanceResponse {
    pub user_id: Uuid,
    pub product_id: Uuid,
    pub quantity: i32,
}

impl From<VoucherBalance> for SetBalanceResponse {
    fn from(b: VoucherBalance) -> Self {
        Self {
            user_id: b.user_id,
            product_id: b.product_id,
            quantity: b.quantity,
        }
    }
}
