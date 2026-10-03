use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::models::UserProductBalance;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VoucherBalanceDto {
    pub product_id: Uuid,
    pub product_name: String,
    pub quantity: i32,
}

impl From<UserProductBalance> for VoucherBalanceDto {
    fn from(b: UserProductBalance) -> Self {
        Self {
            product_id: b.product_id,
            product_name: b.product_name,
            quantity: b.quantity,
        }
    }
}
