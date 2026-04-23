import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteCategory, updateCategory } from "../api/inventory";
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
  sortItemsByLastUpdated,
  useDebouncedValue,
  useSetupPageContext,
} from "../components/setup/SetupShared";
import { useActionFeedback } from "../hooks/useActionFeedback";
import { getFullDateTime, getLastUpdatedValue, getRelativeTime, getSortableTime } from "../utils/date.util";

export function SetupCategoriesPage() {
  return (
    <SetupSectionGate requireSuperAdmin>
      <SetupCategoriesContent />
    </SetupSectionGate>
  );
}

function SetupCategoriesContent() {
  const navigate = useNavigate();
  const { setupData, refreshSetupData } = useSetupPageContext();
  const [busyKey, setBusyKey] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("ALL");
  const [sort, setSort] = useState("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [, forceRelativeRefresh] = useState(0);
  const [highlightedRowId, setHighlightedRowId] = useState("");
  const flashTimeoutRef = useRef(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryDescription, setEditCategoryDescription] = useState("");
  const [deletingCategory, setDeletingCategory] = useState(null);
  const modalFeedback = useActionFeedback();
  const deleteFeedback = useActionFeedback();
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    const id = window.setInterval(() => {
      forceRelativeRefresh((value) => value + 1);
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(flashTimeoutRef.current);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, descriptionFilter, sort]);

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

  const filteredCategories = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();

    const searchFiltered = normalizedSearch
      ? setupData.categories.filter((category) => String(category?.name || "").toLowerCase().includes(normalizedSearch))
      : setupData.categories;

    const dropdownFiltered = searchFiltered.filter((category) => {
      const hasDescription = Boolean(String(category?.description || "").trim());

      if (descriptionFilter === "WITH_DESCRIPTION") {
        return hasDescription;
      }

      if (descriptionFilter === "WITHOUT_DESCRIPTION") {
        return !hasDescription;
      }

      return true;
    });

    return sortItemsByLastUpdated(dropdownFiltered, sort);
  }, [debouncedSearch, descriptionFilter, setupData.categories, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / SETUP_PAGE_SIZE));
  const paginatedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * SETUP_PAGE_SIZE;
    return filteredCategories.slice(startIndex, startIndex + SETUP_PAGE_SIZE);
  }, [currentPage, filteredCategories]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const categoriesColumns = [
    { key: "name", header: "Name" },
    {
      key: "description",
      header: "Description",
      render: (row) => <span className="table-subtle">{row.description || "-"}</span>,
    },
    {
      key: "lastUpdated",
      header: "Last Updated",
      className: "table-date",
      render: (row) => {
        const date = getLastUpdatedValue(row);
        return (
          <span title={getFullDateTime(date)}>
            {getRelativeTime(date)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <ActionMenu
          label="Category actions"
          items={[
            {
              id: "edit",
              label: "Edit",
              icon: "E",
              onClick: () => {
                modalFeedback.clear();
                setEditingCategory(row);
                setEditCategoryName(row.name || "");
                setEditCategoryDescription(row.description || "");
              },
            },
            {
              id: "delete",
              label: "Delete",
              icon: "X",
              danger: true,
              onClick: () => {
                deleteFeedback.clear();
                setDeletingCategory(row);
              },
            },
          ]}
        />
      ),
    },
  ];

  const emptyMessage = getEmptyMessage(setupData.categories, filteredCategories);

  return (
    <div className="page-stack">
      <SetupToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search categories by name..."
        filters={
          <>
            <label className="field-stack setup-filter-field">
              <span>Description</span>
              <select className="input" value={descriptionFilter} onChange={(event) => setDescriptionFilter(event.target.value)}>
                <option value="ALL">ALL</option>
                <option value="WITH_DESCRIPTION">WITH DESCRIPTION</option>
                <option value="WITHOUT_DESCRIPTION">WITHOUT DESCRIPTION</option>
              </select>
            </label>
            <label className="field-stack setup-filter-field">
              <span>Sort</span>
              <select className="input" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="latest">Latest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
          </>
        }
        summary={`Showing ${paginatedCategories.length} of ${filteredCategories.length} categories`}
        action={
          <button className="button dark button-rect" type="button" onClick={() => navigate("/setup/categories/create")}>
            Create Category
          </button>
        }
      />

      <DataTable
        columns={categoriesColumns}
        rows={paginatedCategories.map((category) => ({ ...category, key: category._id }))}
        emptyMessage={emptyMessage}
        getRowClassName={(row) => {
          const classNames = [];
          if (highlightedRowId === row._id) classNames.push("row-flash");
          const updatedTime = getSortableTime(getLastUpdatedValue(row));
          if (updatedTime && Date.now() - updatedTime <= 5 * 60 * 1000) classNames.push("row-recent");
          return classNames.join(" ");
        }}
      />

      <SetupPagination currentPage={currentPage} totalItems={filteredCategories.length} onPageChange={setCurrentPage} />

      {editingCategory ? (
        <Modal
          title="Edit Category"
          subtitle="Update name and description. Name will be stored uppercase."
          onClose={() => setEditingCategory(null)}
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
              <button className="button ghost button-rect" type="button" onClick={() => setEditingCategory(null)} disabled={busyKey === `edit-category:${editingCategory._id}`}>
                Cancel
              </button>
              <button
                className="button dark button-rect with-spinner"
                type="button"
                disabled={busyKey === `edit-category:${editingCategory._id}` || !editCategoryName.trim()}
                onClick={() =>
                  runAction({
                    key: `edit-category:${editingCategory._id}`,
                    feedbackController: modalFeedback,
                    loadingMsg: "Saving category...",
                    successMsg: "Category updated successfully.",
                    errorMsg: "Unable to update category.",
                    rowId: editingCategory._id,
                    action: () =>
                      updateCategory(editingCategory._id, {
                        name: editCategoryName,
                        description: editCategoryDescription,
                      }),
                    afterSuccess: () => {
                      setEditingCategory(null);
                      modalFeedback.clear();
                    },
                  })
                }
              >
                {busyKey === `edit-category:${editingCategory._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `edit-category:${editingCategory._id}` ? "Saving..." : "Save"}</span>
              </button>
            </>
          }
        >
          <FormInput
            label="Name"
            placeholder="ENTER CATEGORY NAME (UPPERCASE)"
            value={editCategoryName}
            onChange={(event) => setEditCategoryName(event.target.value.toUpperCase())}
            required
          />
          <FormTextarea
            label="Description"
            placeholder="Description"
            value={editCategoryDescription}
            onChange={(event) => setEditCategoryDescription(event.target.value)}
          />
        </Modal>
      ) : null}

      {deletingCategory ? (
        <Modal
          title="Delete Category"
          subtitle="Are you sure you want to delete this category?"
          onClose={() => setDeletingCategory(null)}
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
              <button className="button ghost button-rect" type="button" onClick={() => setDeletingCategory(null)} disabled={busyKey === `delete-category:${deletingCategory._id}`}>
                Cancel
              </button>
              <button
                className="button danger button-rect with-spinner"
                type="button"
                onClick={() =>
                  runAction({
                    key: `delete-category:${deletingCategory._id}`,
                    feedbackController: deleteFeedback,
                    loadingMsg: "Deleting category...",
                    successMsg: "Category deleted successfully.",
                    errorMsg: "Unable to delete category.",
                    action: () => deleteCategory(deletingCategory._id),
                    afterSuccess: () => {
                      setDeletingCategory(null);
                      deleteFeedback.clear();
                    },
                  })
                }
                disabled={busyKey === `delete-category:${deletingCategory._id}`}
              >
                {busyKey === `delete-category:${deletingCategory._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `delete-category:${deletingCategory._id}` ? "Deleting..." : "Delete"}</span>
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
