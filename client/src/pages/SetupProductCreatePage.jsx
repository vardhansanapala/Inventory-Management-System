import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProduct } from "../api/inventory";
import { ActionFeedback } from "../components/ActionFeedback";
import { FormInput, FormTextarea } from "../components/FormFields";
import { useSetupPageContext } from "../components/setup/SetupShared";
import { useActionFeedback } from "../hooks/useActionFeedback";

export function SetupProductCreatePage() {
  const navigate = useNavigate();
  const { setupData, refreshSetupData } = useSetupPageContext();
  const [busyKey, setBusyKey] = useState("");
  const feedback = useActionFeedback();

  async function handleSubmit(event) {
    event.preventDefault();
    setBusyKey("create-product");

    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    const result = await feedback.handleAsyncAction(
      () => createProduct(payload),
      {
        loadingMsg: "Saving product...",
        successMsg: "Product saved successfully.",
        errorMsg: "Unable to save product.",
      }
    );

    setBusyKey("");

    if (result) {
      await refreshSetupData();
      navigate("/setup/products", { replace: true });
    }
  }

  return (
    <div className="page-stack setup-section">
      <form className="form-grid wide-grid" onSubmit={handleSubmit}>
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
        <div className="form-actions setup-create-actions">
          <button className="button ghost button-rect" type="button" onClick={() => navigate("/setup/products")}>
            Cancel
          </button>
          <button className="button dark button-rect with-spinner" type="submit" disabled={busyKey === "create-product"}>
            {busyKey === "create-product" ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
            <span>{busyKey === "create-product" ? "Saving..." : "Create Product"}</span>
          </button>
        </div>
      </form>
      <ActionFeedback
        type={feedback.feedback?.type}
        message={feedback.feedback?.message}
        autoDismissMs={feedback.feedback?.autoDismissMs}
        onClose={feedback.clear}
        className="action-feedback-inline"
      />
    </div>
  );
}
