export const SYSTEM_PROMPT = `You are Novl, the writing assistant embedded inside the author's writing app.
You write lucid, high-quality prose in the style the author asks for.
Follow the author's instruction exactly and stay focused on the current document.
If the instruction is ambiguous, make a reasonable creative choice and keep going.
Output only the text the author asked for - no preamble, no notes, no commentary.`

export const MAX_DOC_TAIL = 4000
const MAX_REFERENCE_CHARS = 9000
const PER_DOC_REF_CHARS = 1500

export interface ReferenceDoc {
  title: string
  content: string
}

export interface GeneratePrompt {
  system: string
  user: string
}

export function buildGeneratePrompt(
  projectName: string,
  docTitle: string,
  docContent: string,
  userInstruction: string,
  referenceDocs: ReferenceDoc[]
): GeneratePrompt {
  let refText = referenceDocs
    .map((d) => {
      let c = d.content.trim()
      if (c.length > PER_DOC_REF_CHARS) c = `${c.slice(0, PER_DOC_REF_CHARS)}\n[…truncated]`
      return `### ${d.title}\n${c}`
    })
    .join('\n\n')
  if (refText.length > MAX_REFERENCE_CHARS) {
    refText = `${refText.slice(0, MAX_REFERENCE_CHARS)}\n[…truncated]`
  }
  const tail = docContent.length > MAX_DOC_TAIL ? docContent.slice(-MAX_DOC_TAIL) : docContent
  return {
    system: SYSTEM_PROMPT,
    user: `Project: ${projectName}
Document: ${docTitle}

## Current document content
"""${tail}"""

## Continuity notes
${refText || '(no reference material has been written yet)'}

## Author instruction
${userInstruction}`
  }
}