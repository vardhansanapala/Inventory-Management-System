import { useState } from "react";
import {
  createCategory,
  createLocation,
  createProduct,
} from "../api/inventory";
import { SectionCard } from "../components/SectionCard";

export function SetupPage({ setupData, refreshSetupData }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event, submitter) {
    event.preventDefault();
    setError("");
    setMessage("");

    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    try {
      await submitter(payload);
      event.target.reset();
      await refreshSetupData();
      setMessage("Setup master saved successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page-stack">
      {message ? <div className="page-message success">{message}</div> : null}
      {error ? <div className="page-message error">{error}</div> : null}

      <div className="two-column-grid">
        <SectionCard title="Categories" subtitle="Setup taxonomy for product families">
          <form className="form-grid" onSubmit={(event) => handleSubmit(event, createCategory)}>
            <input className="input" name="name" placeholder="Laptop" required />
            <input className="input" name="code" placeholder="LAPTOP" required />
            <textarea className="input textarea" name="description" placeholder="Description" />
            <button className="button" type="submit">
              Add Category
            </button>
          </form>

          <div className="mini-list">
            {setupData.categories.map((category) => (
              <div key={category._id} className="mini-item">
                <strong>{category.name}</strong>
                <span>{category.code}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Locations" subtitle="Office, warehouse, outside, or service center">
          <form className="form-grid" onSubmit={(event) => handleSubmit(event, createLocation)}>
            <input className="input" name="name" placeholder="Head Office" required />
            <input className="input" name="code" placeholder="HO" required />
            <select className="input" name="type" defaultValue="OFFICE">
              <option value="OFFICE">OFFICE</option>
              <option value="WAREHOUSE">WAREHOUSE</option>
              <option value="OUTSIDE">OUTSIDE</option>
              <option value="SERVICE_CENTER">SERVICE_CENTER</option>
            </select>
            <textarea className="input textarea" name="address" placeholder="Address" />
            <button className="button" type="submit">
              Add Location
            </button>
          </form>

          <div className="mini-list">
            {setupData.locations.map((location) => (
              <div key={location._id} className="mini-item">
                <strong>{location.name}</strong>
                <span>{location.code}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Products / SKUs" subtitle="Relational SKU definitions linked to a category">
        <form className="form-grid wide-grid" onSubmit={(event) => handleSubmit(event, createProduct)}>
          <select className="input" name="categoryId" required defaultValue="">
            <option value="">Select category</option>
            {setupData.categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
          <input className="input" name="brand" placeholder="Dell" required />
          <input className="input" name="model" placeholder="Latitude 5420" required />
          <input className="input" name="sku" placeholder="DELL-LAT-5420" required />
          <textarea className="input textarea" name="description" placeholder="Description" />
          <button className="button dark" type="submit">
            Add Product
          </button>
        </form>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {setupData.products.map((product) => (
                <tr key={product._id}>
                  <td>{product.sku}</td>
                  <td>{product.brand}</td>
                  <td>{product.model}</td>
                  <td>{product.category?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
