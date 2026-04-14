import { useEffect, useMemo, useState } from "react";
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
import { DataTable } from "../components/DataTable";
import { FormInput, FormTextarea } from "../components/FormFields";
import { Modal } from "../components/Modal";
import { ActionMenu } from "../components/ActionMenu";
import { SectionCard } from "../components/SectionCard";
import { SearchInput } from "../components/SearchInput";
import { canManageFullSetup } from "../constants/permissions";
import { useAuth } from "../context/AuthContext";

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
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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

  async function loadSetupData() {
    try {
      setError("");
      setLoading(true);
      const data = await getSetupBootstrap();
      setSetupData({
        categories: Array.isArray(data?.categories) ? data.categories : [],
        products: Array.isArray(data?.products) ? data.products : [],
        locations: Array.isArray(data?.locations) ? data.locations : [],
        users: Array.isArray(data?.users) ? data.users : [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSetupData();
  }, []);

  async function handleSubmit(event, submitter, successMessage, afterSuccess = null) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      await submitter();
      await loadSetupData();
      if (typeof afterSuccess === "function") {
        afterSuccess();
      }
      setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
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
                onClick: () => setDeletingCategory(row),
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
                onClick: () => setDeletingLocation(row),
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
              onClick: () => setDeletingProduct(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="page-stack">
      {message ? <div className="page-message success">{message}</div> : null}
      {error ? <div className="page-message error">{error}</div> : null}

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
                  onSubmit={(event) =>
                    handleSubmit(
                      event,
                      () =>
                        createCategory({
                          name: categoryName,
                          description: categoryDescription,
                        }),
                      "Category saved successfully.",
                      () => {
                        setCategoryName("");
                        setCategoryDescription("");
                      }
                    )
                  }
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
                    <button className="button dark button-rect" type="submit" disabled={submitting || !categoryName.trim()}>
                      {submitting ? "Saving..." : "Add Category"}
                    </button>
                  </div>
                </form>

                <div className="setup-table-toolbar">
                  <SearchInput value={categorySearch} onChange={setCategorySearch} placeholder="Search categories..." />
                </div>

                <DataTable
                  columns={categoriesColumns}
                  rows={filteredCategories.map((category) => ({ ...category, key: category._id }))}
                  emptyMessage="No categories found."
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
                  onSubmit={(event) =>
                    handleSubmit(
                      event,
                      () => {
                        const formData = new FormData(event.target);
                        const payload = Object.fromEntries(formData.entries());
                        return createLocation(payload);
                      },
                      "Location saved successfully.",
                      () => event.target.reset()
                    )
                  }
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
                    <button className="button dark button-rect" type="submit" disabled={submitting}>
                      {submitting ? "Saving..." : "Add Location"}
                    </button>
                  </div>
                </form>

                <div className="setup-table-toolbar">
                  <SearchInput value={locationSearch} onChange={setLocationSearch} placeholder="Search locations..." />
                </div>

                <DataTable
                  columns={locationsColumns}
                  rows={filteredLocations.map((location) => ({ ...location, key: location._id }))}
                  emptyMessage="No locations found."
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
                onSubmit={(event) =>
                  handleSubmit(
                    event,
                    () => {
                      const formData = new FormData(event.target);
                      const payload = Object.fromEntries(formData.entries());
                      return createProduct(payload);
                    },
                    "Product saved successfully.",
                    () => event.target.reset()
                  )
                }
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
                  <button className="button dark button-rect" type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Add Product"}
                  </button>
                </div>
              </form>
            </SectionCard>

            <SectionCard title="Products Table" subtitle="Manage SKUs and their linked categories.">
              <div className="setup-table-toolbar">
                <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Search products..." />
              </div>
              <DataTable
                columns={productsColumns}
                rows={filteredProducts.map((product) => ({ ...product, key: product._id }))}
                emptyMessage="No products found."
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setEditingCategory(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                className="button dark button-rect"
                type="button"
                disabled={submitting || !editCategoryName.trim()}
                onClick={() =>
                  handleSubmit(
                    { preventDefault: () => {} },
                    () =>
                      updateCategory(editingCategory._id, {
                        name: editCategoryName,
                        description: editCategoryDescription,
                      }),
                    "Category updated successfully.",
                    () => setEditingCategory(null)
                  )
                }
              >
                {submitting ? "Saving..." : "Save"}
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setEditingLocation(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                className="button dark button-rect"
                type="button"
                disabled={submitting || !editLocationForm.name.trim() || !editLocationForm.code.trim()}
                onClick={() =>
                  handleSubmit(
                    { preventDefault: () => {} },
                    () => updateLocation(editingLocation._id, editLocationForm),
                    "Location updated successfully.",
                    () => setEditingLocation(null)
                  )
                }
              >
                {submitting ? "Saving..." : "Save"}
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setEditingProduct(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                className="button dark button-rect"
                type="button"
                disabled={submitting || !editProductForm.sku.trim() || !editProductForm.brand.trim() || !editProductForm.model.trim() || !editProductForm.categoryId}
                onClick={() =>
                  handleSubmit(
                    { preventDefault: () => {} },
                    () => updateProduct(editingProduct._id, editProductForm),
                    "Product updated successfully.",
                    () => setEditingProduct(null)
                  )
                }
              >
                {submitting ? "Saving..." : "Save"}
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setDeletingCategory(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                className="button danger button-rect"
                type="button"
                onClick={() =>
                  handleSubmit(
                    { preventDefault: () => {} },
                    () => deleteCategory(deletingCategory._id),
                    "Category deleted successfully.",
                    () => setDeletingCategory(null)
                  )
                }
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Delete"}
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setDeletingLocation(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                className="button danger button-rect"
                type="button"
                onClick={() =>
                  handleSubmit(
                    { preventDefault: () => {} },
                    () => deleteLocation(deletingLocation._id),
                    "Location deleted successfully.",
                    () => setDeletingLocation(null)
                  )
                }
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Delete"}
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
          actions={
            <>
              <button className="button ghost button-rect" type="button" onClick={() => setDeletingProduct(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                className="button danger button-rect"
                type="button"
                onClick={() =>
                  handleSubmit(
                    { preventDefault: () => {} },
                    () => deleteProduct(deletingProduct._id),
                    "Product deleted successfully.",
                    () => setDeletingProduct(null)
                  )
                }
                disabled={submitting}
              >
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
