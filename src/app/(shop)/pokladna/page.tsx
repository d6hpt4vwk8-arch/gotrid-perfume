import { getSettings } from "@/lib/settings.server";
import { getCurrentCustomer } from "@/lib/customer/get-current-customer";
import { CheckoutForm } from "@/components/checkout-form";

export default async function CheckoutPage() {
  const [settings, customer] = await Promise.all([getSettings(), getCurrentCustomer()]);
  return <CheckoutForm settings={settings} customer={customer} />;
}
