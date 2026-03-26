// Types
export type { PromptSection, PromptConfig } from "./types";

// Main prompt exports (backward compatible)
export { prompt, createSystemPrompt } from "./prompts/system";
export { convexGuidelines } from "./prompts/convex";

// Sections for customization
export {
  sections,
  getSectionById,
  getRequiredSections,
  getSectionsByOrder,
  envSection,
  codeOrganizationSection,
  typescriptSection,
  reactOptimizationsSection,
  designSection,
  toneAndStyleSection,
  proactivenessSection,
  stateManagementSection,
  stackInfoSection,
  webCompatibilitySection,
  docsSection,
  aiIntegrationSection,
  createAiIntegrationSection,
  appstoreSection,
  artifactInfoSection,
  firstMessageSection,
} from "./prompts/sections";

const noCloudNote = `
<cloud_disabled>
IMPORTANT: Cloud/Backend (Convex) is NOT enabled for this project.
- Do NOT create any Convex functions, schemas, or queries
- Do NOT import from "convex/react" or "../convex/_generated/api"
- Do NOT use useQuery or useMutation from Convex
- If the user wants backend functionality, inform them to enable Cloud first by clicking the "Cloud" button in the toolbar
- Use local state (useState, AsyncStorage, React Query with local data) for data persistence instead
- Ignore any existing convex folder in the template - it's not active
</cloud_disabled>
`;

/**
 * Get the system prompt with optional Convex guidelines
 * @param cloudEnabled - Whether cloud (Convex) is enabled for this project
 * @returns The system prompt, optionally with Convex guidelines appended
 */
export function getPromptWithCloudStatus(cloudEnabled: boolean): string {
  const { prompt } = require("./prompts/system");
  const { convexGuidelines } = require("./prompts/convex");

  if (cloudEnabled) {
    return prompt + "\n\n" + convexGuidelines;
  }
  return prompt + "\n\n" + noCloudNote;
}
