import { redirect } from "next/navigation";
import SoundDevPage from "./SoundDevPage";

// Dev-only route — v produkci přesměruje na /.
export default function SoundDevRoute() {
  if (process.env.NODE_ENV !== "development") redirect("/");
  return <SoundDevPage />;
}
