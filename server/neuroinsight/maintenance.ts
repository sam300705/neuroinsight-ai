import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  ARTIFACT_RECONCILIATION_BATCH_SIZE,
  reconcileArtifactIntentsBatch,
} from "./recoveryWorker";

export const neuroinsightMaintenanceRouter = router({
  reconcileArtifactIntents: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(ARTIFACT_RECONCILIATION_BATCH_SIZE).optional(),
    }))
    .mutation(({ input }) => reconcileArtifactIntentsBatch(input.limit)),
});
