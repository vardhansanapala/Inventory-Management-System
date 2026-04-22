import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteLocation, updateLocation } from "../api/inventory";
import { ActionFeedback } from "../components/ActionFeedback";
import { ActionMenu } from "../components/ActionMenu";
import { DataTable } from "../components/DataTable";
import { FormInput, FormTextarea } from "../components/FormFields";
import { Modal } from "../components/Modal";
import {
  SetupPagination,
  SetupSectionGate,
  SetupToolbar,
  SETUP_PAGE_SIZE,
  getEmptyMessage,
  sortItemsLatestFirst,
  useDebouncedValue,
  useSetupPageContext,
} from "../components/setup/SetupShared";
import { useActionFeedback } from "../hooks/useActionFeedback";

export function SetupLocationsPage() {
  return (
    <SetupSectionGate requireSuperAdmin>
      <SetupLocationsContent />
    </SetupSectionGate>
  );
}

function SetupLocationsContent() {
  const navigate = useNavigate();
  const { setupData, refreshSetupData } = useSetupPageContext();
  const [busyKey, setBusyKey] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedRowId, setHighlightedRowId] = useState("");
  const flashTimeoutRef = useRef(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editLocationForm, setEditLocationForm] = useState({
    name: "",
    code: "",
    type: "OFFICE",
    address: "",
  });
  const [deletingLocation, setDeletingLocation] = useState(null);
  const modalFeedback = useActionFeedback();
  const deleteFeedback = useActionFeedback();
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => () => {
    window.clearTimeout(flashTimeoutRef.current);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, typeFilter]);

  function flashRow(rowId) {
    if (!rowId) return;
    setHighlightedRowId(rowId);
    window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => {
      setHighlightedRowId("");
    }, 1800);
  }

  async function runAction({
    key,
    feedbackController,
    action,
    loadingMsg,
    successMsg,
    errorMsg,
    rowId,
    afterSuccess,
  }) {
    setBusyKey(key);
    const result = await feedbackController.handleAsyncAction(
      async () => {
        const value = await action();
        await refreshSetupData();
        return value;
      },
      { loadingMsg, successMsg, errorMsg }
    );

    if (result && rowId) {
      flashRow(rowId);
    }

    if (result) {
      afterSuccess?.(result);
    }

    setBusyKey("");
    return result;
  }

  const filteredLocations = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();

    const searchFiltered = normalizedSearch
      ? setupData.locations.filter((location) => {
          const haystack = `${location?.name || ""} ${location?.code || ""} ${location?.address || ""}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })
      : setupData.locations;

    const dropdownFiltered = typeFilter === "ALL"
      ? searchFiltered
      : searchFiltered.filter((location) => location.type === typeFilter);

    return sortItemsLatestFirst(dropdownFiltered);
  }, [debouncedSearch, setupData.locations, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLocations.length / SETUP_PAGE_SIZE));
  const paginatedLocations = useMemo(() => {
    const startIndex = (currentPage - 1) * SETUP_PAGE_SIZE;
    return filteredLocations.slice(startIndex, startIndex + SETUP_PAGE_SIZE);
  }, [currentPage, filteredLocations]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const locationsColumns = [
    { key: "name", header: "Name" },
    { key: "code", header: "Code" },
    { key: "type", header: "Type" },
    {
      key: "address",
      header: "Address",
      render: (row) => <span className="table-subtle">{row.address || "-"}</span>,
    },
    {
      key: "updatedAt",
      header: "Last Updated",
      render: (row) => <span className="table-subtle">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <ActionMenu
          label="Location actions"
          items={[
            {
              id: "edit",
              label: "Edit",
              icon: "E",
              onClick: () => {
                modalFeedback.clear();
                setEditingLocation(row);
                setEditLocationForm({
                  name: row.name || "",
                  code: row.code || "",
                  type: row.type || "OFFICE",
                  address: row.address || "",
                });
              },
            },
            {
              id: "delete",
              label: "Delete",
              icon: "X",
              danger: true,
              onClick: () => {
                deleteFeedback.clear();
                setDeletingLocation(row);
              },
            },
          ]}
        />
      ),
    },
  ];

  const emptyMessage = getEmptyMessage(setupData.locations, filteredLocations);

  return (
    <div className="page-stack">
      <SetupToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by name, code, or address..."
        filters={
          <label className="field-stack setup-filter-field">
            <span>Type</span>
            <select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="ALL">ALL</option>
              <option value="OFFICE">OFFICE</option>
              <option value="WAREHOUSE">WAREHOUSE</option>
              <option value="SERVICE_CENTER">SERVICE_CENTER</option>
            </select>
          </label>
        }
        summary={`Showing ${paginatedLocations.length} of ${filteredLocations.length} locations`}
        action={
          <button className="button dark button-rect" type="button" onClick={() => navigate("/setup/locations/create")}>
            Create Location
          </button>
        }
      />

      <DataTable
        columns={locationsColumns}
        rows={paginatedLocations.map((location) => ({ ...location, key: location._id }))}
        emptyMessage={emptyMessage}
        getRowClassName={(row) => (highlightedRowId === row._id ? "row-flash" : "")}
      />

      <SetupPagination currentPage={currentPage} totalItems={filteredLocations.length} onPageChange={setCurrentPage} />

      {editingLocation ? (
        <Modal
          title="Edit Location"
          subtitle="Update location fields."
          onClose={() => setEditingLocation(null)}
          feedback={
            <ActionFeedback
              type={modalFeedback.feedback?.type}
              message={modalFeedback.feedback?.message}
              autoDismissMs={modalFeedback.feedback?.autoDismissMs}
              onClose={modalFeedback.clear}
              className="action-feedback-inline"
            />
          }
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setEditingLocation(null)} disabled={busyKey === `edit-location:${editingLocation._id}`}>
                Cancel
              </button>
              <button
                className="button dark button-rect with-spinner"
                type="button"
                disabled={busyKey === `edit-location:${editingLocation._id}` || !editLocationForm.name.trim() || !editLocationForm.code.trim()}
                onClick={() =>
                  runAction({
                    key: `edit-location:${editingLocation._id}`,
                    feedbackController: modalFeedback,
                    loadingMsg: "Saving location...",
                    successMsg: "Location updated successfully.",
                    errorMsg: "Unable to update location.",
                    rowId: editingLocation._id,
                    action: () => updateLocation(editingLocation._id, editLocationForm),
                    afterSuccess: () => {
                      setEditingLocation(null);
                      modalFeedback.clear();
                    },
                  })
                }
              >
                {busyKey === `edit-location:${editingLocation._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `edit-location:${editingLocation._id}` ? "Saving..." : "Save"}</span>
              </button>
            </>
          }
        >
          <FormInput
            label="Location Name"
            value={editLocationForm.name}
            onChange={(event) => setEditLocationForm({ ...editLocationForm, name: event.target.value })}
            required
          />
          <FormInput
            label="Code"
            value={editLocationForm.code}
            onChange={(event) => setEditLocationForm({ ...editLocationForm, code: event.target.value.toUpperCase() })}
            required
          />
          <label className="field-stack">
            <span>Type</span>
            <select className="input" value={editLocationForm.type} onChange={(event) => setEditLocationForm({ ...editLocationForm, type: event.target.value })}>
              <option value="OFFICE">OFFICE</option>
              <option value="WAREHOUSE">WAREHOUSE</option>
              <option value="OUTSIDE">OUTSIDE</option>
              <option value="SERVICE_CENTER">SERVICE_CENTER</option>
            </select>
          </label>
          <FormTextarea
            label="Address"
            value={editLocationForm.address}
            onChange={(event) => setEditLocationForm({ ...editLocationForm, address: event.target.value })}
          />
        </Modal>
      ) : null}

      {deletingLocation ? (
        <Modal
          title="Delete Location"
          subtitle="Are you sure you want to delete this location?"
          onClose={() => setDeletingLocation(null)}
          feedback={
            <ActionFeedback
              type={deleteFeedback.feedback?.type}
              message={deleteFeedback.feedback?.message}
              autoDismissMs={deleteFeedback.feedback?.autoDismissMs}
              onClose={deleteFeedback.clear}
              className="action-feedback-inline"
            />
          }
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setDeletingLocation(null)} disabled={busyKey === `delete-location:${deletingLocation._id}`}>
                Cancel
              </button>
              <button
                className="button danger button-rect with-spinner"
                type="button"
                onClick={() =>
                  runAction({
                    key: `delete-location:${deletingLocation._id}`,
                    feedbackController: deleteFeedback,
                    loadingMsg: "Deleting location...",
                    successMsg: "Location deleted successfully.",
                    errorMsg: "Unable to delete location.",
                    action: () => deleteLocation(deletingLocation._id),
                    afterSuccess: () => {
                      setDeletingLocation(null);
                      deleteFeedback.clear();
                    },
                  })
                }
                disabled={busyKey === `delete-location:${deletingLocation._id}`}
              >
                {busyKey === `delete-location:${deletingLocation._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `delete-location:${deletingLocation._id}` ? "Deleting..." : "Delete"}</span>
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
