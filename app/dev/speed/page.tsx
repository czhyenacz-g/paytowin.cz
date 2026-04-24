import { redirect } from "next/navigation";
import SpeedDevPage from "./SpeedDevPage";

// Dev-only route — v produkci přesměruje na /.
export default function DevSpeedRoute() {
  if (process.env.NODE_ENV !== "development") redirect("/");
  return <SpeedDevPage />;
}
