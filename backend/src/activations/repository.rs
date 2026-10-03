use sqlx::PgPool;
use uuid::Uuid;

use super::models::ActivationWithProduct;
use crate::core::error::AppError;

pub struct ActivationRepository;

impl ActivationRepository {
    pub async fn find_history_by_user(
        pool: &PgPool,
        user_id: Uuid,
    ) -> Result<Vec<ActivationWithProduct>, sqlx::Error> {
        let history = sqlx::query_as::<_, ActivationWithProduct>(
            r#"
            SELECT
                a.id,
                a.user_id,
                a.product_id,
                p.name AS product_name,
                a.activated_at
            FROM activations a
            JOIN products p ON p.id = a.product_id
            WHERE a.user_id = $1
            ORDER BY a.activated_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(history)
    }

    pub async fn activate_atomic(
        pool: &PgPool,
        user_id: Uuid,
        product_id: Uuid,
    ) -> Result<(ActivationWithProduct, i32), AppError> {
        let mut tx = pool.begin().await?;

        // Try to decrement voucher balance atomically
        let update_result: Option<(i32,)> = sqlx::query_as(
            r#"
            UPDATE voucher_balances
            SET quantity = quantity - 1
            WHERE user_id = $1 AND product_id = $2 AND quantity > 0
            RETURNING quantity
            "#,
        )
        .bind(user_id)
        .bind(product_id)
        .fetch_optional(&mut *tx)
        .await?;

        match update_result {
            Some((remaining_quantity,)) => {
                // Fetch product name for the activation record response
                let product_name: (String,) =
                    sqlx::query_as("SELECT name FROM products WHERE id = $1")
                        .bind(product_id)
                        .fetch_one(&mut *tx)
                        .await?;

                // Insert into activations table
                let activation_row: (Uuid, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
                    r#"
                    INSERT INTO activations (id, user_id, product_id, activated_at)
                    VALUES (gen_random_uuid(), $1, $2, NOW())
                    RETURNING id, activated_at
                    "#,
                )
                .bind(user_id)
                .bind(product_id)
                .fetch_one(&mut *tx)
                .await?;

                tx.commit().await?;

                let activation = ActivationWithProduct {
                    id: activation_row.0,
                    user_id,
                    product_id,
                    product_name: product_name.0,
                    activated_at: activation_row.1,
                };

                Ok((activation, remaining_quantity))
            }
            None => {
                // Rollback transaction before checking reasons
                tx.rollback().await?;

                // Check if user exists
                let user_exists: (i64,) =
                    sqlx::query_as("SELECT COUNT(1) FROM users WHERE id = $1")
                        .bind(user_id)
                        .fetch_one(pool)
                        .await?;

                if user_exists.0 == 0 {
                    return Err(AppError::NotFound(format!(
                        "Пользователь с id {user_id} не найден"
                    )));
                }

                // Check if product exists
                let product_exists: (i64,) =
                    sqlx::query_as("SELECT COUNT(1) FROM products WHERE id = $1")
                        .bind(product_id)
                        .fetch_one(pool)
                        .await?;

                if product_exists.0 == 0 {
                    return Err(AppError::NotFound(format!(
                        "Продукт с id {product_id} не найден"
                    )));
                }

                // User and product exist, meaning vouchers are 0 or none allocated
                Err(AppError::NoVouchersLeft(
                    "Ваучеры на этот продукт закончились".to_string(),
                ))
            }
        }
    }
}
