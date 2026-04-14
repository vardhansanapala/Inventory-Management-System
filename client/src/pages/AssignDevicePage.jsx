import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AssetsPage } from "./AssetsPage";

export function AssignDevicePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab === "assign") return;

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", "assign");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  return <AssetsPage />;
}

