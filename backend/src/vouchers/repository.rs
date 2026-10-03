use sqlx::PgPool;
use uuid::Uuid;

use super::models::UserProductBalance;

pub struct VoucherRepository;

impl VoucherRepository {
    pub async fn find_balances_by_user(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<UserProductBalance>, sqlx::Error> {
        let balances = sqlx::query_as::<_, UserProductBalance>(
            r#"
            SELECT
                p.id AS product_id,
                p.name AS product_name,
                COALESCE(vb.quantity, 0) AS quantity
            FROM products p
            LEFT JOIN voucher_balances vb ON vb.product_id = p.id AND vb.user_id = $1
            ORDER BY p.name ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(balances)
    }
}
