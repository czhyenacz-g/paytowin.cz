import { redirect } from "next/navigation";
import LegendaryRaceDevPage from "./LegendaryRaceDevPage";

// Dev-only route — v produkci přesměruje na /.
export default function DevLegendaryRoute() {
  if (process.env.NODE_ENV !== "development") redirect("/");
  return <LegendaryRaceDevPage />;
}
