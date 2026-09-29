export const ANALYSIS_MODES = ["classification", "segmentation"] as const;
export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

export const CLASSIFICATION_LABELS = [
  "glioma",
  "meningioma",
  "pituitary",
  "no_tumor",
] as const;
export type ClassificationLabel = (typeof CLASSIFICATION_LABELS)[number];

export type Measurement = {
  kind: "unavailable" | "relative_area" | "physical_area" | "physical_volume";
  pixelCount?: number;
  voxelCount?: number;
  occupancyPercent?: number;
  value?: number;
  unit?: "pixels" | "voxels" | "percent" | "mm²" | "mL";
  metadataConfirmed: boolean;
  limitation: string;
};

export type ArtifactReference = {
  key: string;
  url: string;
  contentType: string;
};

export type AnalysisResult = {
  scanId: string;
  mode: AnalysisMode;
  status: "complete" | "low_confidence" | "incompatible" | "partial" | "unavailable";
  modelVersion: string;
  processingTimeMs: number;
  predictedClass?: ClassificationLabel;
  confidenceScore?: number;
  calibrated?: boolean;
  uncertaintyReason?: string;
  manualReviewRecommended: boolean;
  measurement: Measurement;
  gradCam?: ArtifactReference;
  segmentationMask?: ArtifactReference;
  report?: ArtifactReference;
  threeDimensionalArtifact?: ArtifactReference;
  warnings: string[];
};

export const ACADEMIC_DISCLAIMER =
  "Academic and research use only. This system is not a medical diagnosis and must not replace a qualified radiologist.";

export const GRAD_CAM_DISCLAIMER =
  "Grad-CAM shows regions that influenced the classifier. It is a coarse attribution map, not an exact tumor boundary and not proof of medically correct reasoning.";

export const GLIOMA_SCOPE_DISCLAIMER =
  "Segmentation is limited to compatible glioma-focused volumetric inputs. It is not validated for meningioma, pituitary tumors, or standalone 2D images.";
