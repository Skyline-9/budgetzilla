import * as React from "react";
import { Landmark, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getPlaidAccounts, removePlaidItemData, setPlaidAccountEnabled, upsertPlaidAccounts } from "@/db/plaid";
import type { PlaidAccount, PlaidItemSummary } from "@/types/plaid";
import { hasPlaidCompanionSession, plaidCompanion, configurePlaidCompanion, startDesktopPlaidCompanion } from "@/services/plaidCompanion";
import { openPlaidLink } from "@/services/plaidLink";
import { syncPlaidItem, syncPlaidItemsOnOpen } from "@/services/plaidImport";
import { cn } from "@/lib/cn";
import { isTauri } from "@/db/sqlite";
import { useQueryClient } from "@tanstack/react-query";

export function PlaidSyncCard() {
  const queryClient = useQueryClient();
  const [url, setUrl] = React.useState("http://127.0.0.1:43127");
  const [code, setCode] = React.useState("");
  const [items, setItems] = React.useState<PlaidItemSummary[]>([]);
  const [accounts, setAccounts] = React.useState<PlaidAccount[]>([]);
  const [state, setState] = React.useState("Not connected to the local Plaid companion.");
  const [busy, setBusy] = React.useState(false);
  const [paired, setPaired] = React.useState(hasPlaidCompanionSession());
  const [desktop, setDesktop] = React.useState(false);
  const opened = React.useRef(false);

  const refresh = React.useCallback(async () => {
    const [nextItems, nextAccounts] = await Promise.all([plaidCompanion.listItems(), getPlaidAccounts()]);
    setItems(nextItems);
    setAccounts(nextAccounts);
    const lastSync = nextItems.map((item) => item.lastSyncAt).filter(Boolean).sort().at(-1);
    setState(`Connected${lastSync ? ` · Last successful sync ${new Date(lastSync).toLocaleString()}` : ""}`);
  }, []);

  const refreshTransactions = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] }),
    ]);
  }, [queryClient]);

  const pair = async () => {
    setBusy(true);
    try { configurePlaidCompanion(url); await plaidCompanion.health(); await plaidCompanion.pair(code.trim()); setPaired(true); setCode(""); await refresh(); }
    catch (error) { setState(error instanceof Error ? error.message : "Companion connection failed"); }
    finally { setBusy(false); }
  };

  React.useEffect(() => {
    const startDesktopCompanion = async () => {
      if (!isTauri()) return;
      setDesktop(true);
      setBusy(true);
      try {
        await startDesktopPlaidCompanion();
        await plaidCompanion.health();
        setPaired(true);
        await refresh();
      } catch (error) {
        setState(error instanceof Error ? error.message : "Could not start the Plaid companion");
      } finally {
        setBusy(false);
      }
    };
    void startDesktopCompanion();
  }, [refresh]);

  React.useEffect(() => {
    if (!paired || isTauri()) return;
    void refresh().catch((error) => setState(error instanceof Error ? error.message : "Companion connection failed"));
  }, [paired, refresh]);

  React.useEffect(() => {
    if (!paired || !items.length || opened.current) return;
    opened.current = true;
    void syncPlaidItemsOnOpen(items.filter((item) => item.status === "healthy").map((item) => item.itemId))
      .then(async () => { await refreshTransactions(); await refresh(); })
      .catch((error) => setState(error instanceof Error ? error.message : "Automatic sync failed"));
  }, [items, paired, refresh, refreshTransactions]);

  const connectBank = async () => {
    setBusy(true);
    try {
      const { linkToken } = await plaidCompanion.createLinkToken(90);
      const { publicToken, metadata } = await openPlaidLink(linkToken);
      const result = await plaidCompanion.exchangePublicToken(publicToken, metadata);
      const linked: PlaidAccount[] = result.accounts.map((account) => ({ ...account, itemId: result.itemId, institutionName: result.institutionName }));
      await upsertPlaidAccounts(linked);
      setAccounts(await getPlaidAccounts());
      await refresh();
      setState(`${result.institutionName} connected. Syncing transactions…`);
      await syncPlaidItem(result.itemId);
      await refreshTransactions();
      await refresh();
    } catch (error) { setState(error instanceof Error ? error.message : "Could not connect bank"); }
    finally { setBusy(false); }
  };

  const sync = async (itemId: string) => {
    setBusy(true);
    try { const result = await syncPlaidItem(itemId); await refreshTransactions(); setState(`Sync complete · ${result.added} added, ${result.modified} updated, ${result.removed} removed`); await refresh(); }
    catch (error) { setState(error instanceof Error ? error.message : "Sync failed. You can retry safely."); }
    finally { setBusy(false); }
  };

  const toggleAccount = async (account: PlaidAccount, enabled: boolean) => {
    try { await plaidCompanion.setAccountEnabled(account.accountId, enabled); await setPlaidAccountEnabled(account.accountId, enabled); await refreshTransactions(); setAccounts((all) => all.map((a) => a.accountId === account.accountId ? { ...a, enabled } : a)); }
    catch (error) { setState(error instanceof Error ? error.message : "Could not update account"); }
  };

  const disconnect = async (item: PlaidItemSummary) => {
    const choice = window.prompt(`Disconnect ${item.institutionName}? Enter “keep” to retain imported transactions, “delete” to remove them, or cancel.`);
    if (choice?.toLowerCase() !== "keep" && choice?.toLowerCase() !== "delete") return;
    setBusy(true);
    try { await plaidCompanion.removeItem(item.itemId); await removePlaidItemData(item.itemId, choice.toLowerCase() === "delete"); await refresh(); }
    catch (error) { setState(error instanceof Error ? error.message : "Could not disconnect Item"); }
    finally { setBusy(false); }
  };

  return <div className="space-y-3.5">
    <div className="px-1"><h3 className="text-sm font-semibold tracking-tight">Plaid bank sync</h3><p className="mt-0.5 text-xs text-muted-foreground">Sync transactions through a companion running on this device. Institution refresh timing varies.</p></div>
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/25 divide-y divide-border/20">
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center gap-3"><Landmark className="h-4 w-4 text-primary"/><div className="text-sm font-medium">{state}</div></div>
        <div className="flex flex-wrap gap-2">
          {!desktop && <>
            <Input aria-label="Companion address" className="h-9 w-52" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://127.0.0.1:43127" />
            <Input aria-label="Pairing code" className="h-9 w-40" value={code} onChange={(e) => setCode(e.target.value)} placeholder="One-time pairing code" />
            <Button size="sm" disabled={busy || !code.trim()} onClick={pair}>{busy ? "Connecting…" : "Pair companion"}</Button>
          </>}
          {paired && <Button variant="secondary" size="sm" disabled={busy} onClick={connectBank}>Connect bank</Button>}
        </div>
        {!desktop && <p className="text-xs text-muted-foreground">Start `plaid-companion serve`, then enter its loopback address and one-time code. If the browser blocks local-network access, allow it in site permissions and retry. Your Plaid credentials stay in the companion.</p>}
      </div>
      {items.map((item) => <div className="space-y-2 px-5 py-4" key={item.itemId}>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{item.institutionName}</p><p className={cn("text-xs", item.status === "healthy" ? "text-emerald-600" : "text-amber-600")}>{item.errorMessage ?? item.status.replaceAll("_", " ")}</p></div><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={busy} onClick={() => sync(item.itemId)}><RefreshCw className="mr-1 h-3.5 w-3.5"/>Sync</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => disconnect(item)}><Unplug className="mr-1 h-3.5 w-3.5"/>Disconnect</Button></div></div>
      </div>)}
      {accounts.map((account) => <div className="flex items-center justify-between px-5 py-3" key={account.accountId}><div className="text-sm">{account.institutionName} · {account.name}{account.mask ? ` ···${account.mask}` : ""}</div><Switch checked={account.enabled} onCheckedChange={(checked) => toggleAccount(account, checked)} aria-label={`Import ${account.name}`} /></div>)}
    </div>
  </div>;
}
