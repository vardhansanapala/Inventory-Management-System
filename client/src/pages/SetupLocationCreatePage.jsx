import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createLocation } from "../api/inventory";
import { ActionFeedback } from "../components/ActionFeedback";
import { FormInput, FormTextarea } from "../components/FormFields";
import { SetupSectionGate, useSetupPageContext } from "../components/setup/SetupShared";
import { useActionFeedback } from "../hooks/useActionFeedback";

export function SetupLocationCreatePage() {
  return (
    <SetupSectionGate requireSuperAdmin>
      <SetupLocationCreateContent />
    </SetupSectionGate>
  );
}

function SetupLocationCreateContent() {
  const navigate = useNavigate();
  const { refreshSetupData } = useSetupPageContext();
  const [busyKey, setBusyKey] = useState("");
  const feedback = useActionFeedback();

  async function handleSubmit(event) {
    event.preventDefault();
    setBusyKey("create-location");

    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    const result = await feedback.handleAsyncAction(
      () => createLocation(payload),
      {
        loadingMsg: "Saving location...",
        successMsg: "Location saved successfully.",
        errorMsg: "Unable to save location.",
      }
    );

    setBusyKey("");

    if (result) {
      await refreshSetupData();
      navigate("/setup/locations", { replace: true });
    }
  }

  return (
    <div className="page-stack setup-section">
      <form className="form-grid wide-grid" onSubmit={handleSubmit}>
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
        <div className="form-actions setup-create-actions">
          <button className="button ghost button-rect" type="button" onClick={() => navigate("/setup/locations")}>
            Cancel
          </button>
          <button className="button dark button-rect with-spinner" type="submit" disabled={busyKey === "create-location"}>
            {busyKey === "create-location" ? <span className="button-spinner button-spinner-lg" aria-hidden /> : null}
            <span>{busyKey === "create-location" ? "Saving..." : "Create Location"}</span>
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
