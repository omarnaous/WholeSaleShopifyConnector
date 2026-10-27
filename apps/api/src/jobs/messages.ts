import type { SyncedField } from "@lumen/core";

export type JobMessage =
  /** Import one wholesaler product into one store. Part of a larger import job (progress bar). */
  | { type: "import"; jobId: string; importJobId: string; shopId: string; productId: string }
  /** Push stock and/or cost of some variants of one product to one store. */
  | { type: "sync"; jobId: string; shopId: string; productId: string; fields: SyncedField[] }
  /** Set ACTIVE / DRAFT on one imported product in one store. */
  | { type: "status"; jobId: string; shopId: string; productId: string; status: "ACTIVE" | "DRAFT" };
