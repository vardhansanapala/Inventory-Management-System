export const ASSET_STATUSES = {
  AVAILABLE: "AVAILABLE",
  ASSIGNED: "ASSIGNED",
  RENTED_OUT: "RENTED_OUT",
  DAMAGED: "DAMAGED",
  UNDER_REPAIR: "UNDER_REPAIR",
  SOLD: "SOLD",
  LOST: "LOST",

  // Legacy statuses preserved for older records.
  RESERVED: "RESERVED",
  IN_USE: "IN_USE",
  SENT_OUT: "SENT_OUT",
  OUTSIDE: "OUTSIDE",
  RETIRED: "RETIRED",
};

export const FRONTEND_VISIBLE_ASSET_STATUSES = [
  ASSET_STATUSES.AVAILABLE,
  ASSET_STATUSES.ASSIGNED,
  ASSET_STATUSES.RENTED_OUT,
  ASSET_STATUSES.DAMAGED,
  ASSET_STATUSES.UNDER_REPAIR,
  ASSET_STATUSES.SOLD,
  ASSET_STATUSES.LOST,
];

const FRONTEND_VISIBLE_ASSET_STATUS_SET = new Set(FRONTEND_VISIBLE_ASSET_STATUSES);

export const ASSET_ACTIONS = {
  ASSIGN_DEVICE: "ASSIGN_DEVICE",
  TRANSFER: "TRANSFER",
  RETURN_DEVICE: "RETURN_DEVICE",
  MARK_DAMAGED: "MARK_DAMAGED",
  SEND_FOR_REPAIR: "SEND_FOR_REPAIR",
  MARK_LOST: "MARK_LOST",
  SELL: "SELL",
  RENT_OUT: "RENT_OUT",

  // Legacy action names preserved for older API clients.
  RENT_DEVICE: "RENT_DEVICE",
  SELL_DEVICE: "SELL_DEVICE",
  SEND_OUTSIDE: "SEND_OUTSIDE",
  UNASSIGN_DEVICE: "UNASSIGN_DEVICE",
  COMPLETE_REPAIR: "COMPLETE_REPAIR",
};

const CANONICAL_ACTION_ALIASES = {
  [ASSET_ACTIONS.RENT_DEVICE]: ASSET_ACTIONS.RENT_OUT,
  [ASSET_ACTIONS.SELL_DEVICE]: ASSET_ACTIONS.SELL,
};

const ACTION_LABELS = {
  [ASSET_ACTIONS.ASSIGN_DEVICE]: "Assign Device",
  [ASSET_ACTIONS.TRANSFER]: "Transfer",
  [ASSET_ACTIONS.RETURN_DEVICE]: "Return Device",
  [ASSET_ACTIONS.MARK_DAMAGED]: "Mark Damaged",
  [ASSET_ACTIONS.SEND_FOR_REPAIR]: "Send For Repair",
  [ASSET_ACTIONS.MARK_LOST]: "Mark Lost",
  [ASSET_ACTIONS.SELL]: "Sell",
  [ASSET_ACTIONS.RENT_OUT]: "Rent Out",
};

export function normalizeAssetAction(action) {
  const normalized = String(action || "").trim().toUpperCase();
  return CANONICAL_ACTION_ALIASES[normalized] || normalized;
}

export function getVisibleAssetStatuses() {
  return FRONTEND_VISIBLE_ASSET_STATUSES.slice();
}

export function isVisibleAssetStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  return FRONTEND_VISIBLE_ASSET_STATUS_SET.has(normalized);
}

export function getDisplayAssetStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  return isVisibleAssetStatus(normalized) ? normalized : "-";
}

export function getAssetActionLabel(action) {
  return ACTION_LABELS[normalizeAssetAction(action)] || String(action || "").trim() || "-";
}

export function getValidActionsForStatus(status) {
  switch (String(status || "").trim().toUpperCase()) {
    case ASSET_STATUSES.AVAILABLE:
      return [ASSET_ACTIONS.ASSIGN_DEVICE, ASSET_ACTIONS.RENT_OUT, ASSET_ACTIONS.SELL, ASSET_ACTIONS.TRANSFER];
    case ASSET_STATUSES.ASSIGNED:
      return [ASSET_ACTIONS.MARK_DAMAGED, ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.MARK_LOST, ASSET_ACTIONS.TRANSFER];
    case ASSET_STATUSES.RENTED_OUT:
      return [ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.MARK_DAMAGED, ASSET_ACTIONS.TRANSFER];
    case ASSET_STATUSES.DAMAGED:
      return [ASSET_ACTIONS.SEND_FOR_REPAIR, ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.TRANSFER];
    case ASSET_STATUSES.UNDER_REPAIR:
      return [ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.TRANSFER];
    case ASSET_STATUSES.SOLD:
    case ASSET_STATUSES.LOST:
      return [];
    default:
      return [];
  }
}

export function getNextStatusForAction(currentStatus, action) {
  const normalizedStatus = String(currentStatus || "").trim().toUpperCase();

  switch (normalizeAssetAction(action)) {
    case ASSET_ACTIONS.ASSIGN_DEVICE:
      return ASSET_STATUSES.ASSIGNED;
    case ASSET_ACTIONS.TRANSFER:
      return normalizedStatus;
    case ASSET_ACTIONS.MARK_DAMAGED:
      return ASSET_STATUSES.DAMAGED;
    case ASSET_ACTIONS.RETURN_DEVICE:
      return normalizedStatus === ASSET_STATUSES.DAMAGED ? ASSET_STATUSES.DAMAGED : ASSET_STATUSES.AVAILABLE;
    case ASSET_ACTIONS.SEND_FOR_REPAIR:
      return ASSET_STATUSES.UNDER_REPAIR;
    case ASSET_ACTIONS.RENT_OUT:
      return ASSET_STATUSES.RENTED_OUT;
    case ASSET_ACTIONS.SELL:
      return ASSET_STATUSES.SOLD;
    case ASSET_ACTIONS.MARK_LOST:
      return ASSET_STATUSES.LOST;
    default:
      return normalizedStatus;
  }
}
