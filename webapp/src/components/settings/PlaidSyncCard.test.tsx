// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlaidSyncCard } from "./PlaidSyncCard";

describe("PlaidSyncCard", () => {
  it("explains local companion pairing and browser permission recovery", () => {
    render(<QueryClientProvider client={new QueryClient()}><PlaidSyncCard /></QueryClientProvider>);
    expect(screen.getByText("Plaid bank sync")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pair companion" })).toBeTruthy();
    expect(screen.getByText(/allow it in site permissions/)).toBeTruthy();
  });
});
