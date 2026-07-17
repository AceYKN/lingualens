export type PresetId = 'quick' | 'standard' | 'deep' | 'custom'
export type DetailLevel = 'minimal' | 'concise' | 'standard' | 'detailed' | 'expert'
export type LearnerLevel = 'beginner-zero' | 'beginner' | 'intermediate' | 'advanced' | 'linguist'
export type TerminologyLevel = 'plain' | 'explained' | 'professional'
export type OutputFormat = 'cards' | 'markdown' | 'json' | 'text'

export interface ProviderConfig {
  baseUrl: string
  path: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  timeoutMs: number
  rememberKey: boolean
}

export interface AnalysisConfig {
  sourceLanguage: string
  explanationLanguage: string
  translationLanguage: string
  preset: PresetId
  detail: DetailLevel
  learnerLevel: LearnerLevel
  terminology: TerminologyLevel
  modules: Record<string, boolean>
  moduleDepths: Record<string, DetailLevel>
  customInstructions: string
  promptTemplate: string
  outputFormat: OutputFormat
  maxInputLength: number
  exampleCount: number
}

export interface AppConfig {
  version: 1
  provider: ProviderConfig
  analysis: AnalysisConfig
}

export const DEFAULT_PROMPT_TEMPLATE = `You are LinguaLens, a careful multilingual language tutor.
Analyze the supplied text according to its own language system. Never force English grammar categories onto another language.
Explain in {{explanationLanguage}} and translate into {{translationLanguage}}.
The learner level is {{learnerLevel}}, detail is {{detail}}, and terminology preference is {{terminology}}.
Source language selection: {{sourceLanguage}}.
Enabled analysis modules: {{modules}}.
Language-specific focus: {{languageStrategy}}.
Additional user instructions: {{customInstructions}}.

Return ONLY a valid JSON object. Do not use markdown fences. Use this shape while omitting no enabled module:
{
  "metadata": { "detectedLanguage": "", "explanationLanguage": "", "analysisLevel": "", "confidence": "high|medium|low" },
  "summary": { "meaning": "", "difficulty": "", "keyGrammar": [""] },
  "segments": [{ "text": "", "start": 0, "end": 0, "type": "", "explanation": "", "confidence": "high|medium|low" }],
  "grammar": [{ "form": "", "function": "", "explanation": "", "example": "", "confidence": "high|medium|low" }],
  "vocabulary": [{ "text": "", "lemma": "", "partOfSpeech": "", "meaning": "", "notes": "", "confidence": "high|medium|low" }],
  "translations": { "literal": "", "natural": "", "process": "" },
  "pronunciation": [{ "text": "", "reading": "", "system": "" }],
  "structure": { "overview": "", "wordOrder": "", "omissions": [""] },
  "usage": { "register": "", "tone": "", "contexts": [""], "notes": "" },
  "ambiguities": [{ "interpretation": "", "reason": "", "confidence": "high|medium|low" }],
  "examples": [{ "source": "", "translation": "", "note": "" }]
}
Use empty arrays or empty strings for enabled sections with no findings. For uncertain claims, say so and lower confidence.`

export const DEFAULT_PROVIDER: ProviderConfig = {
  baseUrl: 'https://api.openai.com/v1',
  path: '/chat/completions',
  model: 'gpt-4.1-mini',
  temperature: 0.2,
  maxTokens: 3000,
  topP: 1,
  timeoutMs: 60000,
  rememberKey: false,
}

