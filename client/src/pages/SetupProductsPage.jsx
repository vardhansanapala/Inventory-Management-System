import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteProduct, updateProduct } from "../api/inventory";
import { ActionFeedback } from "../components/ActionFeedback";
import { ActionMenu } from "../components/ActionMenu";
import { DataTable } from "../components/DataTable";
import { FormInput, FormTextarea } from "../components/FormFields";
import { Modal } from "../components/Modal";
import {
  SetupPagination,
  SetupToolbar,
  SETUP_PAGE_SIZE,
  getEmptyMessage,
  sortItemsByLastUpdated,
  useDebouncedValue,
  useSetupPageContext,
} from "../components/setup/SetupShared";
import { PERMISSIONS, hasPermission } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";
import { useActionFeedback } from "../hooks/useActionFeedback";
import { getFullDateTime, getLastUpdatedValue, getRelativeTime, getSortableTime } from "../utils/date.util";

export function SetupProductsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { setupData, refreshSetupData, isSuperAdmin } = useSetupPageContext();
  const [busyKey, setBusyKey] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [sort, setSort] = useState("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [, forceRelativeRefresh] = useState(0);
  const [highlightedRowId, setHighlightedRowId] = useState("");
  const flashTimeoutRef = useRef(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    categoryId: "",
    brand: "",
    model: "",
    sku: "",
    description: "",
  });
  const [deletingProduct, setDeletingProduct] = useState(null);
  const modalFeedback = useActionFeedback();
  const deleteFeedback = useActionFeedback();
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const canCreateProduct = hasPermission(currentUser, PERMISSIONS.CREATE_PRODUCT);
  const canEditProduct = hasPermission(currentUser, PERMISSIONS.EDIT_PRODUCT);
  const canDeleteProduct = hasPermission(currentUser, PERMISSIONS.DELETE_PRODUCT);

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
  }, [debouncedSearch, categoryFilter, brandFilter, sort]);

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

  const brandOptions = useMemo(() => {
    return Array.from(
      new Set(
        setupData.products
          .map((product) => String(product?.brand || "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [setupData.products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();

    const searchFiltered = normalizedSearch
      ? setupData.products.filter((product) => {
          const haystack = `${product?.sku || ""} ${product?.model || ""}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })
      : setupData.products;

    const categoryFiltered = categoryFilter === "ALL"
      ? searchFiltered
      : searchFiltered.filter((product) => product.category?._id === categoryFilter);

    const brandFiltered = brandFilter === "ALL"
      ? categoryFiltered
      : categoryFiltered.filter((product) => String(product.brand || "").trim() === brandFilter);

    return sortItemsByLastUpdated(brandFiltered, sort);
  }, [brandFilter, categoryFilter, debouncedSearch, setupData.products, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / SETUP_PAGE_SIZE));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * SETUP_PAGE_SIZE;
    return filteredProducts.slice(startIndex, startIndex + SETUP_PAGE_SIZE);
  }, [currentPage, filteredProducts]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const productsColumns = [
    { key: "sku", header: "SKU" },
    { key: "brand", header: "Brand" },
    { key: "model", header: "Model" },
    { key: "category", header: "Category", render: (row) => row.category?.name || "-" },
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
      render: (row) => {
        if (!canEditProduct && !canDeleteProduct) {
          return <span className="table-subtle">-</span>;
        }

        return (
          <ActionMenu
            label="Product actions"
            items={[
              {
                id: "edit",
                label: "Edit Product",
                icon: "E",
                hidden: !canEditProduct,
                onClick: () => {
                  modalFeedback.clear();
                  setEditingProduct(row);
                  setEditProductForm({
                    categoryId: row.category?._id || "",
                    brand: row.brand || "",
                    model: row.model || "",
                    sku: row.sku || "",
                    description: row.description || "",
                  });
                },
              },
              {
                id: "delete",
                label: "Delete Product",
                icon: "X",
                danger: true,
                hidden: !canDeleteProduct,
                onClick: () => {
                  deleteFeedback.clear();
                  setDeletingProduct(row);
                },
              },
            ]}
          />
        );
      },
    },
  ];

  const emptyMessage = getEmptyMessage(setupData.products, filteredProducts);

  return (
    <div className="page-stack">
      {!isSuperAdmin ? (
        <div className="page-message">
          Categories and locations are intentionally hidden for admins. Only SKU creation is available here.
        </div>
      ) : null}

      <SetupToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by SKU or model..."
        filters={
          <>
            <label className="field-stack setup-filter-field">
              <span>Category</span>
              <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="ALL">ALL</option>
                {setupData.categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack setup-filter-field">
              <span>Brand</span>
              <select className="input" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
                <option value="ALL">ALL</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
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
        summary={`Showing ${paginatedProducts.length} of ${filteredProducts.length} products`}
        action={
          canCreateProduct ? (
            <button className="button dark button-rect" type="button" onClick={() => navigate("/setup/products/create")}>
              Create Product
            </button>
          ) : null
        }
      />

      <DataTable
        columns={productsColumns}
        rows={paginatedProducts.map((product) => ({ ...product, key: product._id }))}
        emptyMessage={emptyMessage}
        getRowClassName={(row) => {
          const classNames = [];
          if (highlightedRowId === row._id) classNames.push("row-flash");
          const updatedTime = getSortableTime(getLastUpdatedValue(row));
          if (updatedTime && Date.now() - updatedTime <= 5 * 60 * 1000) classNames.push("row-recent");
          return classNames.join(" ");
        }}
      />

      <SetupPagination currentPage={currentPage} totalItems={filteredProducts.length} onPageChange={setCurrentPage} />

      {editingProduct ? (
        <Modal
          title="Edit Product"
          subtitle="Update product fields."
          onClose={() => setEditingProduct(null)}
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
              <button className="button ghost button-rect" type="button" onClick={() => setEditingProduct(null)} disabled={busyKey === `edit-product:${editingProduct._id}`}>
                Cancel
              </button>
              <button
                className="button dark button-rect with-spinner"
                type="button"
                disabled={busyKey === `edit-product:${editingProduct._id}` || !editProductForm.sku.trim() || !editProductForm.brand.trim() || !editProductForm.model.trim() || !editProductForm.categoryId}
                onClick={() =>
                  runAction({
                    key: `edit-product:${editingProduct._id}`,
                    feedbackController: modalFeedback,
                    loadingMsg: "Saving product...",
                    successMsg: "Product updated successfully.",
                    errorMsg: "Unable to update product.",
                    rowId: editingProduct._id,
                    action: () => updateProduct(editingProduct._id, editProductForm),
                    afterSuccess: () => {
                      setEditingProduct(null);
                      modalFeedback.clear();
                    },
                  })
                }
              >
                {busyKey === `edit-product:${editingProduct._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `edit-product:${editingProduct._id}` ? "Saving..." : "Save"}</span>
              </button>
            </>
          }
        >
          <label className="field-stack">
            <span>Category</span>
            <select className="input" value={editProductForm.categoryId} onChange={(event) => setEditProductForm({ ...editProductForm, categoryId: event.target.value })}>
              <option value="">Select category</option>
              {setupData.categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <FormInput
            label="Brand"
            value={editProductForm.brand}
            onChange={(event) => setEditProductForm({ ...editProductForm, brand: event.target.value })}
            required
          />
          <FormInput
            label="Model"
            value={editProductForm.model}
            onChange={(event) => setEditProductForm({ ...editProductForm, model: event.target.value })}
            required
          />
          <FormInput
            label="SKU"
            value={editProductForm.sku}
            onChange={(event) => setEditProductForm({ ...editProductForm, sku: event.target.value.toUpperCase() })}
            required
          />
          <FormTextarea
            label="Description"
            value={editProductForm.description}
            onChange={(event) => setEditProductForm({ ...editProductForm, description: event.target.value })}
          />
        </Modal>
      ) : null}

      {deletingProduct ? (
        <Modal
          title="Delete Product"
          subtitle="Are you sure you want to delete this product?"
          onClose={() => setDeletingProduct(null)}
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
              <button className="button ghost button-rect" type="button" onClick={() => setDeletingProduct(null)} disabled={busyKey === `delete-product:${deletingProduct._id}`}>
                Cancel
              </button>
              <button
                className="button danger button-rect with-spinner"
                type="button"
                onClick={() =>
                  runAction({
                    key: `delete-product:${deletingProduct._id}`,
                    feedbackController: deleteFeedback,
                    loadingMsg: "Deleting product...",
                    successMsg: "Product deleted successfully.",
                    errorMsg: "Unable to delete product.",
                    action: () => deleteProduct(deletingProduct._id),
                    afterSuccess: () => {
                      setDeletingProduct(null);
                      deleteFeedback.clear();
                    },
                  })
                }
                disabled={busyKey === `delete-product:${deletingProduct._id}`}
              >
                {busyKey === `delete-product:${deletingProduct._id}` ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                <span>{busyKey === `delete-product:${deletingProduct._id}` ? "Deleting..." : "Delete"}</span>
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
