# CLAUDE.md — Backend Guide

Refer to [`AGENTS.md`](AGENTS.md) for complete architectural rules and module boundary guidelines.

## Quick Commands
```bash
# Check formatting
cargo fmt --check

# Format in-place
cargo fmt

# Linter with zero warnings tolerance
cargo clippy -- -D warnings

# Build & test compilation
cargo test --no-run

# Run integration tests against database
cargo test

# Generate OpenAPI JSON schema
cargo run --bin gen-openapi > ../frontend/openapi.json
```
