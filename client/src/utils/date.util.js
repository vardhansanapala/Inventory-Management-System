function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  return date;
}

function formatShortDate(date) {
  try {
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return date.toDateString();
  }
}

export function getRelativeTime(value) {
  const date = toValidDate(value);
  if (!date) return "-";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatShortDate(date);

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return "Just now";

  const diffMins = Math.floor(diffSeconds / 60);
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "min" : "mins"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hr" : "hrs"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return formatShortDate(date);
}

export function getFullDateTime(value) {
  const date = toValidDate(value);
  if (!date) return "-";
  return date.toString();
}

export function getSortableTime(value) {
  const date = toValidDate(value);
  return date ? date.getTime() : 0;
}

export function getLastUpdatedValue(item) {
  return item?.updatedAt || item?.createdAt || null;
}

