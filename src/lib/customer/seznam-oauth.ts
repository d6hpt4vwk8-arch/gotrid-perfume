export const SEZNAM_STATE_COOKIE = "seznam_oauth_state";
export const SEZNAM_NEXT_COOKIE = "seznam_oauth_next";

export interface SeznamProfile {
  email: string | null;
  firstname: string | null;
  lastname: string | null;
}

/** https://vyvojari.seznam.cz/oauth/doc — POST /api/v1/oauth/token */
export async function exchangeSeznamCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<string | null> {
  const res = await fetch("https://login.seznam.cz/api/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** https://vyvojari.seznam.cz/oauth/doc — GET /api/v1/user (identity scope) */
export async function getSeznamProfile(accessToken: string): Promise<SeznamProfile | null> {
  const res = await fetch("https://login.seznam.cz/api/v1/user", {
    headers: { Authorization: `bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    email?: string | null;
    firstname?: string | null;
    lastname?: string | null;
  };
  return {
    email: data.email ?? null,
    firstname: data.firstname ?? null,
    lastname: data.lastname ?? null,
  };
}
