import type { ApiClient } from "@/api/types";
import { localApiClient } from "@/api/local/client";

export const api: ApiClient = localApiClient;
