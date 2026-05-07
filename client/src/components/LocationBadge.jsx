import { Circle, Home, MapPin } from "lucide-react";

export function getLocationLabel(location, locationType, status) {
  const normalizedStatus = String(status || "").trim().toUpperCase();

  if (normalizedStatus === "SOLD") return "Sold";
  if (normalizedStatus === "RENTED_OUT") return "Rented Out";

  if (String(locationType || "").trim().toUpperCase() === "WFH") {
    return "WFH";
  }

  return location?.name || "-";
}

export function LocationBadge({ status, locationType, location }) {
  const label = getLocationLabel(location, locationType, status);
  const normalizedStatus = String(status || "").trim().toUpperCase();

  let className = "badge badge-default";
  let icon = <MapPin size={14} />;

  if (normalizedStatus === "SOLD") {
    className = "badge badge-sold";
    icon = <Circle size={12} className="icon-sold" />;
  } else if (normalizedStatus === "RENTED_OUT") {
    className = "badge badge-rented";
    icon = <Circle size={12} className="icon-rented" />;
  } else if (String(locationType || "").trim().toUpperCase() === "WFH") {
    className = "badge badge-wfh";
    icon = <Home size={14} />;
  }

  return (
    <span className={className}>
      {icon}
      {label}
    </span>
  );
}
