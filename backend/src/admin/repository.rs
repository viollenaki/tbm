use sqlx::PgPool;
use uuid::Uuid;

use super::models::VoucherBalance;

pub struct AdminRepository;

impl AdminRepository {
    pub async fn upsert_balance(
        pool: &PgPool,
        user_id: Uuid,
        product_id: Uuid,
        quantity: i32,
    ) -> Result<VoucherBalance, sqlx::Error> {
        let balance = sqlx::query_as::<_, VoucherBalance>(
            r#"
            INSERT INTO voucher_balances (user_id, product_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, product_id)
            DO UPDATE SET quantity = EXCLUDED.quantity
            RETURNING user_id, product_id, quantity
            "#,
        )
        .bind(user_id)
        .bind(product_id)
        .bind(quantity)
        .fetch_one(pool)
        .await?;

        Ok(balance)
    }
}
