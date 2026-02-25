'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

// ─────────────────────────────────────────────────────────────────────────────
// Blood Report Analyser (Buffer-based — used by the Telegram bot)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeBloodReportBuffer(
  fileBuffer: Buffer,
  mimeType: string,
  language = 'en',
): Promise<{ success: boolean; analysis?: string; error?: string }> {
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi',
    gu: 'Gujarati', pa: 'Punjabi',
  }
  const languageName = LANGUAGE_NAMES[language] ?? 'English'

  const SCRIPT_HINTS: Record<string, string> = {
    as: `CRITICAL — You are writing in Assamese (Asamiya), NOT Bengali. Strictly follow Assamese orthography:
- Use ৰ (Assamese ra) — never র (Bengali ra)
- Use ৱ (Assamese wa) — never ব for the wa-sound
- Use হ'ব, কৰিব, যোৱা, আহিব style Assamese verb forms
- Do NOT use Bengali verb endings (-ছে, -বে) or Bengali-only vocabulary
- Write naturally in Assamese as spoken in Assam`,
  }
  const scriptHint = SCRIPT_HINTS[language] ?? ''

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const generativePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    }

    const prompt = `You are a healthcare assistant helping a patient quickly understand their blood test report.

YOUR STYLE — two rules always applied together:

1. THE "SO WHAT?" RULE — never just state a number or define a test. Always say what it means for the patient.
   BAD: "Your HbA1c is 7.5%."
   GOOD: "Your average blood sugar is above the target range — this usually means diabetes management needs a review."

2. THE "NUDGE NOT DIAGNOSE" RULE — you cannot diagnose, but you can connect a finding to a possible symptom and prompt a question.
   BAD: "You have anemia."
   GOOD: "Your haemoglobin appears low — worth asking your doctor if this could explain any recent tiredness."

FORMAT RULES:
- Bullet points only. Do NOT use bullet symbols (•, -, *).
- Max 7 bullets total (excluding the final disclaimer bullet).
- Each bullet: ONE sentence, max 22 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- End with exactly this disclaimer bullet: "⚠ This is not medical advice — please discuss these results with your doctor."
- Write ENTIRELY in ${languageName}.
${scriptHint ? `\n${scriptHint}` : ''}

Blood report: [attached image]`

    const result = await model.generateContent([prompt, generativePart])
    const analysis = result.response.text() || 'No analysis available'
    return { success: true, analysis }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}

async function fileToGenerativePart(
  fileBuffer: Buffer,
  mimeType: string
) {
  try {
    return {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    }
  } catch (err) {
    const error = err as Error
    throw new Error(`fileToGenerativePart error: ${error.message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Medical Document Explainer
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeMedicalDocument(
  formData: FormData,
  language = 'en',
  context = ''
) {
  const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', hi: 'Hindi', as: 'Assamese', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', mr: 'Marathi',
    gu: 'Gujarati', pa: 'Punjabi',
  }
  const languageName = LANGUAGE_NAMES[language] ?? 'English'

  const SCRIPT_HINTS: Record<string, string> = {
    as: `CRITICAL — You are writing in Assamese (Asamiya), NOT Bengali. Strictly follow Assamese orthography:
- Use ৰ (Assamese ra) — never র (Bengali ra)
- Use ৱ (Assamese wa) — never ব for the wa-sound
- Use হ'ব, কৰিব, যোৱা, আহিব style Assamese verb forms
- Do NOT use Bengali verb endings (-ছে, -বে) or Bengali-only vocabulary
- Write naturally in Assamese as spoken in Assam`,
  }
  const scriptHint = SCRIPT_HINTS[language] ?? ''

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    const analysisResults = []

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const mimeType = file.type || 'application/octet-stream'
        const generativePart = await fileToGenerativePart(buffer, mimeType)

        const prompt = `You are a healthcare assistant helping a patient quickly understand their medical document.
Look at the document and respond with SHORT, PLAIN bullet points ONLY.

YOUR STYLE — two rules that must always be applied together:

1. THE "SO WHAT?" RULE — never just state a number or define a test. Always say what it means for the patient.
   BAD: "Your HbA1c is 7.5%."
   GOOD: "Your average blood sugar is above the target range, which usually means your diabetes management needs a review."

2. THE "NUDGE NOT DIAGNOSE" RULE — you cannot make a diagnosis, but you can connect a finding to a possible symptom and prompt a question.
   BAD: "You have anemia."
   GOOD: "Your iron levels appear low — worth asking your doctor if this could explain any recent tiredness."

FORMAT RULES:
- Bullet points only. Do NOT use bullet symbols (•, -, *).
- Max 6 bullets total (excluding the final disclaimer bullet).
- Each bullet: ONE sentence, max 20 words.
- Plain everyday words only — if a medical term is unavoidable, add a plain explanation in brackets immediately after.
- Do NOT recommend any specific treatment, drug, or dosage.
- End with exactly this disclaimer bullet: "⚠ This is not medical advice — please discuss these results with your doctor."
- Write ENTIRELY in ${languageName}.
${scriptHint ? `\n${scriptHint}` : ''}
${context ? `\nPatient note: ${context}` : ''}

Document: [attached image]`

        const result = await model.generateContent([prompt, generativePart])
        const responseText = result.response.text() || 'No explanation available'

        analysisResults.push({ fileName: file.name, analysis: responseText, success: true })
      } catch (fileError) {
        const error = fileError as Error
        analysisResults.push({ fileName: file.name, error: error.message, success: false })
      }
    }

    return { success: true, data: analysisResults, message: `Explained ${files.length} document(s)` }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message, data: null }
  }
}

export async function analyzeMedicalInsuranceDocs(formData: FormData) {
  try {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set')
    }

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      throw new Error('No files provided')
    }

    try {
      // Convert all files to generative parts
      const generativeParts = []

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const mimeType = file.type || 'application/octet-stream'
        const generativePart = await fileToGenerativePart(buffer, mimeType)
        generativeParts.push(generativePart)
      }

      // Create a comprehensive prompt that treats all documents as one context
      const prompt = `Act as a senior Medical Claims Officer specialized in Indian Government Health Schemes (PM-JAY, AB-PMJAY, and State Schemes like Atal Amrit Abhiyan). Your goal is to analyze the complete set of medical insurance documents provided to determine if a treatment is covered and cashless.

You have been provided with multiple documents (insurance cards, medical reports, hospital bills, etc.). Analyze them collectively as a complete medical insurance case, rather than separately.

INSTRUCTIONS:
1. First, extract the patient's identity and card status from any Health Card image(s). Identify the primary scheme (e.g., Ayushman Bharat or State-specific), the unique ID (PM-JAY ID/ABHA ID), and the home state.

2. Second, parse the Medical Report(s) to identify the specific diagnosis and the advised treatment or surgery. Map these findings to the official Health Benefit Packages (HBP) for 2026. Determine if the disease falls under secondary or tertiary care specialties such as Oncology, Cardiology, Nephrology, or General Surgery, which are typically covered under these schemes.

3. Third, evaluate the Hospital Bill(s) or Estimate(s). Specifically check if the patient is marked as an "In-Patient" (IPD), as these cards generally do not cover Out-Patient (OPD) consultations or external lab tests unless they lead to an admission.

4. Cross-reference all documents together to provide a comprehensive analysis. If documents appear to be from the same case, analyze them as a cohesive whole.

YOUR FINAL RESPONSE MUST INCLUDE:

**Coverage Verdict**: A clear "YES," "NO," or "PARTIAL" statement regarding bill coverage.

**Reasoning**: A detailed explanation of the decision based on all provided documents (e.g., matching the diagnosis to a specific government package, identifying hospital empanelment status, or noting mismatches).

**Document Summary**: Brief overview of what each document shows and how they relate to each other in the context of this insurance claim.

**Actionable Steps**: Specific instructions based on the verdict (finding nearest empanelled hospital, locating "Arogya Mitra" help desk, required documents, etc.).

**Hinglish Summary**: A 2-3 line empathetic summary in Hinglish that simplifies the technical verdict for the user.

CONSTRAINTS:
- Do not provide medical advice.
- If documents include non-medical consumables (gloves, masks, etc.), clearly state that these might be out-of-pocket expenses even if the primary treatment is covered.
- If any Card or Report is unclear, specify exactly which piece of information is missing to make a final determination.
- Analyze all documents as parts of one cohesive case, not as separate claims.
- Provide human readable, simple, brief and short response, not very long. Dont' use any symbols, only text and numbers if needed.`

      // Call Gemini API with all documents together
      const contentArray = [prompt, ...generativeParts]
      const result = await model.generateContent(contentArray)

      const responseText =
        result.response.text() || 'No analysis available'

      return {
        success: true,
        data: [
          {
            fileName: `Insurance Claim Analysis (${files.length} document${files.length > 1 ? 's' : ''})`,
            analysis: responseText,
            success: true,
          },
        ],
        message: `Analyzed ${files.length} document(s) collectively`,
      }
    } catch (analysisError) {
      const error = analysisError as Error
      return {
        success: false,
        error: error.message,
        data: null,
      }
    }
  } catch (err) {
    const error = err as Error
    return {
      success: false,
      error: error.message,
      data: null,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prescription Medicine Extractor  (structured JSON output for ICS export)
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicineSchedule {
  /** Full medicine name with dosage, e.g. "Amoxicillin 500mg" */
  name: string
  /** Human-readable duration, e.g. "7 days" */
  duration: string
  /** Duration as integer days (used for RRULE COUNT) */
  durationDays: number
  /** Human-readable frequency, e.g. "Twice daily" */
  frequency: string
  /**
   * Timings in 24-hour HH:MM format.
   * Extracted from prescription text or inferred from frequency.
   * Empty array → no calendar event should be created.
   */
  timings: string[]
}

export interface PrescriptionAnalysisResult {
  success: boolean
  medicines?: MedicineSchedule[]
  error?: string
}

export async function analyzePrescription(
  formData: FormData,
): Promise<PrescriptionAnalysisResult> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')

    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) throw new Error('No files provided')

    // Combine all uploaded prescription pages into one request
    const generativeParts = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        return fileToGenerativePart(buffer, file.type || 'application/octet-stream')
      }),
    )

    const prompt = `You are a medical prescription parser. Extract every medicine from the attached prescription and return ONLY a single valid JSON object — no markdown, no code fences, no explanation.

Return this exact structure:
{
  "medicines": [
    {
      "name": "Full medicine name with dosage (e.g. Amoxicillin 500mg)",
      "duration": "Duration as written (e.g. '7 days', '2 weeks', '1 month')",
      "durationDays": <integer — 7 for 7 days, 14 for 2 weeks, 30 for 1 month, 90 for 3 months>,
      "frequency": "Human-readable frequency (e.g. 'Twice daily', '3 times a day', 'Once daily at bedtime')",
      "timings": ["HH:MM", "HH:MM"]
    }
  ]
}

TIMING RULES (strictly follow):
1. If exact clock times are written (e.g. "8am, 2pm, 8pm"), convert to 24-hour HH:MM and use those exact values.
2. If only a frequency/instruction is given (no clock times), infer standard pharmacy times:
   - Once daily  → ["08:00"]
   - Twice daily  → ["08:00", "20:00"]
   - Three times daily → ["08:00", "14:00", "20:00"]
   - Four times daily  → ["06:00", "12:00", "18:00", "22:00"]
   - Before meals (3x) → ["07:30", "12:30", "19:00"]
   - After meals (3x)  → ["09:00", "14:00", "21:00"]
   - At bedtime        → ["22:00"]
   - Morning only      → ["08:00"]
   - Evening only      → ["20:00"]
3. If there is truly NO timing or frequency information for a medicine, set timings to [].
4. Never omit the timings field. Never set it to null.

durationDays rules:
- "X days"   → X
- "X weeks"  → X × 7
- "X months" → X × 30
- "as needed" / "SOS" / unknown → 30

Return ONLY the JSON. Nothing else.`

    const result = await model.generateContent([prompt, ...generativeParts])
    let responseText = result.response.text().trim()

    // Strip markdown code fences if the model added them anyway
    responseText = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(responseText)
    const medicines: MedicineSchedule[] = (parsed.medicines ?? []).map(
      (m: Partial<MedicineSchedule>) => ({
        name: m.name ?? 'Unknown medicine',
        duration: m.duration ?? 'Unknown',
        durationDays: typeof m.durationDays === 'number' ? m.durationDays : 30,
        frequency: m.frequency ?? 'As prescribed',
        timings: Array.isArray(m.timings) ? m.timings : [],
      }),
    )

    return { success: true, medicines }
  } catch (err) {
    const error = err as Error
    return { success: false, error: error.message }
  }
}
