import { useLocation } from "react-router-dom";
import { AssetsPage } from "./AssetsPage";

export function AssignDevicePage() {
  const { state } = useLocation();
  const asset = state?.asset || null;

  return <AssetsPage forcedTab="assign" incomingAsset={asset} assignSelectionUsesButton />;
}
