/**
 * Populate only after the source, licence, attribution, and redistribution
 * permission for every sample have been independently verified. No MRI file is
 * bundled or activated by this empty manifest.
 */
export const approvedResearchSamples: ReadonlyArray<{
  id: string;
  title: string;
  attribution: string;
  licence: string;
  sourceUrl: string;
}> = [];

export const hasApprovedResearchSamples = approvedResearchSamples.length > 0;
