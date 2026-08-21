# Deployment Handover

The managed Node dashboard can be published from the project workspace after the checkpoint associated with this build is available. The current project deliberately does **not** package the separately scaffolded FastAPI service or exploratory model weights into the managed production bundle. This preserves the non-deployment decision recorded in the model cards.

| Component | Current packaging state | Deployment implication |
|---|---|---|
| React + tRPC dashboard | Managed Node application | Ready for managed publish after review. |
| Scan metadata and derived artifact references | Managed database plus preconfigured storage helper | Schema migration was applied; object retrieval is available through the protected history design. |
| FastAPI validation/report service | Separate source package under `backend/` | Requires a separately provisioned Python-capable service before it can be called by the public dashboard. |
| Exploratory classification/segmentation checkpoints | Intentionally external to the repository | Must not be deployed without the documented provenance, calibration, and held-out-evaluation gates. |

To publish the current managed dashboard, use the **Publish** control in the project interface after reviewing the saved checkpoint. The dashboard will truthfully retain its unavailable-model state until a separately approved inference integration is completed.

