import { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { getSetupBootstrap } from "../../api/inventory";
import { SectionCard } from "../SectionCard";
import { SearchInput } from "../SearchInput";
import { canManageFullSetup } from "../../constants/permissions";
import { useAuth } from "../../context/AuthContext";

export const SETUP_PAGE_SIZE = 10;

const emptySetupData = {
  categories: [],
  products: [],
  locations: [],
  users: [],
};

export function useDebouncedValue(value, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

export function sortItemsLatestFirst(items) {
  return [...items].sort((left, right) => {
    const leftTime = getSortableTime(left);
    const rightTime = getSortableTime(right);
    return rightTime - leftTime;
  });
}

export function sortItemsByLastUpdated(items, sort = "latest") {
  const direction = sort === "oldest" ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftTime = getSortableTime(left);
    const rightTime = getSortableTime(right);
    return direction * (leftTime - rightTime);
  });
}

function getSortableTime(item) {
  const parsed = new Date(item?.updatedAt || item?.createdAt || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getEmptyMessage(allItems, filteredItems) {
  if (!allItems.length) {
    return "No data available";
  }

  if (!filteredItems.length) {
    return "No results found";
  }

  return "No data available";
}

export function SetupToolbar({ searchValue, onSearchChange, searchPlaceholder, filters = null, action = null, summary = null }) {
  return (
    <div className="setup-list-toolbar">
      <div className="setup-list-filters">
        <div className="setup-search-field">
          <SearchInput value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
        </div>
        {filters}
      </div>
      <div className="setup-list-actions">
        {summary ? <div className="table-subtle">{summary}</div> : null}
        {action}
      </div>
    </div>
  );
}

export function SetupPagination({ currentPage, totalItems, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / SETUP_PAGE_SIZE));

  if (totalItems <= SETUP_PAGE_SIZE) {
    return null;
  }

  return (
    <div className="users-pagination">
      <button
        className="button ghost button-rect button-sm"
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        Prev
      </button>
      <div className="users-pagination-pages">
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
          <button
            key={page}
            className={page === currentPage ? "button dark button-rect button-sm" : "button ghost button-rect button-sm"}
            type="button"
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
      </div>
      <button
        className="button ghost button-rect button-sm"
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  );
}

export function SetupSectionGate({ requireSuperAdmin = false, children }) {
  const { user } = useAuth();
  const isSuperAdmin = canManageFullSetup(user);

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/setup/products" replace />;
  }

  return children;
}

export function SetupPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isSuperAdmin = canManageFullSetup(user);
  const [setupData, setSetupData] = useState(emptySetupData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function refreshSetupData() {
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
    } catch (error) {
      setLoadError(error.message || "Unable to load setup.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSetupData();
  }, []);

  const pageTitle = useMemo(() => {
    return isSuperAdmin ? "Setup masters for products, locations, and categories." : "Product and SKU setup only.";
  }, [isSuperAdmin]);

  function getTabClass(pathname) {
    return location.pathname.startsWith(pathname) ? "is-active" : "";
  }

  if (loading) {
    return <div className="page-message">Loading setup...</div>;
  }

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
                <button type="button" className={getTabClass("/setup/categories")} onClick={() => navigate("/setup/categories")}>
                  Categories
                </button>
                <button type="button" className={getTabClass("/setup/locations")} onClick={() => navigate("/setup/locations")}>
                  Locations
                </button>
              </>
            ) : null}
            <button type="button" className={getTabClass("/setup/products")} onClick={() => navigate("/setup/products")}>
              Products / SKUs
            </button>
          </div>
        }
      >
        <Outlet context={{ setupData, refreshSetupData, isSuperAdmin }} />
      </SectionCard>
    </div>
  );
}

export function useSetupPageContext() {
  return useOutletContext();
}
