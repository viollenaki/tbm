use backend_lib::core::openapi::ApiDoc;
use utoipa::OpenApi;

fn main() -> anyhow::Result<()> {
    let spec = ApiDoc::openapi().to_pretty_json()?;
    println!("{spec}");
    Ok(())
}
