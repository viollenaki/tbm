use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use backend_lib::{
    activations::schemas::{ActivateVoucherRequest, ActivationDto, ActivationHistoryItemDto},
    admin::schemas::{SetBalanceRequest, SetBalanceResponse},
    api::create_router,
    core::{
        db::{create_pool, run_migrations},
        error::ErrorResponse,
        state::AppState,
    },
    vouchers::schemas::VoucherBalanceDto,
};
use http_body_util::BodyExt;
use serde_json::json;
use sqlx::PgPool;
use std::env;
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

async fn setup_test_app() -> Option<(axum::Router, PgPool)> {
    dotenvy::dotenv().ok();
    let db_url = env::var("TEST_DATABASE_URL")
        .or_else(|_| env::var("DATABASE_URL"))
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/tbm_vouchers".to_string());

    let pool = match create_pool(&db_url).await {
        Ok(p) => p,
        Err(err) => {
            eprintln!("Skipping integration test: PostgreSQL is not available at {db_url} ({err})");
            return None;
        }
    };

    if let Err(err) = run_migrations(&pool).await {
        eprintln!("Failed to run migrations on test DB: {err}");
        return None;
    }

    let state = AppState::new(pool.clone());
    let router = create_router(state);
    Some((router, pool))
}

#[tokio::test]
async fn test_successful_activation_and_history() {
    let (app, pool) = match setup_test_app().await {
        Some(res) => res,
        None => return,
    };

    let user_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();

    // Create test user and product
    sqlx::query("INSERT INTO users (id, name) VALUES ($1, 'Test User')")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO products (id, name) VALUES ($1, 'Test Product')")
        .bind(product_id)
        .execute(&pool)
        .await
        .unwrap();

    // Set initial balance to 3
    sqlx::query("INSERT INTO voucher_balances (user_id, product_id, quantity) VALUES ($1, $2, 3)")
        .bind(user_id)
        .bind(product_id)
        .execute(&pool)
        .await
        .unwrap();

    // 1. Activate voucher
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/users/{user_id}/activations"))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&ActivateVoucherRequest { product_id }).unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let activation: ActivationDto = serde_json::from_slice(&body).unwrap();
    assert_eq!(activation.user_id, user_id);
    assert_eq!(activation.product_id, product_id);
    assert_eq!(activation.remaining_quantity, 2);

    // 2. Check balance
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/users/{user_id}/balances"))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let balances: Vec<VoucherBalanceDto> = serde_json::from_slice(&body).unwrap();
    let balance = balances
        .iter()
        .find(|b| b.product_id == product_id)
        .unwrap();
    assert_eq!(balance.quantity, 2);

    // 3. Check history
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/users/{user_id}/activations"))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let history: Vec<ActivationHistoryItemDto> = serde_json::from_slice(&body).unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].product_id, product_id);
}

#[tokio::test]
async fn test_activation_when_zero_vouchers_left() {
    let (app, pool) = match setup_test_app().await {
        Some(res) => res,
        None => return,
    };

    let user_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();

    sqlx::query("INSERT INTO users (id, name) VALUES ($1, 'Zero Balance User')")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO products (id, name) VALUES ($1, 'Zero Balance Product')")
        .bind(product_id)
        .execute(&pool)
        .await
        .unwrap();

    // Initial balance is 0
    sqlx::query("INSERT INTO voucher_balances (user_id, product_id, quantity) VALUES ($1, $2, 0)")
        .bind(user_id)
        .bind(product_id)
        .execute(&pool)
        .await
        .unwrap();

    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/users/{user_id}/activations"))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&ActivateVoucherRequest { product_id }).unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CONFLICT);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(err.code, "NO_VOUCHERS_LEFT");

    // Verify history was NOT added
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/users/{user_id}/activations"))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let history: Vec<ActivationHistoryItemDto> = serde_json::from_slice(&body).unwrap();
    assert_eq!(history.len(), 0);
}

#[tokio::test]
async fn test_admin_set_balance_and_validation() {
    let (app, pool) = match setup_test_app().await {
        Some(res) => res,
        None => return,
    };

    let user_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();

    sqlx::query("INSERT INTO users (id, name) VALUES ($1, 'Admin Target User')")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO products (id, name) VALUES ($1, 'Admin Target Product')")
        .bind(product_id)
        .execute(&pool)
        .await
        .unwrap();

    // 1. Negative quantity -> 422 VALIDATION_ERROR
    let req = Request::builder()
        .method("PUT")
        .uri(format!(
            "/api/v1/admin/users/{user_id}/balances/{product_id}"
        ))
        .header("content-type", "application/json")
        .body(Body::from(json!({ "quantity": -5 }).to_string()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(err.code, "VALIDATION_ERROR");

    // 2. Set balance to 7 (create)
    let req = Request::builder()
        .method("PUT")
        .uri(format!(
            "/api/v1/admin/users/{user_id}/balances/{product_id}"
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&SetBalanceRequest { quantity: 7 }).unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let resp: SetBalanceResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(resp.quantity, 7);

    // 3. Overwrite balance to 4
    let req = Request::builder()
        .method("PUT")
        .uri(format!(
            "/api/v1/admin/users/{user_id}/balances/{product_id}"
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&SetBalanceRequest { quantity: 4 }).unwrap(),
        ))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let resp: SetBalanceResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(resp.quantity, 4);
}

#[tokio::test]
async fn test_non_existent_user_or_product_returns_404() {
    let (app, _) = match setup_test_app().await {
        Some(res) => res,
        None => return,
    };

    let fake_user_id = Uuid::new_v4();
    let fake_product_id = Uuid::new_v4();

    // 1. Balances of non-existent user
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/users/{fake_user_id}/balances"))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 2. Activations of non-existent user
    let req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/users/{fake_user_id}/activations"))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 3. Activation on non-existent user
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/users/{fake_user_id}/activations"))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&ActivateVoucherRequest {
                product_id: fake_product_id,
            })
            .unwrap(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);

    // 4. Admin set balance on non-existent user
    let req = Request::builder()
        .method("PUT")
        .uri(format!(
            "/api/v1/admin/users/{fake_user_id}/balances/{fake_product_id}"
        ))
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&SetBalanceRequest { quantity: 5 }).unwrap(),
        ))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_race_condition_concurrency() {
    let (app, pool) = match setup_test_app().await {
        Some(res) => res,
        None => return,
    };

    let user_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();

    sqlx::query("INSERT INTO users (id, name) VALUES ($1, 'Race User')")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO products (id, name) VALUES ($1, 'Race Product')")
        .bind(product_id)
        .execute(&pool)
        .await
        .unwrap();

    // M = 5 vouchers available
    let initial_balance = 5;
    sqlx::query("INSERT INTO voucher_balances (user_id, product_id, quantity) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(product_id)
        .bind(initial_balance)
        .execute(&pool)
        .await
        .unwrap();

    // N = 15 concurrent activation attempts (N > M)
    let total_attempts = 15;
    let app = Arc::new(app);

    let mut handles = Vec::new();
    for _ in 0..total_attempts {
        let app = Arc::clone(&app);
        let handle = tokio::spawn(async move {
            let req = Request::builder()
                .method("POST")
                .uri(format!("/api/v1/users/{user_id}/activations"))
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&ActivateVoucherRequest { product_id }).unwrap(),
                ))
                .unwrap();

            let res = (*app).clone().oneshot(req).await.unwrap();
            res.status()
        });
        handles.push(handle);
    }

    let mut success_count = 0;
    let mut conflict_count = 0;

    for handle in handles {
        let status = handle.await.unwrap();
        if status == StatusCode::OK {
            success_count += 1;
        } else if status == StatusCode::CONFLICT {
            conflict_count += 1;
        }
    }

    // Exactly M successes and N - M conflicts
    assert_eq!(success_count, initial_balance);
    assert_eq!(conflict_count, total_attempts - initial_balance);

    // Final balance must be exactly 0, not negative
    let remaining: (i32,) = sqlx::query_as(
        "SELECT quantity FROM voucher_balances WHERE user_id = $1 AND product_id = $2",
    )
    .bind(user_id)
    .bind(product_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(remaining.0, 0);

    // Activations table must have exactly M records
    let count: (i64,) =
        sqlx::query_as("SELECT COUNT(1) FROM activations WHERE user_id = $1 AND product_id = $2")
            .bind(user_id)
            .bind(product_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(count.0, initial_balance as i64);
}

#[tokio::test]
async fn test_rate_limiter_blocks_excessive_requests() {
    let (_, pool) = match setup_test_app().await {
        Some(res) => res,
        None => return,
    };

    let limiter = Arc::new(backend_lib::core::rate_limit::RateLimiter::new(
        backend_lib::core::rate_limit::RateLimiterConfig {
            enabled: true,
            requests_per_minute: 1,
            burst_capacity: 2,
        },
    ));

    let state = AppState::with_limiter(pool, limiter);
    let app = create_router(state);

    let client_ip = "198.51.100.42";

    // Request 1: allowed
    let req1 = Request::builder()
        .method("GET")
        .uri("/api/v1/products")
        .header("x-forwarded-for", client_ip)
        .body(Body::empty())
        .unwrap();
    let res1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(res1.status(), StatusCode::OK);

    // Request 2: allowed
    let req2 = Request::builder()
        .method("GET")
        .uri("/api/v1/products")
        .header("x-forwarded-for", client_ip)
        .body(Body::empty())
        .unwrap();
    let res2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::OK);

    // Request 3: rate limit exceeded -> 429
    let req3 = Request::builder()
        .method("GET")
        .uri("/api/v1/products")
        .header("x-forwarded-for", client_ip)
        .body(Body::empty())
        .unwrap();
    let res3 = app.clone().oneshot(req3).await.unwrap();
    assert_eq!(res3.status(), StatusCode::TOO_MANY_REQUESTS);
    assert!(res3.headers().contains_key("retry-after"));

    let body = res3.into_body().collect().await.unwrap().to_bytes();
    let err: ErrorResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(err.code, "RATE_LIMIT_EXCEEDED");

    // Exempt path: /health is never blocked
    let health_req = Request::builder()
        .method("GET")
        .uri("/health")
        .header("x-forwarded-for", client_ip)
        .body(Body::empty())
        .unwrap();
    let health_res = app.oneshot(health_req).await.unwrap();
    assert_eq!(health_res.status(), StatusCode::OK);
}
