const GRAPH_API_VERSION = "v25.0";

export const FACEBOOK_STATE_COOKIE = "facebook_oauth_state";
export const FACEBOOK_NEXT_COOKIE = "facebook_oauth_next";

export interface FacebookProfile {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/ */
export async function exchangeFacebookCode(params: {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
}): Promise<string | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("client_secret", params.appSecret);
  url.searchParams.set("code", params.code);

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** Graph API User node — email/name only come back if the "email" scope was granted. */
export async function getFacebookProfile(accessToken: string): Promise<FacebookProfile | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/me`);
  url.searchParams.set("fields", "email,first_name,last_name");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
  return {
    email: data.email ?? null,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
  };
}
