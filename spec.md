# SPECIFICATION – CIVIC AIR QUALITY BRIEFING STUDIO
**Document ID:** CAS-BS-SPEC-002
**Language Standard:** ASD-STE100 (Simplified Technical English)
**Status:** Approved for Build

---

## 1. SCOPE

**1.1 Purpose**
This document specifies the requirements for the Civic Air Quality Briefing Studio. The software changes raw air quality data into local actions. It uses Generative AI to write plain-language summaries. It shows the source data for each finding. It compares new briefs with old briefs. It makes two types of documents in multiple languages.

**1.2 Goals**
The software must do these tasks:
1. Read air quality data from paste, CSV, Excel, or text PDF.
2. Find bad data and missing data. Show the problems to the user.
3. Use GenAI to write a short analysis. Refer each finding to the source rows.
4. Give different action lists to a Ward Officer, a Housing Society, and a School.
5. Compare the new brief with the last brief.
6. Make an Internal Briefing Note and a Citizen Advisory.
7. Write documents in 3 languages and 3 reading levels.
8. Include special sections for children, older adults, and sensitive people.
9. Keep the software available when the AI service fails.

---

## 2. DEFINITIONS

*   **Run:** One data upload and analysis cycle.
*   **Reading:** One data row after cleaning.
*   **Brief:** The AI analysis with source references.
*   **Finding:** One sentence in the brief.
*   **Action:** One task for a specific user role.
*   **Citation:** A link from a finding to a data row ID.
*   **Row ID:** A permanent label for a reading. Example: `R0042`.
*   **Quality Flag:** A label for bad data.
*   **Role:** The user type (Ward Officer, Housing Society, School).
*   **Degraded State:** The condition when the GenAI service fails.

---

## 3. SYSTEM ARCHITECTURE

**3.1 Technology Stack**
*   **Framework:** Next.js (App Router, TypeScript).
*   **Styling:** Tailwind CSS and shadcn/ui.
*   **Database:** SQLite in WAL mode.
*   **ORM:** Drizzle.
*   **File Parsing:** `papaparse` (CSV), `xlsx` (Excel), `unpdf` (PDF).
*   **PDF Output:** `@react-pdf/renderer`.
*   **AI Integration:** Vercel AI SDK.

**3.2 GenAI Pipeline**
You must use a two-model pipeline.
*   **Model 1 (Analyst):** Use an LLM with strict JSON schema support (e.g., `gpt-4o`). Set temperature to `0.1`. This model finds trends and selects actions.
*   **Model 2 (Writer):** Use a fast, multilingual LLM (e.g., `gpt-4o-mini`). Set temperature to `0.5`. This model writes the documents.
*   **Rule:** The system code calculates all numbers (means, ranks, deltas). The AI only writes text and cites the numbers.

---

## 4. DATA INGESTION AND QUALITY

**4.1 File Handling**
*   **First-class:** Paste, CSV, TSV, Excel. Parse fully. Assign Row IDs.
*   **Best-effort:** Text PDF. Extract table. **The user must confirm the extracted table before analysis.**
*   **Refuse:** Image PDF. Show this message: "Cannot read table. Paste the data or upload a CSV file."

**4.2 Quality Flags**
The software makes these checks in code before the AI call:
*   `MISSING_VALUE`: Empty cell.
*   `NEGATIVE_VALUE`: Value is less than zero.
*   `IMPLAUSIBLE_HIGH`: PM > 2000 µg/m³.
*   `UNIT_INCONSISTENT`: Column mixes units.
*   `DUPLICATE_ROW`: Same time, location, pollutant, value.
*   `STALE_GAP`: Missing more than 50% of expected time steps.
*   *Action:* Exclude `unreliable` rows from calculations. Show them as data gaps. Count `suspect` rows and note them in the brief.

---

## 5. GENERATIVE AI ANALYSIS

**5.1 Traceability Rule**
1. Send only calculated metrics and a sample of flagged rows to the AI. Do not send the full table.
2. Force the AI to output JSON with a Zod schema.
3. The AI must include `cited_row_ids` for every finding and action.
4. The code must check every ID against the database.
5. If an ID does not exist, remove the finding. Mark it `unverified`.

**5.2 Role Catalogs**
The AI must select actions from a fixed list:
*   **Ward Officer:** Inspections, road sweeping, public notices, traffic changes.
*   **Housing Society:** Shift outdoor work, wet mopping, community air purifiers, stop waste burning.
*   **School:** Move PE indoors, stop outdoor sports, mask advisories, classroom purifiers.
*   *Rule:* Output 4 to 6 actions. Rank them 1, 2, 3.

**5.3 Comparison Engine**
1. Match the current run to the last run with the same location scope.
2. Code calculates changes: hotspot rank shifts, metric changes (±15%), new/cleared flags.
3. AI writes one 150-word paragraph to explain the changes using the calculated data.

---

## 6. DOCUMENT GENERATION

**6.1 Document Types**
*   **Internal Briefing Note:** Scope, Trends (cited), Hotspots (cited), Data Gaps, Priority Actions, What Changed, Confidence.
*   **Citizen Advisory:** Current Quality, Today's Actions, **Section for Children**, **Section for Older Adults**, **Section for Sensitive People**, Updates, Disclaimer.
*   *Rule:* Vulnerable group sections must not be empty. If empty, retry generation. If it fails again, use the fixed template.

**6.2 Languages and Reading Levels**
*   **Languages:** English (`en`), Hindi (`hi`), Marathi (`mr`).
*   **Reading Levels:**
    *   `child`: Max 12 words per sentence. No jargon.
    *   `general`: Plain language. Explain terms once.
    *   `easy_read`: Max 8 words per sentence. One idea per line. Use lists.

---

## 7. UI/UX DESIGN SYSTEM (ANTI-SLOP)

The software must look like a government operations tool. It must not look like a consumer AI chat app.

**7.1 Prohibited Elements (No AI Slop)**
*   **NO** purple, violet, or blue-to-pink gradients.
*   **NO** glass effect (blur behind panels).
*   **NO** sparkle icons, star icons, or magic-wand icons.
*   **NO** round corners larger than 6 pixels on data elements.
*   **NO** floating cards with large soft shadows.
*   **NO** chat bubbles for data tables. Use structured grids.
*   **NO** "Welcome! How can I help you today?" empty states.

**7.2 Visual System**
*   **Colors (Air Quality Bands):**
    *   Good: `#2E7D32` (Green)
    *   Moderate: `#F9A825` (Yellow)
    *   Poor: `#EF6C00` (Orange)
    *   Very Poor: `#C62828` (Red)
    *   Background: `#F7F6F3` (Off-white)
    *   Panel: `#FFFFFF` (White)
    *   Border: `#D9D6CF` (Light Gray)
    *   Text: `#1A1A1A` (Near Black)
    *   Accent/Action: `#0B5D66` (Deep Teal)
*   **Typography:**
    *   Headings: IBM Plex Sans, 600 weight.
    *   Body: IBM Plex Sans, 400 weight, 14px.
    *   Numbers: IBM Plex Mono, tabular figures.
*   **Spacing:** 8-pixel grid. Padding sizes: 4, 8, 12, 16, 24, 32. Borders are 1px solid.

**7.3 Layout Structure**
*   **Top Bar:** 48px height. Contains logo, current organization name, and "Run History" link. 1px bottom border.
*   **Left Panel (35% width):** Command Chat.
    *   File drop zone and paste box at top.
    *   Message thread. Use for short commands (e.g., "Make this for a school").
    *   Follow-up input at bottom.
*   **Right Panel (65% width):** Data Canvas.
    *   Step indicator at top (DATA → QUALITY → BRIEF → ACTIONS → CHANGES → DOCUMENTS).
    *   Shows the active UI artifact.

**7.4 Screen Specifications**
*   **DATA (Step 1):** Render a dense table. Sticky header. Zebra stripes (`#FAFAF8`). Row height 32px. A warning banner appears if the source was a PDF. Bottom button: "Confirm and check quality".
*   **QUALITY (Step 2):** Top row shows 4 count tiles (Total, Usable, Suspect, Unusable). Below is a filter bar with flag chips. Below is the flag table. Click a row to open a side drawer with "Exclude this row" button.
*   **BRIEF (Step 3):** Three sections (Trends, Hotspots, Gaps). Each finding is a card with 1px border. Below the text are citation chips (e.g., `[R0042]` in monospace). Clicking a chip highlights the source row in the data table.
*   **ACTIONS (Step 4):** Three role selector buttons at top. Below are action cards. Cards have a colored priority square (Teal = 1, Orange = 2, Gray = 3).
*   **CHANGES (Step 5):** Two-column table (Previous vs This Brief). Middle column has arrows (Up = Red, Down = Green). AI summary text below.
*   **DOCUMENTS (Step 6):** Control row (Type tabs, Language dropdown, Reading Level buttons). Below is a white paper preview. Vulnerable group sections have a 3px teal left bar. Download PDF/Markdown buttons at bottom.

---

## 8. RESILIENCE (PRO-TIP COMPLIANCE)

**8.1 Degraded State**
If the AI API fails or times out:
1. Show a yellow banner: "The AI service is not available. You can see your data and the quality report."
2. Disable "Write brief" and "Make documents" buttons.
3. Keep all data tables, calculated metrics, and quality flags visible.
4. Show a "Retry" button.

**8.2 Document Fallback**
If document generation fails:
1. Use a fixed text template.
2. Inject calculated metrics and catalog actions into the template.
3. Mark the document as `generated_by: fallback_template`.
4. Show a notice in the UI: "The AI service did not respond. This document used a standard template."

**8.3 PDF Fallback**
If PDF generation fails, automatically offer a Markdown download.

---

## 9. ACCEPTANCE TESTS

The system is ready if it passes these tests:
1. **Messy Data:** Paste a table with mixed units and empty cells. The system flags errors and cites real Row IDs.
2. **Traceability:** Click a citation chip in the brief. The source row highlights in the data table.
3. **Roles:** Switch role from Ward Officer to School. The action list changes.
4. **Comparison:** Run the system twice. The second run shows a diff with arrows.
5. **Documents:** Generate a Child-level Citizen Advisory in Hindi. It includes the children's section.
6. **Resilience:** Turn off internet. The system shows the data table and flags. The system does not crash.
