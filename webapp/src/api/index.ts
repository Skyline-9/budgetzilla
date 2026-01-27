import { API_MODE } from "@/api/config";
import type { ApiClient } from "@/api/types";
import { mockApiClient } from "@/api/mock/client";
import { localApiClient } from "@/api/local/client";

function getApiClient(): ApiClient {
  switch (API_MODE) {
    case "local":
      return localApiClient;
    case "mock":
    default:
      return mockApiClient;
  }
}

export const api: ApiClient = getApiClient();










