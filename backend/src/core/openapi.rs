use utoipa::OpenApi;

use crate::{
    activations::{handlers as activation_handlers, schemas as activation_schemas},
    admin::{handlers as admin_handlers, schemas as admin_schemas},
    core::error::ErrorResponse,
    products::{handlers as product_handlers, schemas as product_schemas},
    users::{handlers as user_handlers, schemas as user_schemas},
    vouchers::{handlers as voucher_handlers, schemas as voucher_schemas},
};

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::api::health_check,
        user_handlers::list_users,
        product_handlers::list_products,
        voucher_handlers::get_user_balances,
        activation_handlers::get_user_activations,
        activation_handlers::activate_voucher,
        admin_handlers::set_voucher_balance,
    ),
    components(
        schemas(
            ErrorResponse,
            user_schemas::UserDto,
            product_schemas::ProductDto,
            voucher_schemas::VoucherBalanceDto,
            activation_schemas::ActivateVoucherRequest,
            activation_schemas::ActivationDto,
            activation_schemas::ActivationHistoryItemDto,
            admin_schemas::SetBalanceRequest,
            admin_schemas::SetBalanceResponse,
        )
    ),
    tags(
        (name = "Health", description = "Health check endpoints"),
        (name = "Users", description = "User management"),
        (name = "Products", description = "Product catalog"),
        (name = "Vouchers", description = "User voucher balances"),
        (name = "Activations", description = "Voucher activation and history"),
        (name = "Admin", description = "Administrator operations")
    ),
    info(
        title = "Voucher Activation API",
        version = "1.0.0",
        description = "Modular service for user product voucher balances and atomic activations"
    )
)]
pub struct ApiDoc;
