import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware drop-ins for next/link and next/navigation: they keep the
// "/sk" prefix when the visitor browses the Slovak storefront.
export const { Link, redirect, permanentRedirect, usePathname, useRouter } =
  createNavigation(routing);
