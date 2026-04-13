const { ACTION_REASONS, ASSET_ACTIONS, ASSET_STATUSES } = require("../constants/asset.constants");
const { ApiError } = require("../utils/ApiError");

const EXTERNAL_OUTSIDE_REASONS = new Set([
  ACTION_REASONS.RENTAL,
  ACTION_REASONS.SALE,
  ACTION_REASONS.WFH,
  ACTION_REASONS.VENDOR,
]);

const ACTIONS_BY_STATUS = {
  [ASSET_STATUSES.AVAILABLE]: [
    ASSET_ACTIONS.ASSIGN_DEVICE,
    ASSET_ACTIONS.SEND_OUTSIDE,
    ASSET_ACTIONS.SEND_FOR_REPAIR,
    ASSET_ACTIONS.MARK_LOST,
  ],
  [ASSET_STATUSES.ASSIGNED]: [
    ASSET_ACTIONS.UNASSIGN_DEVICE,
    ASSET_ACTIONS.SEND_OUTSIDE,
    ASSET_ACTIONS.MARK_LOST,
  ],
  [ASSET_STATUSES.OUTSIDE]: [
    ASSET_ACTIONS.RETURN_DEVICE,
    ASSET_ACTIONS.SELL_DEVICE,
    ASSET_ACTIONS.MARK_LOST,
  ],
  [ASSET_STATUSES.UNDER_REPAIR]: [
    ASSET_ACTIONS.COMPLETE_REPAIR,
    ASSET_ACTIONS.MARK_LOST,
  ],
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

function buildTransition({ asset, action, refs, payload, reason }) {
  assertAllowedAction(asset.status, action);

  switch (action) {
    case ASSET_ACTIONS.ASSIGN_DEVICE:
      if (!refs.assignedTo) {
        throw new ApiError(400, "assignedToId is required to assign a device");
      }

      return {
        status: ASSET_STATUSES.ASSIGNED,
        assignedTo: refs.assignedTo._id,
        location: refs.location ? refs.location._id : asset.location,
        metadata: {
          assignedToId: String(refs.assignedTo._id),
        },
      };

    case ASSET_ACTIONS.UNASSIGN_DEVICE:
      return {
        status: ASSET_STATUSES.AVAILABLE,
        assignedTo: null,
        location: refs.location ? refs.location._id : asset.location,
        metadata: {},
      };

    case ASSET_ACTIONS.SEND_OUTSIDE:
      if (asset.status === ASSET_STATUSES.AVAILABLE) {
        const externalRecipient = String(payload.externalRecipient || "").trim();

        if (!externalRecipient) {
          throw new ApiError(400, "externalRecipient is required when sending an available asset outside");
        }

        if (!EXTERNAL_OUTSIDE_REASONS.has(reason)) {
          throw new ApiError(400, "reason must be one of RENTAL, SALE, WFH, or VENDOR when sending an available asset outside");
        }

        return {
          status: ASSET_STATUSES.OUTSIDE,
          assignedTo: null,
          location: refs.location ? refs.location._id : asset.location,
          metadata: {
            externalRecipient,
            outsideReason: reason,
          },
        };
      }

      return {
        status: ASSET_STATUSES.OUTSIDE,
        assignedTo: asset.assignedTo,
        location: refs.location ? refs.location._id : asset.location,
        metadata: {
          outsideReason: reason,
          assigneeId: asset.assignedTo ? String(asset.assignedTo) : null,
        },
      };

    case ASSET_ACTIONS.RETURN_DEVICE:
      return {
        status: ASSET_STATUSES.AVAILABLE,
        assignedTo: null,
        location: refs.location ? refs.location._id : asset.location,
        metadata: {},
      };

    case ASSET_ACTIONS.SELL_DEVICE:
      return {
        status: ASSET_STATUSES.SOLD,
        assignedTo: null,
        location: refs.location ? refs.location._id : asset.location,
        metadata: {
          saleReason: reason,
        },
      };

    case ASSET_ACTIONS.SEND_FOR_REPAIR:
      return {
        status: ASSET_STATUSES.UNDER_REPAIR,
        assignedTo: null,
        location: refs.location ? refs.location._id : asset.location,
        metadata: {},
      };

    case ASSET_ACTIONS.COMPLETE_REPAIR:
      return {
        status: ASSET_STATUSES.AVAILABLE,
        assignedTo: null,
        location: refs.location ? refs.location._id : asset.location,
        metadata: {},
      };

    case ASSET_ACTIONS.MARK_LOST:
      return {
        status: ASSET_STATUSES.LOST,
        assignedTo: null,
        location: refs.location ? refs.location._id : asset.location,
        metadata: {},
      };

    default:
      throw new ApiError(400, `Unsupported asset action: ${action}`);
  }
}

module.exports = {
  EXTERNAL_OUTSIDE_REASONS,
  getAllowedActionsForStatus,
  getAllowedTransitionMessage,
  buildTransition,
};
