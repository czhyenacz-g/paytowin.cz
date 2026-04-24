import { redirect } from "next/navigation";
import DuelDevPage from "./DuelDevPage";

// Dev-only route — v produkci přesměruje na /.
export default function DevDuelRoute() {
  if (process.env.NODE_ENV !== "development") redirect("/");
  return <DuelDevPage />;
}
