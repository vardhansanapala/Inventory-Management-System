const { ACTION_REASONS, ASSET_ACTIONS, ASSET_STATUSES } = require("../constants/asset.constants");
const { ApiError } = require("../utils/ApiError");

const TERMINAL_STATUSES = new Set([ASSET_STATUSES.SOLD, ASSET_STATUSES.LOST]);

const ACTIONS_BY_STATUS = {
  [ASSET_STATUSES.AVAILABLE]: [
    ASSET_ACTIONS.ASSIGN_DEVICE,
    ASSET_ACTIONS.TRANSFER,
    ASSET_ACTIONS.SEND_OUTSIDE,
    ASSET_ACTIONS.SEND_FOR_REPAIR,
    ASSET_ACTIONS.RENT_DEVICE,
    ASSET_ACTIONS.SELL_DEVICE,
    ASSET_ACTIONS.MARK_LOST,
  ],
  [ASSET_STATUSES.ASSIGNED]: [ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.MARK_LOST],
  [ASSET_STATUSES.RENTED_OUT]: [ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.MARK_LOST],
  [ASSET_STATUSES.SENT_OUT]: [ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.MARK_LOST],
  [ASSET_STATUSES.OUTSIDE]: [ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.MARK_LOST],
  [ASSET_STATUSES.UNDER_REPAIR]: [ASSET_ACTIONS.RETURN_DEVICE, ASSET_ACTIONS.MARK_LOST],
  [ASSET_STATUSES.SOLD]: [],
  [ASSET_STATUSES.LOST]: [],
};

function getAllowedTransitionMessage(action, status) {
  return `Action ${action} is not allowed when asset status is ${status}`;
}

function getAllowedActionsForStatus(status) {
  return ACTIONS_BY_STATUS[status] || [];
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

function resolveActionReason(action, requestedReason) {
  switch (action) {
    case ASSET_ACTIONS.SEND_FOR_REPAIR:
      return ACTION_REASONS.REPAIR;
    case ASSET_ACTIONS.RENT_DEVICE:
      return ACTION_REASONS.RENTAL;
    case ASSET_ACTIONS.SELL_DEVICE:
      return ACTION_REASONS.SALE;
    case ASSET_ACTIONS.TRANSFER:
      return requestedReason || ACTION_REASONS.OTHER;
    case ASSET_ACTIONS.RETURN_DEVICE:
      return ACTION_REASONS.RETURN;
    default:
      return requestedReason || ACTION_REASONS.OTHER;
  }
}

function buildTransition({ asset, action, refs, payload, reason }) {
  assertAllowedAction(asset.status, action);

  if (TERMINAL_STATUSES.has(asset.status)) {
    throw new ApiError(409, getAllowedTransitionMessage(action, asset.status));
  }

  switch (action) {
    case ASSET_ACTIONS.ASSIGN_DEVICE: {
      if (!refs.assignedTo) {
        throw new ApiError(400, "assignedToId is required to assign a device");
      }

      return {
        status: ASSET_STATUSES.ASSIGNED,
        assignedTo: refs.assignedTo._id,
        location: asset.location,
        metadata: {
          assignedToId: String(refs.assignedTo._id),
          lifecycleAction: ASSET_ACTIONS.ASSIGN_DEVICE,
        },
      };
    }

    case ASSET_ACTIONS.TRANSFER: {
      if (!refs.location) {
        throw new ApiError(400, "toLocation is required to transfer a device");
      }

      const allowedReasons = new Set([
        ACTION_REASONS.RELOCATION,
        ACTION_REASONS.STORAGE,
        ACTION_REASONS.INTERNAL_USE,
        ACTION_REASONS.OTHER,
      ]);
      if (!allowedReasons.has(reason)) {
        throw new ApiError(400, "reason must be one of RELOCATION, STORAGE, INTERNAL_USE, or OTHER");
      }

      return {
        status: asset.status,
        assignedTo: asset.assignedTo,
        location: refs.location._id,
        metadata: {
          fromLocationId: asset.location ? String(asset.location) : null,
          toLocationId: String(refs.location._id),
          transferReason: reason,
          lifecycleAction: ASSET_ACTIONS.TRANSFER,
        },
      };
    }

    case ASSET_ACTIONS.SEND_OUTSIDE: {
      if (!refs.location) {
        throw new ApiError(400, "locationId is required to send a device outside");
      }

      return {
        status: ASSET_STATUSES.SENT_OUT,
        assignedTo: null,
        location: refs.location._id,
        metadata: {
          sentOutLocationId: String(refs.location._id),
          lifecycleAction: ASSET_ACTIONS.SEND_OUTSIDE,
        },
      };
    }

    case ASSET_ACTIONS.SEND_FOR_REPAIR: {
      const issue = assertRequiredText(payload.issue, "issue");
      const vendor = assertRequiredText(payload.vendor, "vendor");
      const cost = assertRequiredNumber(payload.cost, "cost");

      return {
        status: ASSET_STATUSES.UNDER_REPAIR,
        assignedTo: null,
        location: asset.location,
        metadata: {
          repairIssue: issue,
          repairVendor: vendor,
          repairCost: cost,
          lifecycleAction: ASSET_ACTIONS.SEND_FOR_REPAIR,
        },
      };
    }

    case ASSET_ACTIONS.RENT_DEVICE: {
      const customerName = assertRequiredText(payload.customerName, "customerName");
      const customerContact = assertRequiredText(payload.customerContact, "customerContact");
      const rentalStartDate = assertRequiredDate(payload.rentalStartDate, "rentalStartDate");
      const rentalEndDate = assertRequiredDate(payload.rentalEndDate, "rentalEndDate");
      const rentalCost = assertRequiredNumber(payload.rentalCost, "rentalCost");

      if (rentalEndDate < rentalStartDate) {
        throw new ApiError(400, "rentalEndDate must be on or after rentalStartDate");
      }

      return {
        status: ASSET_STATUSES.RENTED_OUT,
        assignedTo: null,
        location: asset.location,
        metadata: {
          customerName,
          customerContact,
          rentalStartDate,
          rentalEndDate,
          rentalCost,
          lifecycleAction: ASSET_ACTIONS.RENT_DEVICE,
        },
      };
    }

    case ASSET_ACTIONS.SELL_DEVICE: {
      const buyerName = assertRequiredText(payload.buyerName, "buyerName");
      const salePrice = assertRequiredNumber(payload.salePrice, "salePrice");
      const invoiceNumber = assertRequiredText(payload.invoiceNumber, "invoiceNumber");
      const saleDate = assertRequiredDate(payload.saleDate, "saleDate");

      return {
        status: ASSET_STATUSES.SOLD,
        assignedTo: null,
        location: asset.location,
        metadata: {
          buyerName,
          salePrice,
          invoiceNumber,
          saleDate,
          lifecycleAction: ASSET_ACTIONS.SELL_DEVICE,
        },
      };
    }

    case ASSET_ACTIONS.RETURN_DEVICE:
      return {
        status: ASSET_STATUSES.AVAILABLE,
        assignedTo: null,
        location: asset.location,
        metadata: {
          returnedFromStatus: asset.status,
          lifecycleAction: ASSET_ACTIONS.RETURN_DEVICE,
        },
      };

    case ASSET_ACTIONS.MARK_LOST:
      return {
        status: ASSET_STATUSES.LOST,
        assignedTo: null,
        location: asset.location,
        metadata: {
          lostFromStatus: asset.status,
          lifecycleAction: ASSET_ACTIONS.MARK_LOST,
        },
      };

    default:
      throw new ApiError(400, `Unsupported asset action: ${action}`);
  }
}

module.exports = {
  ACTIONS_BY_STATUS,
  getAllowedActionsForStatus,
  getAllowedTransitionMessage,
  resolveActionReason,
  buildTransition,
};
