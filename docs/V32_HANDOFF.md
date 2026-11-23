# NeuroInsight AI v3.2 handoff provisioning

Keep the three supplied ZIP parts and their extracted contents in private storage outside the checkout. The provisioner accepts filenames with any prefix, including upload copy markers, and reconstructs the three files in suffix order. It checks the expected 1,120,009,578-byte length and SHA-256 before parsing the ZIP. It validates member paths and types and checks CRCs while extracting to a private staging directory. The destination appears after successful extraction. Extraction requires free space for both the reconstructed ZIP and its expanded contents.

Run from the checkout root with Python 3.12. Use the actual private path to each part and a fresh destination name.

```bash
umask 077
mkdir -p /workspace/private-neuroinsight
python3 scripts/provision_v32_handoff.py \
  --output /workspace/private-neuroinsight/handoff-v32 \
  "/path/to/NeuroInsight_AI_Handoff.zip.part1" \
  "/path/to/NeuroInsight_AI_Handoff.zip.part2" \
  "/path/to/NeuroInsight_AI_Handoff.zip.part3"

python3 -m unittest discover -s scripts -p test_provision_v32_handoff.py -v
```

## Existing integration points

- The browser requires acknowledgement and validates the JPEG or PNG locally. `Analyse.tsx` then posts the image to FastAPI through `inferenceApi.ts`. FastAPI applies bounded upload validation and inference concurrency before returning the result used by `Results.tsx`.
- FastAPI startup and the Vercel entry point currently configure EXP-005. FastAPI's `/ready` checks both classifier availability and shared controls. The two Mode A endpoints share the same inference implementation. The volumetric Mode B endpoints report unavailable.
- Results conditionally request a PDF using a signed analysis receipt. Report verification binds the existing classifier attention image by SHA-256 and enforces receipt expiry and replay checks. Saving requires sign-in and explicit action. The Node backend scopes scan and artifact operations to the owner. The existing saved rows carry a model version and classifier fields. A combined finding will need its own persisted fields.
- The calibration panel already matches evidence by model version. The legacy v2 Research Passport embeds EXP-005 evidence and accepts only that model when generating new passports. Existing passport verification is unchanged. The report, explanation assistant, and current Results screen still use EXP-005-era assumptions and need a v3.2 contract before cutover.
- The handoff must be inspected before choosing package versions, enumerating hashes for the three classifier and five segmentation weights, or adapting prediction fields. Verify all eight evaluations locally against their saved CSV rows. Run the private browser check with a separately authorized non-sensitive JPEG or PNG outside the evaluation split.

Provisioning alone leaves the application on the existing model. No model files or sample images belong in this repository.
