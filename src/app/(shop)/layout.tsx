import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";
import { CookieBanner } from "@/components/cookie-banner";
import { MetaPixel } from "@/components/meta-pixel";
import { BenefitsBar } from "@/components/benefits-bar";
import { getSettings } from "@/lib/settings.server";

// Google Consent Mode v2 default signals — must be queued before any Google
// tag loads (TZ §5.9), even though no GA4 property is wired up yet. Denied
// by default; ConsentProvider pushes 'update' once the visitor decides.
const CONSENT_MODE_BOOTSTRAP = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  window.gtag = gtag;
`;

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: CONSENT_MODE_BOOTSTRAP }} />
      <Providers freeShippingThreshold={settings.freeShippingThreshold}>
        <MetaPixel />
        <BenefitsBar />
        <SiteHeader />
        {children}
        <SiteFooter />
        <CookieBanner />
      </Providers>
    </>
  );
}
