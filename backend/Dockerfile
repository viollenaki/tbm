# Stage 1: Cargo Chef Planner
FROM lukemathwalker/cargo-chef:latest-rust-1 AS chef
WORKDIR /app

FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo chef prepare --recipe-path recipe.json

# Stage 2: Cache dependencies
FROM chef AS builder
WORKDIR /app
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Stage 3: Build application
COPY Cargo.toml Cargo.lock ./
COPY migrations ./migrations
COPY src ./src
RUN cargo build --release --bin backend --bin gen-openapi

# Stage 4: Minimal runtime
FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged user
RUN useradd -m -u 10001 -U appuser

COPY --from=builder /app/target/release/backend /app/backend
COPY --from=builder /app/target/release/gen-openapi /app/gen-openapi
COPY --from=builder /app/migrations /app/migrations

USER appuser

ENV HOST=0.0.0.0 \
    PORT=8080 \
    RUST_LOG=info,backend=debug

EXPOSE 8080

ENTRYPOINT ["/app/backend"]
