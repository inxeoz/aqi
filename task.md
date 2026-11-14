
### 📸 The Challenge Text (Exact Transcription)

**Header:** Google for Developers | I|2S | PromptWars (In-person) | Build with AI
**Title:** Warm-up Challenge
**Subtitle:** Civic Air Quality Briefing Studio

**The Prompt:**
> Develop an AI-driven civic intelligence solution that enables local authorities, housing societies, and ward-level teams to turn raw air quality data into actionable local interventions. The solution must leverage Generative AI as a core component to interpret pasted or uploaded data tables, including messy ones with inconsistent formats, units, or missing readings, and summarize trends and likely hotspots in plain language. It should recommend prioritized local actions suited to who is asking, since a ward officer, a housing society, and a school can each do different things. Every finding should be traceable to the underlying data, with data gaps and unreliable readings clearly flagged. The assistant should compare each new brief with the previous one to show what changed, and generate both an internal briefing note and a citizen advisory in multiple languages, written for different reading levels, with extra care for children, older adults, and people sensitive to poor air.

**Pro-Tip:**
> Functional checks are designed to evaluate your application as a whole, not just a single feature. Solutions with thoughtfully connected workflows and meaningful functionality provide evaluators with multiple opportunities to experience your application as intended. A well-rounded application is also more resilient to isolated implementation issues, reducing the likelihood of a single broken flow impacting the overall functional evaluation.

---

### 🎯 What the Evaluators are Looking For (The Checklist)

Based on this exact text, here is what you must show them in the demo to win:

1.  **GenAI is Core:** They want to see the AI doing the heavy lifting of *interpreting* the data (not just a dashboard with hardcoded if/else statements).
2.  **Messy Data Handling:** You must upload a table with mixed units (e.g., ppm and µg/m³) or missing values and show how your app cleans it.
3.  **Plain Language:** The AI must output easy-to-read text, not just raw numbers.
4.  **Traceability:** This is critical. They will click a sentence in the AI summary and expect to see the exact row of data that proves it.
5.  **Clear Flagging:** Data gaps (missing rows) and unreliable readings must be visibly marked (e.g., red flags).
6.  **Role-Based Actions:** You must show the app switching between Ward Officer, Housing Society, and School, and generating *different* actions for each.
7.  **Comparison (Diffing):** You must show Run 1 vs. Run 2.
8.  **Dual Documents:** Show the "Internal Briefing" vs. "Citizen Advisory".
9.  **Vulnerable Groups:** The citizen advisory *must* explicitly mention children, older adults, and sensitive groups.
10. **Multi-language & Reading Levels:** Prove it can output a "Child" level advisory in Hindi and an "Adult" level in English.

### 🛡️ Why the Spec We Built Wins
The Pro-Tip warns that a single broken flow ruins the evaluation. 
* If your API times out during the demo, a standard app crashes. **Your spec dictates a "Degraded State"** where the tables and metrics stay on screen with a yellow banner. You still pass the basic functional checks.
* If the AI hallucinates a citation, a standard app shows fake data. **Your spec dictates strict Zod schema validation and ID checking**, so fake data is deleted before it hits the screen.
* If a user gets confused, a standard chat app hides the data. **Your spec dictates a Chat + Canvas layout**, meaning the evaluator always sees the data table, the flags, and the brief side-by-side.
