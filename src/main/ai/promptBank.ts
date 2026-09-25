import { CONTINUITY_HEADING } from '../../shared/types'

const POV_DEFAULT = 'third-person'
const TARGET_WORDS_DEFAULT = '80000'

const SCOPE_GUARD =
  'Focus only on the target document; do not write any other chapter or scene.'

const OPENING =
  'This is the opening of the manuscript — no earlier text exists to stay consistent with. Establish tone, protagonist, and setting confidently; do not write as though events have already happened.'

const LATER =
  "Continue directly from the recorded continuity notes and reference material above: do NOT restart the story, re-introduce elements already established, or repeat scenes that have already been written. Stay consistent with the continuity document and do not invent, contradict, or resolve events already recorded there."

const PREMISE_PROMPT = `You are a professional book editor and development editor. Generate a strong novel premise:
- A one-paragraph logline (single sentence, dynamic).
- A "what if" question that seeds the core conflict.
- The stakes for the protagonist (what is lost if they fail).
- A brief note on the emotional core.

Format as plain Markdown with headings: ## Logline, ## What If, ## Stakes, ## Emotional Core. Keep it under 400 words.`

const OUTLINE_PROMPT = `You are an expert story architect. Build a three-act outline for a novel of approximately ${TARGET_WORDS_DEFAULT} words. Design the chapters so the POV characters' goals, conflicts, and arcs are actually put in motion. For each act include:
- A one-line act goal.
- 3-6 chapters, each with a chapter purpose and 1-2 key scenes (scene = goal, obstacle, outcome).

Also list 2-4 plot threads (main + subplots). Format as Markdown with ## Act I/II/III, ### Chapter headings, and a ## Plot Threads list. Be concrete and original.`

const CHARACTER_PROMPT = `You are a character development expert. Create detailed character profiles for the protagonist and supporting cast. For each character include: role, motivation, external goal, internal conflict, flaw, wound, arc (how they change), voice/tics, relationships. Use the existing Characters document structure. Format as Markdown headings per character.`

const WORLD_PROMPT = `You are a worldbuilding consultant. Expand the world/setting: atmosphere, rules/logic of the world, history and timeline, key locations, culture and themes. Format as Markdown with clear headings. Ground everything in how it affects the story.`

const CONTINUITY_PROMPT = `You are a continuity editor for a novel. Review this project's registered entities and the provided documents above. Flag any logical contradictions (traits, timeline, plot threads) with the offending quote and a suggested fix. If none, say "No issues found."`

const TIMELINE_PROMPT = `You are a story chronology specialist. Build a clear, consistent timeline for the story: the chronological sequence of chapters and key events, with each chapter's position, POV, and what advances in it; character entrances, exits, and absences; and connections between plot threads. Keep every entry consistent with the outline, characters, and world. Format as Markdown with a chronologically ordered list, each entry showing when and where a key event happens, its chapter, and its consequences.`

const CATEGORY_PROMPTS: Record<string, string> = {
  'cat:premise-theme': PREMISE_PROMPT,
  'cat:characters': CHARACTER_PROMPT,
  'cat:world': WORLD_PROMPT,
  'cat:timeline': TIMELINE_PROMPT,
  'cat:outline': OUTLINE_PROMPT,
  'cat:continuity': CONTINUITY_PROMPT
}

function chapterPrompt(title: string, isFirstChapter: boolean): string {
  const position = isFirstChapter ? OPENING : LATER
  return `Write a complete chapter (approx 2000-3500 words) for ${title}. Using the outline beats, characters, world, and continuity notes provided above, advance this chapter's purpose by one clear step; do not pick a different chapter. Compose it as 2-4 connected scenes. Keep POV consistent (${POV_DEFAULT}). Use active voice. End the chapter naturally, without forcing a cliffhanger. ${position} ${SCOPE_GUARD} Your chapter response will be appended directly into the target document, so do not repeat or restate text already present in it.

After the chapter text, leave a blank line, then start a new section with the heading written exactly as ${CONTINUITY_HEADING} on its own line — not inside quotes or code blocks. Under that heading, write a brief bullet list covering: new characters introduced, new locations introduced, new important objects, new unresolved plot threads, and any apparent continuity concerns. This notes section belongs in the project's Continuity document, not in the chapter, and nothing else should be written after it.`
}

export interface PromptContext {
  key: string
  title: string
  isFirstChapter: boolean
}

export function promptForDoc(ctx: PromptContext): string | null {
  if (ctx.key.startsWith('ch:')) return chapterPrompt(ctx.title, ctx.isFirstChapter)
  return CATEGORY_PROMPTS[ctx.key] ?? null
}