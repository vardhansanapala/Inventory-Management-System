export function extractAssetId(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    const assetFromQuery = url.searchParams.get("assetId");
    if (assetFromQuery) {
      return decodeURIComponent(assetFromQuery).trim().toUpperCase();
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const lastSegment = segments.at(-1);

    return lastSegment ? decodeURIComponent(lastSegment).trim().toUpperCase() : "";
  } catch {
    // Treat non-URL input as a raw asset ID or a copied scan path.
  }

  const pathMatch = text.match(/([^/?#]+)(?:[?#].*)?$/);
  if (text.includes("/") && pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]).trim().toUpperCase();
  }

  return text.toUpperCase();
}
