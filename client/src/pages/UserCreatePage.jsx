import { useNavigate } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { UserCreateForm } from "../components/users/UserManagementShared";

export function UserCreatePage() {
  const navigate = useNavigate();

  return (
    <div className="page-stack users-page">
      <SectionCard
        title="User Management"
        subtitle="Create accounts, manage roles, and control account status with super-admin-only actions."
        actions={
          <button className="button ghost button-rect" type="button" onClick={() => navigate("/users")}>
            Back to Users
          </button>
        }
      >
        <UserCreateForm onCreated={() => navigate("/users", { replace: true })} />
      </SectionCard>
    </div>
  );
}
