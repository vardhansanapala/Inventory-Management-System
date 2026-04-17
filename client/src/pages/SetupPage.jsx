import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCategory,
  createLocation,
  createProduct,
  deleteCategory,
  deleteLocation,
  deleteProduct,
  getSetupBootstrap,
  updateCategory,
  updateLocation,
  updateProduct,
} from "../api/inventory";
import { ActionFeedback } from "../components/ActionFeedback";
import { DataTable } from "../components/DataTable";
import { FormInput, FormTextarea } from "../components/FormFields";
import { Modal } from "../components/Modal";
import { ActionMenu } from "../components/ActionMenu";
import { SectionCard } from "../components/SectionCard";
import { SearchInput } from "../components/SearchInput";
import { canManageFullSetup } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";
import { useActionFeedback } from "../hooks/useActionFeedback";

const emptySetupData = {
  categories: [],
  products: [],
  locations: [],
  users: [],
};

const SECTIONS = {
  CATEGORIES: "CATEGORIES",
  LOCATIONS: "LOCATIONS",
  PRODUCTS: "PRODUCTS",
};

export function SetupPage() {
  const { user } = useAuth();
  const [setupData, setSetupData] = useState(emptySetupData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [highlightedRowId, setHighlightedRowId] = useState("");
  const flashTimeoutRef = useRef(null);
  const isSuperAdmin = canManageFullSetup(user);
  const [activeSection, setActiveSection] = useState(SECTIONS.PRODUCTS);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryDescription, setEditCategoryDescription] = useState("");
  const [deletingCategory, setDeletingCategory] = useState(null);

  const [editingLocation, setEditingLocation] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [editLocationForm, setEditLocationForm] = useState({
    name: "",
    code: "",
    type: "OFFICE",
    address: "",
  });
  const [deletingLocation, setDeletingLocation] = useState(null);

  const [productSearch, setProductSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    categoryId: "",
    brand: "",
    model: "",
    sku: "",
    description: "",
  });
  const [deletingProduct, setDeletingProduct] = useState(null);
  const categoryFeedback = useActionFeedback();
  const locationFeedback = useActionFeedback();
  const productFeedback = useActionFeedback();
  const modalFeedback = useActionFeedback();
  const deleteFeedback = useActionFeedback();

  async function loadSetupData() {
    try {
      setLoadError("");
      setLoading(true);
      const data = await getSetupBootstrap();
      setSetupData({
        categories: Array.isArray(data?.categories) ? data.categories : [],
        products: Array.isArray(data?.products) ? data.products : [],
        locations: Array.isArray(data?.locations) ? data.locations : [],
        users: Array.isArray(data?.users) ? data.users : [],
      });
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSetupData();
  }, []);

  useEffect(() => () => {
    window.clearTimeout(flashTimeoutRef.current);
  }, []);

  function flashRow(rowId) {
    if (!rowId) return;
    setHighlightedRowId(rowId);
    window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => {
      setHighlightedRowId("");
    }, 1800);
  }

  async function runSetupAction({
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
        await loadSetupData();
        return value;
      },
      {
        loadingMsg,
        successMsg,
        errorMsg,
      }
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

  const pageTitle = useMemo(() => {
    return isSuperAdmin ? "Setup masters for products, locations, and categories." : "Product and SKU setup only.";
  }, [isSuperAdmin]);

  if (loading) {
    return <div className="page-message">Loading setup...</div>;
  }

  const normalizedCategorySearch = categorySearch.trim().toLowerCase();
  const normalizedLocationSearch = locationSearch.trim().toLowerCase();
  const normalizedProductSearch = productSearch.trim().toLowerCase();

  const filteredCategories = setupData.categories.filter((category) => {
    if (!normalizedCategorySearch) return true;
    const haystack = `${category.name || ""} ${category.description || ""}`.toLowerCase();
    return haystack.includes(normalizedCategorySearch);
  });

  const filteredLocations = setupData.locations.filter((location) => {
    if (!normalizedLocationSearch) return true;
    const haystack = `${location.name || ""} ${location.code || ""} ${location.type || ""} ${location.address || ""}`.toLowerCase();
    return haystack.includes(normalizedLocationSearch);
  });

  const filteredProducts = setupData.products.filter((product) => {
    if (!normalizedProductSearch) return true;
    const haystack = `${product.sku || ""} ${product.brand || ""} ${product.model || ""} ${product.category?.name || ""}`.toLowerCase();
    return haystack.includes(normalizedProductSearch);
  });

  const categoriesColumns = [
    { key: "name", header: "Name" },
    {
      key: "description",
      header: "Description",
      render: (row) => <span className="table-subtle">{row.description || "-"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) =>
        isSuperAdmin ? (
          <ActionMenu
            label="Category actions"
            items={[
              {
                id: "edit",
                label: "Edit",
                icon: "✏",
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
                icon: "🗑",
                danger: true,
                onClick: () => {
                  deleteFeedback.clear();
                  setDeletingCategory(row);
                },
              },
            ]}
          />
        ) : (
          <span className="table-subtle">—</span>
        ),
    },
  ];

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
      key: "actions",
      header: "Actions",
      render: (row) =>
        isSuperAdmin ? (
          <ActionMenu
            label="Location actions"
            items={[
              {
                id: "edit",
                label: "Edit",
                icon: "✏",
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
                icon: "🗑",
                danger: true,
                onClick: () => {
                  deleteFeedback.clear();
                  setDeletingLocation(row);
                },
              },
            ]}
          />
        ) : (
          <span className="table-subtle">—</span>
        ),
    },
  ];

  const productsColumns = [
    { key: "sku", header: "SKU" },
    { key: "brand", header: "Brand" },
    { key: "model", header: "Model" },
    { key: "category", header: "Category", render: (row) => row.category?.name || "-" },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <ActionMenu
          label="Product actions"
          items={[
            {
              id: "edit",
              label: "Edit Product",
              icon: "✏",
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
              icon: "🗑",
              danger: true,
              onClick: () => {
                deleteFeedback.clear();
                setDeletingProduct(row);
              },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page-stack">
      {loadError ? <div className="page-message error">{loadError}</div> : null}

      <SectionCard
        title="Setup"
        subtitle={pageTitle}
        actions={
          <div className="segmented-control" role="tablist" aria-label="Setup sections">
            {isSuperAdmin ? (
              <>
                <button
                  type="button"
                  className={activeSection === SECTIONS.CATEGORIES ? "is-active" : ""}
                  onClick={() => setActiveSection(SECTIONS.CATEGORIES)}
                >
                  Categories
                </button>
                <button
                  type="button"
                  className={activeSection === SECTIONS.LOCATIONS ? "is-active" : ""}
                  onClick={() => setActiveSection(SECTIONS.LOCATIONS)}
                >
                  Locations
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={activeSection === SECTIONS.PRODUCTS ? "is-active" : ""}
              onClick={() => setActiveSection(SECTIONS.PRODUCTS)}
            >
              Products / SKUs
            </button>
          </div>
        }
      >
        {activeSection === SECTIONS.CATEGORIES ? (
          <div className="page-stack">
            <SectionCard title="Categories" subtitle="Create categories, then manage them in the table below.">
              <div className="page-stack setup-section">
                <form
                  className="form-grid wide-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runSetupAction({
                      key: "create-category",
                      feedbackController: categoryFeedback,
                      loadingMsg: "Saving category...",
                      successMsg: "Category saved successfully.",
                      errorMsg: "Unable to save category.",
                      action: () =>
                        createCategory({
                          name: categoryName,
                          description: categoryDescription,
                        }),
                      afterSuccess: () => {
                        setCategoryName("");
                        setCategoryDescription("");
                      },
                    });
                  }}
                >
                  <FormInput
                    label="Category Name"
                    placeholder="ENTER CATEGORY NAME (UPPERCASE)"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value.toUpperCase())}
                    required
                  />
                  <FormTextarea
                    label="Description"
                    placeholder="Description"
                    value={categoryDescription}
                    onChange={(event) => setCategoryDescription(event.target.value)}
                    className="setup-textarea-align"
                  />
                  <div className="form-actions">
                    <button className="button dark button-rect with-spinner" type="submit" disabled={busyKey === "create-category" || !categoryName.trim()}>
                      {busyKey === "create-category" ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                      <span>{busyKey === "create-category" ? "Saving..." : "Add Category"}</span>
                    </button>
                  </div>
                </form>
                <ActionFeedback
                  type={categoryFeedback.feedback?.type}
                  message={categoryFeedback.feedback?.message}
                  autoDismissMs={categoryFeedback.feedback?.autoDismissMs}
                  onClose={categoryFeedback.clear}
                  className="action-feedback-inline"
                />

                <div className="setup-table-toolbar">
                  <SearchInput value={categorySearch} onChange={setCategorySearch} placeholder="Search categories..." />
                </div>

                <DataTable
                  columns={categoriesColumns}
                  rows={filteredCategories.map((category) => ({ ...category, key: category._id }))}
                  emptyMessage="No categories found."
                  getRowClassName={(row) => (highlightedRowId === row._id ? "row-flash" : "")}
                />
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeSection === SECTIONS.LOCATIONS ? (
          <div className="page-stack">
            <SectionCard title="Locations" subtitle="Create locations, then manage them in the table below.">
              <div className="page-stack setup-section">
                <form
                  className="form-grid wide-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runSetupAction({
                      key: "create-location",
                      feedbackController: locationFeedback,
                      loadingMsg: "Saving location...",
                      successMsg: "Location saved successfully.",
                      errorMsg: "Unable to save location.",
                      action: () => {
                        const formData = new FormData(event.target);
                        const payload = Object.fromEntries(formData.entries());
                        return createLocation(payload);
                      },
                      afterSuccess: () => event.target.reset(),
                    });
                  }}
                >
                  <FormInput label="Location Name" name="name" placeholder="Head Office" required />
                  <FormInput label="Code" name="code" placeholder="HO" required />
                  <label className="field-stack">
                    <span>Type</span>
                    <select className="input" name="type" defaultValue="OFFICE">
                      <option value="OFFICE">OFFICE</option>
                      <option value="WAREHOUSE">WAREHOUSE</option>
                      <option value="OUTSIDE">OUTSIDE</option>
                      <option value="SERVICE_CENTER">SERVICE_CENTER</option>
                    </select>
                  </label>
                  <FormTextarea label="Address" name="address" placeholder="Address" className="setup-textarea-align" />
                  <div className="form-actions">
                    <button className="button dark button-rect with-spinner" type="submit" disabled={busyKey === "create-location"}>
                      {busyKey === "create-location" ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                      <span>{busyKey === "create-location" ? "Saving..." : "Add Location"}</span>
                    </button>
                  </div>
                </form>
                <ActionFeedback
                  type={locationFeedback.feedback?.type}
                  message={locationFeedback.feedback?.message}
                  autoDismissMs={locationFeedback.feedback?.autoDismissMs}
                  onClose={locationFeedback.clear}
                  className="action-feedback-inline"
                />

                <div className="setup-table-toolbar">
                  <SearchInput value={locationSearch} onChange={setLocationSearch} placeholder="Search locations..." />
                </div>

                <DataTable
                  columns={locationsColumns}
                  rows={filteredLocations.map((location) => ({ ...location, key: location._id }))}
                  emptyMessage="No locations found."
                  getRowClassName={(row) => (highlightedRowId === row._id ? "row-flash" : "")}
                />
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeSection === SECTIONS.PRODUCTS ? (
          <div className="page-stack">
            {!isSuperAdmin ? (
              <div className="page-message">
                Categories and locations are intentionally hidden for admins. Only SKU creation is available here.
              </div>
            ) : null}

            <SectionCard title="Products / SKUs" subtitle="Relational SKU definitions linked to a category.">
              <form
                className="form-grid wide-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  runSetupAction({
                    key: "create-product",
                    feedbackController: productFeedback,
                    loadingMsg: "Saving product...",
                    successMsg: "Product saved successfully.",
                    errorMsg: "Unable to save product.",
                    action: () => {
                      const formData = new FormData(event.target);
                      const payload = Object.fromEntries(formData.entries());
                      return createProduct(payload);
                    },
                    afterSuccess: () => event.target.reset(),
                  });
                }}
              >
                <label className="field-stack">
                  <span>Category</span>
                  <select className="input" name="categoryId" required defaultValue="">
                    <option value="">Select category</option>
                    {setupData.categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <FormInput label="Brand" name="brand" placeholder="Dell" required />
                <FormInput label="Model" name="model" placeholder="Latitude 5420" required />
                <FormInput label="SKU" name="sku" placeholder="DELL-LAT-5420" required />
                <FormTextarea label="Description" name="description" placeholder="Description" />
                <div className="form-actions">
                  <button className="button dark button-rect with-spinner" type="submit" disabled={busyKey === "create-product"}>
                    {busyKey === "create-product" ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
                    <span>{busyKey === "create-product" ? "Saving..." : "Add Product"}</span>
                  </button>
                </div>
              </form>
              <ActionFeedback
                type={productFeedback.feedback?.type}
                message={productFeedback.feedback?.message}
                autoDismissMs={productFeedback.feedback?.autoDismissMs}
                onClose={productFeedback.clear}
                className="action-feedback-inline"
              />
            </SectionCard>

            <SectionCard title="Products Table" subtitle="Manage SKUs and their linked categories.">
              <div className="setup-table-toolbar">
                <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Search products..." />
              </div>
              <DataTable
                columns={productsColumns}
                rows={filteredProducts.map((product) => ({ ...product, key: product._id }))}
                emptyMessage="No products found."
                getRowClassName={(row) => (highlightedRowId === row._id ? "row-flash" : "")}
              />
            </SectionCard>
          </div>
        ) : null}
      </SectionCard>

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
                  runSetupAction({
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
                  runSetupAction({
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
            <select
              className="input"
              value={editLocationForm.type}
              onChange={(event) => setEditLocationForm({ ...editLocationForm, type: event.target.value })}
            >
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
                  runSetupAction({
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
            <select
              className="input"
              value={editProductForm.categoryId}
              onChange={(event) => setEditProductForm({ ...editProductForm, categoryId: event.target.value })}
            >
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
                  runSetupAction({
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
                  runSetupAction({
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
                  runSetupAction({
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
