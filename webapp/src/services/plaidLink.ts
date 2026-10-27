type LinkMetadata = { institution?: { institution_id?: string; name?: string } };
type PlaidGlobal = { create: (config: { token: string; onSuccess: (publicToken: string, metadata: LinkMetadata) => void; onExit?: (error: unknown) => void }) => { open: () => void } };
declare global { interface Window { Plaid?: PlaidGlobal } }

let loading: Promise<void> | null = null;
async function loadLink(): Promise<void> {
  if (window.Plaid) return;
  if (!loading) loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.onload = () => window.Plaid ? resolve() : reject(new Error("Plaid Link did not initialize"));
    script.onerror = () => reject(new Error("Could not load Plaid Link. Check your internet connection."));
    document.head.appendChild(script);
  }).catch((error) => { loading = null; throw error; });
  return loading;
}

export async function openPlaidLink(token: string): Promise<{ publicToken: string; metadata: LinkMetadata }> {
  await loadLink();
  return new Promise((resolve, reject) => {
    const handler = window.Plaid!.create({ token, onSuccess: (publicToken, metadata) => resolve({ publicToken, metadata }), onExit: (error) => reject(new Error(error ? "Plaid Link closed with an error" : "Plaid Link was closed before completing")) });
    handler.open();
  });
}
