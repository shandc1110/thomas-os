import { vi } from "vitest";

// Allow importing modules that use `server-only` under Vitest.
vi.mock("server-only", () => ({}));
