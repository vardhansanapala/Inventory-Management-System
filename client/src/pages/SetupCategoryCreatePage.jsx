import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCategory } from "../api/inventory";
import { ActionFeedback } from "../components/ActionFeedback";
import { FormInput, FormTextarea } from "../components/FormFields";
import { SetupSectionGate, useSetupPageContext } from "../components/setup/SetupShared";
import { useActionFeedback } from "../hooks/useActionFeedback";

export function SetupCategoryCreatePage() {
  return (
    <SetupSectionGate requireSuperAdmin>
      <SetupCategoryCreateContent />
    </SetupSectionGate>
  );
}

function SetupCategoryCreateContent() {
  const navigate = useNavigate();
  const { refreshSetupData } = useSetupPageContext();
  const [busyKey, setBusyKey] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const feedback = useActionFeedback();

  async function handleSubmit(event) {
    event.preventDefault();
    setBusyKey("create-category");

    const result = await feedback.handleAsyncAction(
      () =>
        createCategory({
          name: categoryName,
          description: categoryDescription,
        }),
      {
        loadingMsg: "Saving category...",
        successMsg: "Category saved successfully.",
        errorMsg: "Unable to save category.",
      }
    );

    setBusyKey("");

    if (result) {
      await refreshSetupData();
      navigate("/setup/categories", { replace: true });
    }
  }

  return (
    <div className="page-stack setup-section">
      <form className="form-grid wide-grid" onSubmit={handleSubmit}>
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
        <div className="form-actions setup-create-actions">
          <button className="button ghost button-rect" type="button" onClick={() => navigate("/setup/categories")}>
            Cancel
          </button>
          <button className="button dark button-rect with-spinner" type="submit" disabled={busyKey === "create-category" || !categoryName.trim()}>
            {busyKey === "create-category" ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
            <span>{busyKey === "create-category" ? "Saving..." : "Create Category"}</span>
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
