export type AgentType = "text" | "image"

export interface AgentDefinition {
  /** Stable identifier used in routes and DB rows */
  id: string
  name: string
  shortName: string
  description: string
  type: AgentType
  /** Master prompt markdown file at the repository root (source of truth, never mutated) */
  promptFile: string
  /** The agent's opening move per its master prompt, shown in empty chats */
  openingLine: string
}

export const AGENTS: readonly AgentDefinition[] = [
  {
    id: "storyboard-generator",
    name: "Storyboard Generator",
    shortName: "Storyboard",
    description:
      "Turns one idea into a complete 6-8 scene Hollywood-structure cinematic storyboard with Character Bible, image prompts, video prompts, dialogue, sound design, camera, and transitions.",
    type: "text",
    promptFile: "AI_Cinematic_Story_Prompt_Generator_Hollywood_Edition.md",
    openingLine: "What's your idea for the video?",
  },
  {
    id: "image-prompt-extractor",
    name: "Image Prompt Extractor",
    shortName: "Image Prompts",
    description:
      "Receives a storyboard and extracts only the Image Generation Prompt for each scene, one at a time, in exact order.",
    type: "text",
    promptFile: "AI_Storyboard_Prompt_Extractor_Master_Prompt.md",
    openingLine: "Please paste your complete storyboard.",
  },
  {
    id: "image-generator",
    name: "Image Generator",
    shortName: "Images",
    description:
      "Generates exactly one cinematic 9:16 image per pasted prompt with strict character and scene continuity, then waits for the next prompt.",
    type: "image",
    promptFile: "AI_Cinematic_Image_Generator_Master_Prompt.md",
    openingLine: "Paste your first image generation prompt.",
  },
  {
    id: "video-prompt-extractor",
    name: "Video Prompt Extractor",
    shortName: "Video Prompts",
    description:
      "Receives a storyboard and returns every scene's Video Generation Prompt, Dialogue, Sound Design, Camera, and Transition in a single response.",
    type: "text",
    promptFile: "AI_Storyboard_Video_Prompt_Extractor_Master_Prompt.md",
    openingLine: "Please paste your complete storyboard.",
  },
  {
    id: "post-processing",
    name: "Video Metadata",
    shortName: "Video Metadata",
    description:
      "Generates a complete SEO package for the video: primary title, alternative titles, description, hashtags, tags, filename, category, language, audience, and upload time.",
    type: "text",
    promptFile: "SEO_Metadata_Generator_Master_Prompt.md",
    openingLine: "Please paste your complete storyboard.",
  },
] as const

export function getAgent(id: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.id === id)
}

export function isValidAgentId(id: string): boolean {
  return AGENTS.some((a) => a.id === id)
}
