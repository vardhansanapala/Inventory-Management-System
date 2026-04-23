const { ACTION_REASONS, ASSET_ACTIONS, ASSET_STATUSES } = require("../constants/asset.constants");
const { ApiError } = require("../utils/ApiError");

const TERMINAL_STATUSES = new Set([ASSET_STATUSES.SOLD, ASSET_STATUSES.LOST]);
const CANONICAL_ACTION_ALIASES = {
  [ASSET_ACTIONS.RENT_DEVICE]: ASSET_ACTIONS.RENT_OUT,
  [ASSET_ACTIONS.SELL_DEVICE]: ASSET_ACTIONS.SELL,
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function normalizeAction(action) {
  const normalized = String(action || "").trim().toUpperCase();
  return CANONICAL_ACTION_ALIASES[normalized] || normalized;
}

function getAllowedTransitionMessage(action, status) {
  return `Action ${action} is not allowed when asset status is ${status}`;
}

function getAllowedActionsForStatus(status) {
  switch (normalizeStatus(status)) {
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

function assertAllowedAction(status, action) {
  if (!getAllowedActionsForStatus(status).includes(action)) {
    throw new ApiError(409, getAllowedTransitionMessage(action, status));
  }
}

function assertRequiredText(value, fieldName, message) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new ApiError(400, message || `${fieldName} is required`);
  }
  return normalized;
}

function assertOptionalText(value) {
  const normalized = String(value || "").trim();
  return normalized || "";
}

function assertRequiredNumber(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    throw new ApiError(400, `${fieldName} is required`);
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric < 0) {
    throw new ApiError(400, `${fieldName} must be a valid non-negative number`);
  }

  return numeric;
}

function assertRequiredDate(value, fieldName) {
  const normalized = assertRequiredText(value, fieldName);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `${fieldName} must be a valid date`);
  }
  return parsed;
}

function getAssetLocationType(asset) {
  return String(asset?.locationType || asset?.metadata?.locationType || "PHYSICAL").trim().toUpperCase() === "WFH" ? "WFH" : "PHYSICAL";
}

function getAssetWfhAddress(asset) {
  return String(asset?.wfhAddress || asset?.metadata?.wfhAddress || "").trim();
}

function resolveTransferTarget({ refs, payload }) {
  const nextLocationType = String(payload.locationType || "").trim().toUpperCase() === "WFH" ? "WFH" : "PHYSICAL";
  const nextWfhAddress = assertOptionalText(payload.wfhAddress);

  if (nextLocationType === "WFH") {
    if (!nextWfhAddress) {
      throw new ApiError(400, "wfhAddress is required when transferring to WFH");
    }

    return {
      locationType: "WFH",
      location: refs.location ? refs.location._id : null,
      wfhAddress: nextWfhAddress,
    };
  }

  if (!refs.location) {
    throw new ApiError(400, "locationId is required to transfer a device");
  }

  return {
    locationType: "PHYSICAL",
    location: refs.location._id,
    wfhAddress: "",
  };
}

function resolveActionReason(action, requestedReason) {
  const normalizedAction = normalizeAction(action);

  switch (normalizedAction) {
    case ASSET_ACTIONS.SEND_FOR_REPAIR:
      return ACTION_REASONS.REPAIR;
    case ASSET_ACTIONS.RENT_OUT:
      return ACTION_REASONS.RENTAL;
    case ASSET_ACTIONS.SELL:
      return ACTION_REASONS.SALE;
    case ASSET_ACTIONS.TRANSFER:
      return ACTION_REASONS.TRANSFER;
    case ASSET_ACTIONS.RETURN_DEVICE:
      return ACTION_REASONS.RETURN;
    default:
      return requestedReason || ACTION_REASONS.OTHER;
  }
}

function buildTransition({ asset, action, refs, payload }) {
  const normalizedAction = normalizeAction(action);
  assertAllowedAction(asset.status, normalizedAction);

  if (TERMINAL_STATUSES.has(asset.status)) {
    throw new ApiError(409, getAllowedTransitionMessage(normalizedAction, asset.status));
  }

  switch (normalizedAction) {
    case ASSET_ACTIONS.ASSIGN_DEVICE: {
      if (!refs.assignedTo) {
        throw new ApiError(400, "assignedToId is required to assign a device");
      }

      return {
        action: normalizedAction,
        status: ASSET_STATUSES.ASSIGNED,
        assignedTo: refs.assignedTo._id,
        location: asset.location,
        metadata: {
          assignedToId: String(refs.assignedTo._id),
          lifecycleAction: normalizedAction,
        },
      };
    }

    case ASSET_ACTIONS.TRANSFER: {
      const currentLocationType = getAssetLocationType(asset);
      const currentWfhAddress = getAssetWfhAddress(asset);
      const transferTarget = resolveTransferTarget({ refs, payload });

      return {
        action: normalizedAction,
        status: asset.status,
        assignedTo: asset.assignedTo,
        location: transferTarget.location || asset.location,
        locationType: transferTarget.locationType,
        wfhAddress: transferTarget.wfhAddress,
        metadata: {
          fromLocationId: asset.location ? String(asset.location) : null,
          toLocationId: transferTarget.location ? String(transferTarget.location) : null,
          fromLocationType: currentLocationType,
          toLocationType: transferTarget.locationType,
          fromWfhAddress: currentWfhAddress || null,
          toWfhAddress: transferTarget.wfhAddress || null,
          locationType: transferTarget.locationType,
          wfhAddress: transferTarget.wfhAddress,
          lifecycleAction: normalizedAction,
        },
      };
    }

    case ASSET_ACTIONS.MARK_DAMAGED:
      return {
        action: normalizedAction,
        status: ASSET_STATUSES.DAMAGED,
        assignedTo: asset.assignedTo,
        location: asset.location,
        metadata: {
          damagedFromStatus: asset.status,
          lifecycleAction: normalizedAction,
        },
      };

    case ASSET_ACTIONS.SEND_FOR_REPAIR: {
      const issue = assertRequiredText(payload.issue, "issue");
      const vendor = assertRequiredText(payload.vendor, "vendor");
      const cost = assertRequiredNumber(payload.cost, "cost");

      return {
        action: normalizedAction,
        status: ASSET_STATUSES.UNDER_REPAIR,
        assignedTo: null,
        location: asset.location,
        metadata: {
          repairIssue: issue,
          repairVendor: vendor,
          repairCost: cost,
          lifecycleAction: normalizedAction,
        },
      };
    }

    case ASSET_ACTIONS.RENT_OUT: {
      const customerName = assertRequiredText(payload.customerName, "customerName");
      const customerContact = assertRequiredText(payload.customerContact, "customerContact");
      const rentalStartDate = assertRequiredDate(payload.rentalStartDate, "rentalStartDate");
      const rentalEndDate = assertRequiredDate(payload.rentalEndDate, "rentalEndDate");
      const rentalCost = assertRequiredNumber(payload.rentalCost, "rentalCost");

      if (rentalEndDate < rentalStartDate) {
        throw new ApiError(400, "rentalEndDate must be on or after rentalStartDate");
      }

      return {
        action: normalizedAction,
        status: ASSET_STATUSES.RENTED_OUT,
        assignedTo: null,
        location: asset.location,
        metadata: {
          customerName,
          customerContact,
          rentalStartDate,
          rentalEndDate,
          rentalCost,
          lifecycleAction: normalizedAction,
        },
      };
    }

    case ASSET_ACTIONS.SELL: {
      const buyerName = assertRequiredText(payload.buyerName, "buyerName");
      const salePrice = assertRequiredNumber(payload.salePrice, "salePrice");
      const invoiceNumber = assertRequiredText(payload.invoiceNumber, "invoiceNumber");
      const saleDate = assertRequiredDate(payload.saleDate, "saleDate");

      return {
        action: normalizedAction,
        status: ASSET_STATUSES.SOLD,
        assignedTo: null,
        location: asset.location,
        metadata: {
          buyerName,
          salePrice,
          invoiceNumber,
          saleDate,
          lifecycleAction: normalizedAction,
        },
      };
    }

    case ASSET_ACTIONS.RETURN_DEVICE: {
      const status = asset.status === ASSET_STATUSES.DAMAGED ? ASSET_STATUSES.DAMAGED : ASSET_STATUSES.AVAILABLE;

      return {
        action: normalizedAction,
        status,
        assignedTo: null,
        location: asset.location,
        locationType: getAssetLocationType(asset),
        wfhAddress: getAssetWfhAddress(asset),
        metadata: {
          returnedFromStatus: asset.status,
          lifecycleAction: normalizedAction,
        },
      };
    }

    case ASSET_ACTIONS.MARK_LOST:
      return {
        action: normalizedAction,
        status: ASSET_STATUSES.LOST,
        assignedTo: null,
        location: asset.location,
        locationType: getAssetLocationType(asset),
        wfhAddress: getAssetWfhAddress(asset),
        metadata: {
          lostFromStatus: asset.status,
          lifecycleAction: normalizedAction,
        },
      };

    default:
      throw new ApiError(400, `Unsupported asset action: ${action}`);
  }
}

module.exports = {
  getAllowedActionsForStatus,
  getAllowedTransitionMessage,
  resolveActionReason,
  buildTransition,
  normalizeAction,
  getAssetLocationType,
  getAssetWfhAddress,
};
