export type PlaidAccount = {
  accountId: string;
  itemId?: string;
  institutionName?: string;
  name: string;
  mask?: string;
  type: string;
  subtype?: string;
  enabled: boolean;
};

export type PlaidItemSummary = {
  itemId: string;
  institutionName: string;
  accounts: PlaidAccount[];
  status: "healthy" | "reconnect_required" | "error";
  lastSyncAt?: string;
  errorMessage?: string;
};

export type PlaidTransactionChange = {
  transactionId: string;
  accountId: string;
  date: string;
  authorizedDate?: string;
  amountCents: number;
  merchant?: string;
  pending: boolean;
  pendingTransactionId?: string;
};

export type PlaidSyncBatch = {
  itemId: string;
  batchId: string;
  added: PlaidTransactionChange[];
  modified: PlaidTransactionChange[];
  removed: Array<{ transactionId: string }>;
  completedAt: string;
};

export type PlaidChanges = Pick<PlaidSyncBatch, "added" | "modified" | "removed">;
export type PlaidApplyResult = { added: number; modified: number; removed: number };
