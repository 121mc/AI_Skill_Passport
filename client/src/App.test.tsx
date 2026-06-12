import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the local demo navigation", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /Library/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Task/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Timeline/i })).toBeInTheDocument();
  });
});
