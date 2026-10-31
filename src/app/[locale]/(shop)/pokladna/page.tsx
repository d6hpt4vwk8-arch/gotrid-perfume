import { getSettings } from "@/lib/settings.server";
import { getCurrentCustomer } from "@/lib/customer/get-current-customer";
import { CheckoutForm } from "@/components/checkout-form";

export default async function CheckoutPage() {
  const [settings, customer] = await Promise.all([getSettings(), getCurrentCustomer()]);
  // The form only prefills contact/address — never ship the password hash (or session version) to the browser.
  const safeCustomer = customer ? { ...customer, passwordHash: null, sessionVersion: 0 } : null;
  return <CheckoutForm settings={settings} customer={safeCustomer} />;
}
