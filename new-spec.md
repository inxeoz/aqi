# **Technical Specification: AI-Driven Civic Air Quality Intelligence Platform**

Functional specification

Frontend + Backend

AI-powered

**Project objective:** Build a platform that converts unstructured and structured air-quality data into validated datasets, geographical insights, actionable recommendations, and multilingual reports for local authorities, housing societies, schools, and citizens.

I recommend designing this as a **data-processing and decision-support platform**, not a chatbot with file-upload functionality.

The specification below is technology-independent at the architectural level. It also includes a suggested Python-based implementation.

## **1. System architecture**

[Emerging Trends and Use Cases of Industry-Specific LLM Applications | by Sciforce | Sciforce | Medium](https://images.openai.com/static-rsc-4/TwRj_aR_X-xJbW-UgoG396IxZKhOYwanajFvVxR0QhVMLIfoDy16k-FcBGmje-abonoAMUuxRY200zzrl1hgaAsUhAm3L3J3f5BzRnmaqzS9KNUZqaTSYa3IcIiXWghc0I_a0aB1bF1zBIwz6zm3r490RHt95b4tIqcw4Hju-f0?purpose=inline)

[medium.com](https://medium.com/sciforce/emerging-trends-and-use-cases-of-industry-specific-llm-applications-9a7e40b03122?utm_source=chatgpt.com)

The platform has five major components:

1. **Frontend application:** User input, processing progress, data review, maps, insights, recommendations and reports.
2. **Backend API:** Authentication, sessions, file management, permissions and business logic.
3. **Data processing engine:** Extraction, normalization, validation and transformation.
4. **AI intelligence engine:** Data interpretation, explanation, recommendation generation and report writing.
5. **Storage and analytics:** Original files, normalized datasets, findings, historical reports and audit logs.

### **High-level architecture**

```
                    FRONTEND
                        |
                        v
                   BACKEND API
                        |
              Analysis Session Manager
                        |
              Job / Pipeline Manager
                        |
          +-------------+-------------+
          |             |             |
          v             v             v
      Extraction    AI Engine     Storage
          |             |             |
          v             v             |
      Normalization     |             |
          |             |             |
          v             |             |
      Validation        |             |
          |             |             |
          v             v             |
      Analytics ----> Insights        |
          |             |             |
          +------> Recommendations    |
                        |             |
                        v             |
                 Report Generator    |
                        |             |
                        +-------------+
                               |
                               v
                         DATABASE
```

**Important architectural rule:** The LLM must not be responsible for directly calculating pollution statistics or silently modifying readings. Python-based deterministic processing must handle numerical operations, while AI handles interpretation and language generation.

## **2. Frontend specification**

### **2.1 Main application navigation**

The application should have two main areas:

| Section            | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| Dashboard          | Overview of previous analyses and saved reports |
| New Analysis       | Start a new air-quality analysis                |
| Analysis History   | Access previous analysis sessions               |
| Briefings          | Saved internal reports                          |
| Citizen Advisories | Saved public reports                            |
| Settings           | Language, profile and preferences               |

The primary user journey starts with **New Analysis**.

### **2.2 Page 1 — Data input**

Required

**Objective:** Accept any supported air-quality information without requiring the user to understand data formats.

[Drag And Drop File Upload UX | Add Documents by Zahir Patel on Dribbble](https://images.openai.com/static-rsc-4/17xpQHankALEvxX1AI9eCiwBkKJdTFDsleoYIFTYeI7ilIK1Eq_MUxHEHZavZwfcyqCBV-6Qc4DRKDGlt_HGysv1Wks5URVsxUo7ZzRvesfguCNWfHhC2yH0GcSmvtkHDUgSZLeFvQCocRA2J-M3nQhok0n_TP_0r8X79Y-BfRs?purpose=inline)

[dribbble.com](https://dribbble.com/shots/6850519-Drag-And-Drop-File-Upload-UX-Add-Documents?utm_source=chatgpt.com)

Components:

| Component       | Behaviour                                   |
| --------------- | ------------------------------------------- |
| Text input      | Accept long text, pasted tables and reports |
| File upload     | Accept supported document formats           |
| Multiple upload | Allow multiple files in one session         |
| File preview    | Show uploaded filenames, sizes and types    |
| Remove file     | Remove individual files before submission   |
| Submit          | Start a new analysis session                |

Supported input formats:

- CSV
- XLS / XLSX
- PDF
- DOC / DOCX
- TXT
- JSON
- JPG / JPEG
- PNG

Other formats can be supported through additional extractors, but unsupported or unsafe files must be rejected with an explanation.

**Input rules:**

- Text, files, or both must be accepted.
- Empty submissions must be rejected.
- File size and count limits must be configurable.
- Original files must remain unchanged.
- Each submission must create a unique Analysis Session.

**Output:** `analysis_id`

### **2.3 Page 2 — Processing progress**

Required

**Objective:** Give users visibility into what the system is doing.

[AI Adoption Platform for Businesses & AI Agents | 27x.ai](https://images.openai.com/static-rsc-4/zt9uw3rGLAAzVfFAE_evkVLrlaafChlZ8uUxcmstzXCbuAPGUkqsPvHYLptpVGQWch6b6NVP1JmWlJU7cXaj4fI0pVyucFVlboxhTbwH2EE6jVmWJyNdWTIMAQ00LgLs-HPHepHjaCNs4uBwtVHjcrm9lmvweq_9cdBIC23y1UQ?purpose=inline)

[27x.ai](https://27x.ai/?utm_source=chatgpt.com)

Show these stages:

| Stage                 | Description                           |
| --------------------- | ------------------------------------- |
| Uploading             | Store user input                      |
| Extracting            | Extract text, tables and metadata     |
| Interpreting          | Identify pollutants, fields and units |
| Transforming          | Standardize data                      |
| Validating            | Check data quality                    |
| Geospatial processing | Resolve available locations           |
| Analyzing             | Calculate trends and hotspots         |
| Generating insights   | Generate explanations using AI        |

Each stage should have:

- Pending status
- Running status
- Completed status
- Failed status
- Warning status

Additional information:

- Current processing stage.
- Progress percentage, if measurable.
- Processing logs in user-friendly language.
- Retry option for recoverable failures.
- Cancel option.
- Error details where appropriate.

**Technical requirement:** Processing must be asynchronous. Do not keep an HTTP request open while processing large files.

The frontend should receive status updates through Server-Sent Events (SSE) or WebSockets, with polling as a fallback.

### **2.4 Page 3 — Input quality assessment**

Required

**Objective:** Help users understand whether their data can support reliable conclusions.

[Data quality](https://images.openai.com/static-rsc-4/hfBCpDGyxjOuyIJXJjVTB-dJI5bRe6xYYvJ0au84mBYgAUjD77y9fpWIPeludqjamMXE4vJ6ChQrRKsISmT6ISuUdi60yHrMOXWCzdUqbKPJvpJ0j7Ynm3EtMRjX4sD4GSuqUvsdfCP82rwjp4X9DIZrxkWY_a_Ksv--lyd2ijw?purpose=inline)

[docs.getmontecarlo.com](https://docs.getmontecarlo.com/docs/data-quality?utm_source=chatgpt.com)

Display the following:

**A. Quality overview**

- Total records.
- Valid records.
- Invalid records.
- Missing readings.
- Duplicate records.
- Unrecognized fields.
- Unknown units.
- Unresolved locations.

**B. Quality dimensions**

| Dimension    | Meaning                                       |
| ------------ | --------------------------------------------- |
| Completeness | How much expected data is available           |
| Validity     | Whether values match expected rules           |
| Consistency  | Whether formats and units are consistent      |
| Timeliness   | Whether readings are recent enough            |
| Traceability | Whether findings can be linked to source data |

**C. Data issues**

Example:

| Issue             | Example                    | Suggested resolution |
| ----------------- | -------------------------- | -------------------- |
| Missing unit      | PM2.5 = 85                 | Confirm unit         |
| Missing location  | Station not identified     | Add location         |
| Invalid value     | Negative PM2.5             | Review source        |
| Missing timestamp | No reading date            | Provide timestamp    |
| Duplicate         | Same station and timestamp | Review duplicates    |

**User actions:**

- Review warnings.
- Correct recognized fields.
- Confirm uncertain units.
- Map unknown columns.
- Continue with warnings.
- Return to input.

Do not manufacture missing readings or treat missing data as zero.

**Important:** Do not display a single quality percentage as if it proves measurement accuracy. Separate data completeness from validity and source reliability.

### **2.5 Page 4 — Transformed data explorer**

Required

**Objective:** Allow users to inspect the normalized dataset before accepting the AI's conclusions.

[How Air Aware Achieved 93% Better Public Engagement with AI | OpenKit Case Study](https://images.openai.com/static-rsc-4/-dnBfloVq2ARHYUDThOsbU5tm0fQqPPqiTLSzadMzLGIaT_Dy6W7KhEr4wqedYZQjphGojCeYEjdo28xJKUWrGWNZiHww7NdAhJUzK9t_Z0Ax8L2T4dtkp49m_WuxLITzfwDGUnKpRiuOa0jR8MREQ7yjYuNAsH5ZqCkNbxzSt4?purpose=inline)

[openkit.co.uk](https://openkit.co.uk/portfolio/air-aware?utm_source=chatgpt.com)

The page should have four sections.

**A. Dataset summary**

- Dataset name.
- Number of records.
- Number of stations.
- Date range.
- Identified pollutants.
- Measurement units.
- Data source.

**B. Transformed table**

Recommended columns:

| Column       | Description                |
| ------------ | -------------------------- |
| Timestamp    | Measurement date and time  |
| Location     | Station or area            |
| Latitude     | Geographic latitude        |
| Longitude    | Geographic longitude       |
| PM2.5        | Fine particulate matter    |
| PM10         | Coarse particulate matter  |
| NO2          | Nitrogen dioxide           |
| SO2          | Sulphur dioxide            |
| CO           | Carbon monoxide            |
| Data quality | Validity and warning flags |

The actual columns must be dynamic. Do not assume every dataset contains all pollutants.

Features:

- Search.
- Sorting.
- Filtering.
- Pagination.
- Column visibility.
- Export CSV.
- Original/transformed value comparison.
- Warning indicators per record.

**C. Geographic map**

Show locations when coordinates or sufficiently reliable location information are available.

Map features:

- Station markers.
- Pollution intensity visualization.
- Hotspot identification.
- Location-specific readings.
- Time filters.
- Missing location indicators.

Do not plot guessed coordinates as verified measurement locations. Approximate geocoding must be identified as approximate.

**D. Data lineage**

Every transformed record should provide access to:

- Original source file.
- Original row or page.
- Original column.
- Transformation applied.
- Validation result.

### **2.6 Page 5 — Insights and recommendations**

Core feature

**Objective:** Convert analyzed data into understandable findings and practical actions.

[BreatheairMind - Air Quality Monitor - Air Maps by Rizal Ramadhan ☣ on Dribbble](https://images.openai.com/static-rsc-4/cJmwdkSCG417dX9XJkQwp44UbRSYH3m75aiWyWSm2q8bFegVhEy9Fnx20o9tLvbxuJXchgQrG2blvBpJe1GSM6ysjFE78gcm5mzPYcSB_NwJOSaxaZQz9lObr86P7eMBcn_EWq5uCkhDHXgvU_Ng_79OY6Rk9PSxGfoWSsiCjYI?purpose=inline)

[dribbble.com](https://dribbble.com/shots/22347751-BreatheairMind-Air-Quality-Monitor-Air-Maps?utm_source=chatgpt.com)

First, show general insights independent of the selected role.

**A. General insights**

- Overall pollution trends.
- Pollutant-wise trends.
- Potential pollution hotspots.
- Unusual readings.
- Changes over time.
- Areas with insufficient data.

**B. Role selection**

Allow users to select their operational context.

| Role                 | Main responsibilities                    |
| -------------------- | ---------------------------------------- |
| Ward officer         | Ward-level pollution interventions       |
| Housing society      | Society-level pollution management       |
| School administrator | Student protection and school activities |
| Other                | General recommendations                  |

Role selection must change the recommendations, not the underlying measurements or facts.

**C. Recommendation cards**

Each recommendation must contain:

| Field            | Description                     |
| ---------------- | ------------------------------- |
| Title            | Suggested action                |
| Priority         | Critical / High / Medium / Low  |
| Reason           | Why this action is suggested    |
| Evidence         | Supporting measurements         |
| Location         | Where to take action            |
| Action owner     | Who should act                  |
| Expected outcome | Intended improvement            |
| Timeframe        | Suggested implementation period |
| Confidence       | Strength of supporting evidence |

**D. User interactions**

- Accept recommendation.
- Reject recommendation.
- Edit recommendation.
- Add comments.
- Mark as completed.
- Save for briefing.

An accepted recommendation must not automatically be treated as an implemented action.

### **2.7 Page 6 — Briefing and citizen advisory**

Core feature

**Objective:** Produce separate outputs for decision-makers and citizens.

[Carbon Capture Storage x UK Government — Hannah Dollery Portfolio](https://images.openai.com/static-rsc-4/WugmuP0L1rqmN0XOdxSuvXkAQgrr8MWZ1V5rTOccmzqz0yf5_AbUyDFWW2maMcxb_80W934ShjvkwnQ5B1dBOEq0iDmT5BiwZQcoEFU74bscZsn0IVRwNDAStWoaMQCCe9oq2kyHVEZ3_HQshmL7hQss0O0bCdR8ipjoSzkIfuE?purpose=inline)

**Internal briefing**

Detailed, evidence-based and action-oriented.

[nychealthy (@nycHealthy) on X](https://images.openai.com/static-rsc-4/NI-e-qSpCG6juWqhLTLPyhcUWzXOYb-lkkvKdAHD2BlO8cDbI_6G-Tlr6mry34MvbvbExGAKm56ccM2-U-wNn7bJFv9U0-FKyc1aqPHKIzYyIwuvqyF4xLqYvAdKTfr_RSEEaxmuzNniPaypvjOtQHQv4gFqd3QGSvugZWCUdTU?purpose=inline)

**Citizen advisory**

Simple, accessible and safety-oriented.

**Internal briefing structure:**

1. Executive summary.
2. Analysis period.
3. Data sources.
4. Data quality assessment.
5. Pollution trends.
6. Potential hotspots.
7. Comparison with previous report.
8. Priority recommendations.
9. Responsible departments.
10. Evidence and limitations.

**Citizen advisory structure:**

1. Current air-quality situation.
2. Affected areas.
3. What citizens should do.
4. Outdoor activity guidance.
5. Special guidance for children.
6. Guidance for older adults.
7. Guidance for people sensitive to poor air.
8. Emergency and health guidance where appropriate.
9. Source and publication date.

**Report configuration:**

- Report type.
- Language.
- Reading level.
- Target audience.
- Geographic scope.
- Analysis period.

For an Indian deployment, initial language support could include English and Hindi, with additional regional languages later.

**Saving behaviour:**

- Save as draft.
- Save approved version.
- Edit.
- Regenerate.
- Export PDF.
- View version history.
- Compare with previous reports.

Only authorized users can publish citizen advisories.

## **3. Backend specification**

The backend must be divided into independent services/modules. Avoid putting all processing logic inside one API endpoint.

### **3.1 Backend modules**

| Module                | Responsibility                       |
| --------------------- | ------------------------------------ |
| Authentication        | User login and permissions           |
| Analysis Manager      | Create and manage analysis sessions  |
| File Manager          | Upload, validate and store files     |
| Extraction Engine     | Extract text and tables              |
| AI Interpretation     | Understand unknown structures        |
| Transformation Engine | Normalize data                       |
| Validation Engine     | Validate records                     |
| Geospatial Engine     | Resolve coordinates and locations    |
| Analytics Engine      | Calculate statistics and trends      |
| AI Insight Engine     | Explain analytical results           |
| Recommendation Engine | Generate role-specific actions       |
| Comparison Engine     | Compare previous analyses            |
| Report Engine         | Generate briefings and advisories    |
| Notification Engine   | Notify users about processing status |

Each module should have a defined responsibility and communicate through explicit interfaces.

### **3.2 Data ingestion service**

**Input:**

- Pasted text.
- Uploaded documents.
- Multiple files.
- Structured datasets.

**Responsibilities:**

1. Validate file extension and actual file type.
2. Check file size.
3. Generate unique file IDs.
4. Store original files.
5. Calculate file checksum.
6. Extract file metadata.
7. Create extraction jobs.

**Output:**

```
{
  "analysis_id": "ANL-00001",
  "status": "queued",
  "files": [
    {
      "file_id": "FILE-00001",
      "filename": "air_quality.csv",
      "format": "csv",
      "status": "pending"
    }
  ]
}
```

IDs above are illustrative.

### **3.3 Extraction engine**

Different formats require different extraction strategies.

| Format      | Extraction method    |
| ----------- | -------------------- |
| CSV         | Pandas / Polars      |
| XLSX        | openpyxl / Pandas    |
| PDF         | PyMuPDF / pdfplumber |
| DOCX        | python-docx          |
| TXT         | Native text parsing  |
| JSON        | JSON parser          |
| Images      | OCR                  |
| Scanned PDF | OCR                  |

The extraction engine should preserve:

- Original text.
- Table structure.
- Row and column positions.
- Page numbers.
- Sheet names.
- Source file references.

**Fallback:** If normal extraction fails, use OCR or AI-assisted extraction where appropriate.

Extraction must never silently discard tables that could contain relevant readings.

### **3.4 AI interpretation engine**

This is where Generative AI becomes a core component.

The AI receives extracted data and determines:

- Which columns represent pollutants.
- Which fields represent locations.
- Which fields represent dates.
- Which units are being used.
- Whether the table contains multiple datasets.
- Whether data is relevant to air quality.
- Whether a field interpretation is uncertain.

Example input:

```
Area      Date        Fine Dust    Coarse Dust
Ward 01   12-11-2026  85           140
Ward 02   12-11-2026  65           110
```

Possible AI interpretation:

```
{
  "columns": [
    {
      "source": "Area",
      "target": "location",
      "confidence": 0.99
    },
    {
      "source": "Date",
      "target": "timestamp",
      "confidence": 0.99
    },
    {
      "source": "Fine Dust",
      "target": "PM2.5",
      "confidence": 0.91,
      "requires_confirmation": true
    },
    {
      "source": "Coarse Dust",
      "target": "PM10",
      "confidence": 0.91,
      "requires_confirmation": true
    }
  ]
}
```

The interpretation is a proposal, not an unquestionable fact. In particular, the unit and averaging period must be confirmed or supported by source metadata.

**Technical requirements:**

- Use structured JSON output.
- Validate AI output against a schema.
- Store model and prompt versions.
- Store confidence and uncertainty.
- Require confirmation for ambiguous mappings.
- Never allow AI-generated values to replace original readings.

### **3.5 Transformation engine**

Convert different input formats into a common data model.

I recommend a canonical schema.

**Canonical air-quality measurement:**

```
{
  "record_id": "REC-00001",
  "timestamp": "2026-11-12T10:00:00",
  "location": {
    "name": "Ward 01",
    "latitude": null,
    "longitude": null
  },
  "pollutant": "PM2.5",
  "value": 85,
  "unit": "ug/m3",
  "averaging_period": null,
  "source_file_id": "FILE-00001",
  "source_sheet": null,
  "source_row": 2,
  "quality_flags": []
}
```

A long-format canonical measurement model is preferable to a fixed table with PM2.5, PM10, NO2 and other columns. It supports new pollutants without changing the database structure.

Transformation rules:

1. Normalize column names.
2. Normalize date and time formats.
3. Standardize pollutant identifiers.
4. Convert compatible units.
5. Normalize location names.
6. Preserve original units and values.
7. Flag missing values.
8. Detect duplicates.
9. Detect invalid values.
10. Preserve source lineage.

**Important distinction:**

- Missing value: no reading provided.
- Invalid value: reading violates validation rules.
- Outlier: unusual reading requiring review.
- Zero: an actual reported numerical value.

These must never be treated as interchangeable.

### **3.6 Validation engine**

Validation must happen before analytics.

Suggested validation rules:

| Rule                  | Example                                         |
| --------------------- | ----------------------------------------------- |
| Required timestamp    | Timestamp missing                               |
| Required pollutant    | Unknown pollutant                               |
| Unit compatibility    | PM2.5 reported in an incompatible unit          |
| Numeric validation    | Text in numeric field                           |
| Date validation       | Invalid date                                    |
| Duplicate validation  | Repeated measurement                            |
| Geographic validation | Invalid coordinates                             |
| Range validation      | Physically or operationally implausible reading |
| Freshness validation  | Old measurement                                 |

Validation should produce structured results:

```
{
  "total_records": 1000,
  "valid_records": 920,
  "invalid_records": 30,
  "records_with_warnings": 50,
  "missing_values": 25,
  "duplicate_records": 5,
  "quality_status": "warning",
  "issues": [
    {
      "type": "missing_unit",
      "severity": "high",
      "affected_records": 12,
      "message": "Measurement unit could not be identified"
    }
  ]
}
```

These counts are illustrative.

Do not use a generic percentage as a substitute for measurement accuracy. A dataset can be complete but still have unreliable sensors.

### **3.7 Geospatial engine**

**Objective:** Convert location information into geographical information.

Input can include:

- Latitude and longitude.
- Station names.
- Ward names.
- Area names.
- Addresses.
- Geographic boundaries.

Processing:

1. Detect existing coordinates.
2. Validate coordinates.
3. Geocode identifiable locations where necessary.
4. Match locations to ward boundaries where boundary data is available.
5. Identify unresolved locations.
6. Associate measurements with geographic areas.

Output:

- Map-ready coordinates.
- Location IDs.
- Ward associations.
- Geocoding confidence.
- Location resolution status.

For hotspot analysis, use actual spatial and temporal measurements. Do not classify a location as a confirmed hotspot merely because its address or name appears in the uploaded document.

### **3.8 Analytics engine**

This engine performs calculations using Python, not an LLM.

**Required analytical capabilities:**

| Analysis             | Purpose                         |
| -------------------- | ------------------------------- |
| Average              | Average pollutant concentration |
| Minimum / Maximum    | Identify measurement extremes   |
| Time series          | Show pollution changes          |
| Percentage change    | Compare periods                 |
| Location comparison  | Compare areas                   |
| Pollutant comparison | Compare pollutants              |
| Threshold comparison | Check applicable standards      |
| Anomaly detection    | Identify unusual readings       |
| Hotspot analysis     | Identify spatial concentrations |

For example:

\\[ \text{Percentage Change} = \frac{\text{Current}-\text{Previous}} {\text{Previous}}\times100 \\]

The analytics engine must also consider:

- Measurement averaging periods.
- Sampling frequency.
- Sensor reliability.
- Time alignment.
- Missing readings.
- Comparable reporting periods.

A 24-hour average should not be directly compared with an instantaneous reading as if they were equivalent.

**Standards integration:** Use configurable, authoritative air-quality standards. Store the standard, pollutant, unit, averaging period, geographic applicability and effective date. For India, the relevant CPCB/NAAQS standards should be configurable rather than hardcoded into the application.

### **3.9 AI insight engine**

This module receives verified analytical results and generates plain-language explanations.

It should not receive unrestricted authority to invent findings.

Example structured input:

```
{
  "area": "Ward 01",
  "pollutant": "PM2.5",
  "current_average": 85,
  "previous_average": 70,
  "percentage_change": 21.43,
  "measurement_unit": "ug/m3",
  "data_quality": "warning",
  "evidence_ids": ["FIND-001", "FIND-002"]
}
```

Expected output:

```
{
  "finding": "PM2.5 increased compared with the previous period.",
  "severity": "high",
  "explanation": "The measured average increased by approximately 21.4%.",
  "limitations": [
    "Some readings are missing."
  ],
  "evidence_ids": [
    "FIND-001",
    "FIND-002"
  ]
}
```

The AI should generate:

- Executive summaries.
- Trend explanations.
- Potential hotspot descriptions.
- Uncertainty explanations.
- Likely contributing factors, when supported by evidence.
- Suggested areas requiring investigation.

**Critical restriction:** The platform must distinguish measured pollution from suspected causes. For example, a high PM10 reading does not prove that construction activity caused it.

### **3.10 Recommendation engine**

This module generates recommendations based on three inputs:

1. Validated findings.
2. User's selected role.
3. A predefined action catalogue.

I recommend a hybrid architecture:

```
Validated Findings
        |
        v
Action Catalogue
        |
        v
Role Filtering
        |
        v
AI Recommendation Generation
        |
        v
Evidence Validation
        |
        v
Prioritized Recommendations
```

Example action catalogue:

| Action                             | Applicable role |
| ---------------------------------- | --------------- |
| Inspect construction sites         | Ward officer    |
| Control road dust                  | Ward officer    |
| Review waste-burning complaints    | Ward officer    |
| Enforce construction dust controls | Housing society |
| Improve waste segregation          | Housing society |
| Review outdoor activities          | School          |
| Communicate pollution advisories   | School          |

The catalogue should be configurable and allow administrators to add actions.

**Priority assignment:**

- Critical: Immediate attention under defined safety or regulatory criteria.
- High: Significant concern requiring prompt intervention.
- Medium: Improvement required.
- Low: Preventive or routine action.

The system must not confuse an AI-generated priority with an official emergency classification.

### **3.11 Historical comparison engine**

This is an important requirement and should be an independent backend module.

When a new analysis is completed:

1. Find the previous relevant analysis.
2. Check whether geographic coverage is comparable.
3. Check whether pollutant and units match.
4. Check whether averaging periods match.
5. Compare equivalent time periods.
6. Identify changed findings.
7. Identify new and resolved hotspots.
8. Identify changes in data quality.
9. Generate a comparison summary.

Example:

```
{
  "comparison_status": "completed",
  "previous_analysis_id": "ANL-00010",
  "current_analysis_id": "ANL-00011",
  "changes": [
    {
      "location": "Ward 01",
      "pollutant": "PM2.5",
      "previous_value": 70,
      "current_value": 85,
      "change_percent": 21.43,
      "status": "increased"
    }
  ]
}
```

If no comparable previous report exists, the system should clearly display that comparison is unavailable.

### **3.12 Report generation engine**

The report engine should receive structured findings, recommendations and comparison results.

It must generate two independent document types.

**Internal briefing:**

- Detailed findings.
- Evidence references.
- Technical limitations.
- Priority actions.
- Responsible parties.
- Previous-report comparison.

**Citizen advisory:**

- Simple language.
- Local context.
- Actionable precautions.
- Vulnerable-group guidance.
- Multilingual content.

Additional requirements:

- Language selection.
- Reading-level selection.
- Translation review.
- Version control.
- PDF export.
- Approval workflow.
- Publication status.

Safety guidance must be consistent with verified public-health guidance. The AI must not diagnose individuals or prescribe medication.

## **4. Database specification**

I recommend a relational database such as PostgreSQL. PostGIS can be added for geographical queries.

### **4.1 Main entities**

**Database relationship overview**

\#chatgpt-mermaid-\_r_q0\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_q0\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_q0\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_q0\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_q0\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_q0\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_q0\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_q0\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_q0\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_q0\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_q0\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_q0\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_q0\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_q0\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;}#chatgpt-mermaid-\_r_q0\_ p{margin:0;}#chatgpt-mermaid-\_r_q0\_ .entityBox{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_q0\_ .relationshipLabelBox{fill:rgb(243, 243, 243);opacity:0.7;background-color:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_q0\_ .relationshipLabelBox rect{opacity:0.5;}#chatgpt-mermaid-\_r_q0\_ .labelBkg{background-color:rgba(243, 243, 243, 0.5);}#chatgpt-mermaid-\_r_q0\_ .edgeLabel{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_q0\_ .edgeLabel .label rect{fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_q0\_ .edgeLabel .label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_q0\_ .edgeLabel .label{fill:rgb(83, 154, 248);font-size:14px;}#chatgpt-mermaid-\_r_q0\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_q0\_ .edge-pattern-dashed{stroke-dasharray:8,8;}#chatgpt-mermaid-\_r_q0\_ .node rect,#chatgpt-mermaid-\_r_q0\_ .node circle,#chatgpt-mermaid-\_r_q0\_ .node ellipse,#chatgpt-mermaid-\_r_q0\_ .node polygon{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_q0\_ .relationshipLine{stroke:rgb(143, 143, 143);stroke-width:1px;fill:none;}#chatgpt-mermaid-\_r_q0\_ .marker{fill:none!important;stroke:rgb(143, 143, 143)!important;stroke-width:1;}#chatgpt-mermaid-\_r_q0\_ [data-look=neo].labelBkg{background-color:rgba(243, 243, 243, 0.5);}#chatgpt-mermaid-\_r_q0\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_q0\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_q0\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_q0\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_q0\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q0\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_q0\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_q0\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;}USERANALYSIS_SESSIONUPLOADED_FILEDATASETMEASUREMENTQUALITY_ISSUEFINDINGCOMPARISONRECOMMENDATIONRECOMMENDATION_ACTIONREPORTREPORT_VERSIONFINDING_EVIDENCEcreatescontainsgeneratescontainshasproduceshasproducestracksgeneratescontainssupported_byreferenced_by

### **4.2 Table definitions**

| Table                    | Important fields                                               |
| ------------------------ | -------------------------------------------------------------- |
| `users`                  | id, name, email, role                                          |
| `analysis_sessions`      | id, user_id, status, created_at, completed_at                  |
| `uploaded_files`         | id, analysis_id, filename, storage_path, checksum              |
| `extraction_results`     | id, file_id, extracted_content, extraction_status              |
| `datasets`               | id, analysis_id, dataset_type, schema, record_count            |
| `measurements`           | id, dataset_id, timestamp, location_id, pollutant, value, unit |
| `locations`              | id, name, latitude, longitude, ward_id                         |
| `quality_issues`         | id, dataset_id, record_id, issue_type, severity                |
| `findings`               | id, analysis_id, finding_type, description, confidence         |
| `finding_evidence`       | finding_id, measurement_id, source_reference                   |
| `comparisons`            | id, current_analysis_id, previous_analysis_id, result          |
| `recommendations`        | id, analysis_id, role, priority, description, status           |
| `recommendation_actions` | id, recommendation_id, action, owner, completion_status        |
| `reports`                | id, analysis_id, report_type, language, status                 |
| `report_versions`        | id, report_id, version, content, created_at                    |
| `audit_logs`             | id, user_id, action, entity_type, entity_id, created_at        |

Use separate tables for pollutant metadata, unit definitions, standards, action catalogues, and role permissions.

### **4.3 Data lineage**

Every finding must be traceable to the measurements that support it.

Example:

```
Finding: PM2.5 increased in Ward 01
    |
    +-- Measurement REC-001
    |      |
    |      +-- Dataset DS-001
    |              |
    |              +-- File: air_quality.xlsx
    |              +-- Sheet: November
    |              +-- Row: 12
    |
    +-- Measurement REC-002
           |
           +-- Dataset DS-002
                   |
                   +-- File: previous_report.csv
                   +-- Row: 24
```

This is a mandatory feature, not an optional enhancement.

## **5. API specification**

Use versioned REST APIs.

Base URL:

```
/api/v1
```

### **5.1 Analysis APIs**

| Method | Endpoint                | Purpose                   |
| ------ | ----------------------- | ------------------------- |
| POST   | `/analyses`             | Create analysis session   |
| GET    | `/analyses`             | List user analyses        |
| GET    | `/analyses/{id}`        | Get analysis details      |
| DELETE | `/analyses/{id}`        | Delete permitted analysis |
| POST   | `/analyses/{id}/cancel` | Cancel processing         |
| POST   | `/analyses/{id}/retry`  | Retry failed processing   |
| GET    | `/analyses/{id}/status` | Get pipeline status       |
| GET    | `/analyses/{id}/events` | Receive live progress     |

### **5.2 Data APIs**

| Method | Endpoint                  | Purpose                 |
| ------ | ------------------------- | ----------------------- |
| POST   | `/analyses/{id}/files`    | Upload files            |
| POST   | `/analyses/{id}/text`     | Submit pasted text      |
| GET    | `/analyses/{id}/files`    | List uploaded files     |
| GET    | `/analyses/{id}/datasets` | List datasets           |
| GET    | `/datasets/{id}/records`  | Fetch paginated records |
| GET    | `/datasets/{id}/quality`  | Get quality report      |
| PATCH  | `/datasets/{id}/mappings` | Update field mappings   |
| POST   | `/datasets/{id}/validate` | Revalidate dataset      |
| GET    | `/datasets/{id}/export`   | Export normalized data  |

### **5.3 Analytics APIs**

| Method | Endpoint                    | Purpose                 |
| ------ | --------------------------- | ----------------------- |
| GET    | `/analyses/{id}/findings`   | Get insights            |
| GET    | `/analyses/{id}/statistics` | Get statistics          |
| GET    | `/analyses/{id}/map`        | Get geographic data     |
| GET    | `/analyses/{id}/trends`     | Get time-series trends  |
| GET    | `/analyses/{id}/comparison` | Get previous comparison |

### **5.4 Recommendation APIs**

| Method | Endpoint                                  | Purpose                  |
| ------ | ----------------------------------------- | ------------------------ |
| POST   | `/analyses/{id}/recommendations/generate` | Generate recommendations |
| GET    | `/analyses/{id}/recommendations`          | List recommendations     |
| PATCH  | `/recommendations/{id}`                   | Edit recommendation      |
| POST   | `/recommendations/{id}/accept`            | Accept                   |
| POST   | `/recommendations/{id}/reject`            | Reject                   |
| POST   | `/recommendations/{id}/complete`          | Mark action completed    |

### **5.5 Report APIs**

| Method | Endpoint                          | Purpose             |
| ------ | --------------------------------- | ------------------- |
| POST   | `/analyses/{id}/reports/generate` | Generate report     |
| GET    | `/analyses/{id}/reports`          | List reports        |
| GET    | `/reports/{id}`                   | View report         |
| PATCH  | `/reports/{id}`                   | Edit draft          |
| POST   | `/reports/{id}/approve`           | Approve report      |
| POST   | `/reports/{id}/publish`           | Publish advisory    |
| GET    | `/reports/{id}/versions`          | Get version history |
| GET    | `/reports/{id}/export`            | Export PDF          |

All endpoints must enforce ownership, organization scope, role permissions and analysis-session access.

## **6. Processing pipeline — detailed execution**

This is the most important part of the implementation.

\#chatgpt-mermaid-\_r_qf\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_qf\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_qf\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_qf\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_qf\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_qf\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_qf\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_qf\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_qf\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_qf\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_qf\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_qf\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_qf\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_qf\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;}#chatgpt-mermaid-\_r_qf\_ p{margin:0;}#chatgpt-mermaid-\_r_qf\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_qf\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_qf\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_qf\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_qf\_ .label text,#chatgpt-mermaid-\_r_qf\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_qf\_ .node rect,#chatgpt-mermaid-\_r_qf\_ .node circle,#chatgpt-mermaid-\_r_qf\_ .node ellipse,#chatgpt-mermaid-\_r_qf\_ .node polygon,#chatgpt-mermaid-\_r_qf\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_qf\_ .rough-node .label text,#chatgpt-mermaid-\_r_qf\_ .node .label text,#chatgpt-mermaid-\_r_qf\_ .image-shape .label,#chatgpt-mermaid-\_r_qf\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_qf\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_qf\_ .rough-node .label,#chatgpt-mermaid-\_r_qf\_ .node .label,#chatgpt-mermaid-\_r_qf\_ .image-shape .label,#chatgpt-mermaid-\_r_qf\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_qf\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_qf\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_qf\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_qf\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_qf\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_qf\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_qf\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_qf\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_qf\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_qf\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_qf\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_qf\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_qf\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_qf\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_qf\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_qf\_ .icon-shape,#chatgpt-mermaid-\_r_qf\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_qf\_ .icon-shape p,#chatgpt-mermaid-\_r_qf\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_qf\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_qf\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_qf\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_qf\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_qf\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_qf\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_qf\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_qf\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_qf\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_qf\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_qf\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_qf\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_qf\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_qf\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_qf\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_qf\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_qf\_ .node rect,#chatgpt-mermaid-\_r_qf\_ .node circle,#chatgpt-mermaid-\_r_qf\_ .node ellipse,#chatgpt-mermaid-\_r_qf\_ .node polygon,#chatgpt-mermaid-\_r_qf\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_qf\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_qf\_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2px,2px;}#chatgpt-mermaid-\_r_qf\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_qf\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_qf\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;}User submits text/filesCreate Analysis SessionFile validation and storageExtract text and tablesAI interprets data structureMapping sufficiently clear?Request user confirmationNormalize dataValidate recordsGenerate quality reportUser reviews qualitySave approved mappings anddatasetStatistical analysisGeospatial analysisRetrieve previous comparableanalysisGenerate evidence-linkedfindingsGenerate role-basedrecommendationsGenerate internal briefingGenerate citizen advisoryUser reviews and savesVersioned database storageNoYes

### **Pipeline execution rules**

- Each stage must have independent status.
- Each stage must be retryable where safe.
- Store intermediate outputs.
- Prevent duplicate processing with idempotency keys.
- Maintain pipeline logs.
- Handle partial failures.
- Never lose the original uploaded data.
- Do not generate final findings from unvalidated measurements.
- Allow processing to resume after a user correction.
- Track the version of the transformation rules and AI prompts.

## **7. Suggested technology stack**

Given the Python-heavy data processing and AI requirements, I recommend the following stack.

## **Recommended implementation stack**

[jsx-sfc - Visual Studio Marketplace](https://images.openai.com/static-rsc-4/K2mbveQ9OdkHxQJF44k9PB7KOGfg7ioUIUaonpUx6KJ9AWA0KjQ9fLo22HX997mL5_6nOI4OMyXaTzstS8tXY4WeGaXmJ5xYOWJMRa0nHH_NeqhhFrm1CrHVWyR8hM1NQT3KzphC26SfC-otYIZmikFP4e6zVa7dmDXF4gj6ZOs?purpose=inline)

**Frontend — React + TypeScript**

Vite, Tailwind CSS, TanStack Query, React Router

[FastAPI Training online | Certification Course](https://images.openai.com/static-rsc-4/3oqMqrp7oPRSriMt9xXVBHZHsPei8fEWuA-8L4K7XuJ6mr_sRjvu-9xG8XhwQ6Cxii8kMDYBf2IPpic0w9lsd_WWzuUoqZsnVObn85H1cUBOsBkrUM-hiHgqvF7zNkL7ioxWOvl6qzqnTZgxAN23QuSS09nFm6DaRwaX6wcibpI?purpose=inline)

**Backend — FastAPI**

Pydantic, SQLAlchemy, REST APIs, SSE

[GitHub - thevkrant/Login-form-using-python-tkinter](https://images.openai.com/static-rsc-4/urfnHK6zfHhc4B3R1e0oqA7y8Vz4MVLbH4OkbEzp4ebiLf4GTPEzcrMq0g_u9dOKD9WtiCsX1xicbi1zCOCmsU7j0U2CpN8O76md71nd7cu1RcWbDdn6SDRiXMKinT5IfvrkoqB5kmNDq66qlVhyACf4H_8owV3q1znxDE3C7JE?purpose=inline)

**Data processing — Python**

Pandas / Polars, openpyxl, PyMuPDF, OCR

[Postgresql Logo PNG Transparent With Clear Background ID 473068 |  TOPpng](https://images.openai.com/static-rsc-4/x6sDZ8oKI9URixQ5E82vqCQV1aR38qK7E8n0HKggx6_cD8G7QtlPuHlyO99GalHPJOycjs41bPgfrRTqdHFqayPWJl57hxNttQynREzHXSUSsui_zVAB_ssyc1xdm_msJ5GiDzf23C9Z2RuuoyVCc6J0AbuAqX5Aul_x1J78q2I?purpose=inline)

**Database — PostgreSQL + PostGIS**

Relational data, history and geospatial queries

[Redis Logo PNG Vector (SVG) Free Download](https://images.openai.com/static-rsc-4/epIZvTJqrn11fZoyLAql3XQvzvr05WTs4k_hS-9tdnMQyi9Nak_EpGx1d16Qeud3z3mmGKrPzkfB8l4M10kTA8OEXwDm6CtTKKvBDOawlkZbKJwF8Jjm3IiHXcBUIohDPkufesDQyxMCNKXpFH79YSUkxtDVtdaR-HKvPqdpBXw?purpose=inline)

**Queue — Redis + Celery**

Background jobs and task processing

[Chatte mit den besten KI-Modellen der Welt.](https://images.openai.com/static-rsc-4/5WMgkKYZPRc8FKemY4U2q-9SgbBfKC6LnjgRJhp12FkyjqYQq4WTU8kliZxAQUobXMJLDXGnT0xo0D9bj1RUhAZeS-AFAyZmL4-OKw_eCN2bGTcubYYvlMYXbichcH6tDbjOAkp088W09tpvel4Hvv9kgFV3iKobqn5tdJksZZU?purpose=inline)

**AI — LLM provider abstraction**

Structured outputs, extraction fallback, insight and report generation

[Leaflet PNG Logo — Download Free Transparent Logo](https://images.openai.com/static-rsc-4/oc_CJobR8dzxJVyHlkVwYP3RB1YKndauo3zHS1UxeSlUKLEuV9-ZL9eTdX1fYGPpDg2Oy7Sh2QlJtyfN2OJET5nurUsRacVewflNYxRbNqPMY3SRvbU-Yh0ora9UMBwYs6ly9H7xVFjUg3zGERYhWdnz2YdjIkTQ_bli688qjDg?purpose=inline)

**Maps — Leaflet**

OpenStreetMap-compatible mapping and geographic visualization

[MinIO là gì? Hướng dẫn cài đặt minio trên Windows - STACKJAVA](https://images.openai.com/static-rsc-4/wgZZRIyhvWpzq_oPkmP7y5LrPdZIf4zZO5n2ON-CAzJUevUsKK7K5Db4M_wA07zCl9giDE2cKEVMh8Af4HPMizqjreG5RkJxDC_bLncOXrsRynnAH2KEzt5nxi2310s-i1cB_hXLrIc5H5PmB43N7YnXZKMxWTxIJYUuwMh2GdI?purpose=inline)

**File storage — S3 / MinIO**

Original documents and generated reports

### **Suggested project structure**

```
civic-intelligence/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── dashboard/
│   │   │   ├── analysis/
│   │   │   ├── data-quality/
│   │   │   ├── data-explorer/
│   │   │   ├── insights/
│   │   │   ├── recommendations/
│   │   │   └── reports/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── routes/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   │   ├── ingestion/
│   │   │   ├── extraction/
│   │   │   ├── interpretation/
│   │   │   ├── transformation/
│   │   │   ├── validation/
│   │   │   ├── geospatial/
│   │   │   ├── analytics/
│   │   │   ├── insights/
│   │   │   ├── recommendations/
│   │   │   ├── comparison/
│   │   │   └── reports/
│   │   ├── workers/
│   │   └── main.py
│   │
│   ├── tests/
│   ├── migrations/
│   └── pyproject.toml
│
├── infrastructure/
│   ├── docker/
│   └── deployment/
│
└── docs/
    ├── architecture.md
    ├── api.md
    └── data-schema.md
```

This structure keeps AI integration separate from business logic and numerical processing.

## **8. Security and permissions**

The platform may contain government and location-related information. Security must be considered from the beginning.

### **Authentication**

- Secure login.
- Role-based access control.
- Session management.
- Password hashing.
- Token expiration.
- Optional organization-level authentication.

### **Authorization**

| Permission                | Admin        | Ward officer    | Society | School |
| ------------------------- | ------------ | --------------- | ------- | ------ |
| Upload data               | Yes          | Yes             | Yes     | Yes    |
| View own analyses         | Yes          | Yes             | Yes     | Yes    |
| View organization data    | Yes          | Scoped          | Scoped  | Scoped |
| Generate recommendations  | Yes          | Yes             | Yes     | Yes    |
| Approve official briefing | Configurable | Configurable    | No      | No     |
| Publish citizen advisory  | Configurable | Authorized only | No      | No     |
| Manage users              | Yes          | No              | No      | No     |

Actual permissions must be configurable according to the organization and deployment model.

### **File security**

- Validate file types.
- Scan uploads for malware.
- Enforce size limits.
- Prevent path traversal.
- Store files outside public web directories.
- Use signed URLs for authorized file access.
- Apply retention and deletion policies.

### **AI security**

- Treat uploaded documents as untrusted input.
- Do not execute instructions found inside uploaded documents.
- Prevent prompt injection from overriding system instructions.
- Do not expose private data to unauthorized LLM providers.
- Validate generated outputs before saving or publishing.
- Keep an audit trail of generated content.

## **9. Non-functional requirements**

These define how the system should behave beyond its visible features.

| Area            | Requirement                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Performance     | Normal API responses should generally complete within 2 seconds, excluding long-running processing |
| Scalability     | Support background workers and horizontal scaling                                                  |
| Reliability     | Recover from processing failures                                                                   |
| Traceability    | Every finding must link to source evidence                                                         |
| Accessibility   | Support keyboard navigation and readable contrast                                                  |
| Localization    | Support multilingual interfaces and reports                                                        |
| Responsiveness  | Desktop, tablet and mobile support                                                                 |
| Security        | Enforce authentication and authorization                                                           |
| Maintainability | Modular services and documented APIs                                                               |
| Auditability    | Record user actions and report versions                                                            |
| Data integrity  | Preserve original uploaded information                                                             |
| Observability   | Logs, metrics, errors and processing traces                                                        |

### **Additional domain-specific requirements**

1. Do not compare incompatible measurement periods.
2. Clearly distinguish missing readings from zero.
3. Flag uncertain units.
4. Distinguish suspected hotspots from confirmed ones.
5. Never claim a specific pollution source without supporting evidence.
6. Do not invent health advice.
7. Clearly display when data is outdated or insufficient.
8. Do not present model confidence as measurement accuracy.

## **10. Acceptance criteria**

The system should not be considered complete just because the UI works.

These are the functional acceptance tests.

| ID    | Test                              | Expected result                       |
| ----- | --------------------------------- | ------------------------------------- |
| AC-01 | Upload valid CSV                  | Data extracted                        |
| AC-02 | Upload XLSX with multiple sheets  | Relevant tables extracted             |
| AC-03 | Upload scanned PDF                | OCR attempted                         |
| AC-04 | Paste an unformatted table        | AI identifies probable structure      |
| AC-05 | Upload data with mixed units      | Unit inconsistencies flagged          |
| AC-06 | Upload data with missing readings | Missing values identified             |
| AC-07 | Upload duplicate readings         | Duplicates detected                   |
| AC-08 | Review transformed data           | Original values traceable             |
| AC-09 | Upload geographic information     | Available locations mapped            |
| AC-10 | Generate pollution trends         | Calculations reproducible             |
| AC-11 | Change user role                  | Recommendations change appropriately  |
| AC-12 | Generate a new report             | Previous comparable report considered |
| AC-13 | Generate internal briefing        | Detailed evidence included            |
| AC-14 | Generate citizen advisory         | Simplified public language            |
| AC-15 | Change report language            | Translated report generated           |
| AC-16 | Save recommendation               | Recommendation persists               |
| AC-17 | Save briefing                     | Versioned report persists             |
| AC-18 | Reopen analysis                   | Previous results are available        |
| AC-19 | Process invalid input             | Clear errors and warnings shown       |
| AC-20 | Attempt unauthorized access       | Access denied                         |

### **Testing requirements**

- Unit tests for transformation and calculations.
- Integration tests for API and database operations.
- Test datasets containing messy tables.
- AI structured-output validation tests.
- Geospatial accuracy tests.
- Permission tests.
- Historical comparison tests.
- End-to-end tests for the complete user journey.

Use known expected results for numerical calculations. AI-generated prose should be tested for factual grounding and unsupported claims.

## **11. Development roadmap**

I strongly recommend developing this in phases rather than implementing everything simultaneously.

## **Phase 1 — Core MVP**

Build first

- Text and file input.
- Analysis session management.
- CSV, Excel and PDF extraction.
- AI-based column interpretation.
- Data normalization.
- Data quality assessment.
- Transformed table preview.
- Basic pollution statistics.
- Basic AI insights.

**Deliverable:** User can upload messy data and receive a validated, understandable analysis.

## **Phase 2 — Civic intelligence**

- Geographic mapping.
- Pollution hotspots.
- Role selection.
- Role-based recommendations.
- Evidence-linked findings.
- Accept/reject recommendations.

**Deliverable:** User can understand where the problem exists and what actions to take.

## **Phase 3 — Historical intelligence**

- Previous analysis retrieval.
- Report comparison.
- Pollution trend comparisons.
- Hotspot changes.
- Recommendation history.

**Deliverable:** User can understand whether the situation is improving or worsening.

## **Phase 4 — Reporting and publication**

- Internal briefing generation.
- Citizen advisory generation.
- Multilingual output.
- Reading-level adaptation.
- PDF export.
- Report versioning.
- Approval and publication workflow.

**Deliverable:** Complete civic intelligence reporting system.

## **Phase 5 — Advanced capabilities**

- Live air-quality data integrations.
- Automated periodic analysis.
- More advanced spatial analysis.
- Action implementation tracking.
- Notifications.
- Additional languages.
- Predictive analytics, if sufficient historical data is available.

**Deliverable:** Continuously operating civic intelligence platform.

## **12. Important design decisions**

There are five decisions I would make before starting development.

| Decision            | Recommendation                        |
| ------------------- | ------------------------------------- |
| Processing          | Asynchronous background pipeline      |
| AI architecture     | LLM + deterministic Python processing |
| Data model          | Common normalized measurement schema  |
| Historical analysis | Compare only compatible datasets      |
| Report storage      | Versioned, user-approved reports      |

### **Three things I would avoid**

1. **Don't make the entire application a chatbot.** The primary experience should be structured dashboards, tables, maps and reports.
2. **Don't let AI directly modify original data.** Keep original and transformed values separately.
3. **Don't generate recommendations without evidence.** Every recommendation must be traceable to a finding and its supporting measurements.

## **13. Definition of done**

The MVP is complete when a user can:

## **Complete user journey**

0 of 11 completed

0%

Paste or upload messy air-quality data

Watch extraction and processing progress

Review input quality and resolve important issues

Inspect normalized data in a table

View available locations on a map

Understand pollution trends and potential hotspots

Select a role and receive relevant recommendations

Inspect evidence behind each recommendation

Generate an internal briefing

Generate a citizen advisory

Save reports and reopen them later

## **14. My recommended implementation order**

Even though the frontend has six pages, I would not develop the frontend and backend independently.

Build one complete vertical feature at a time:

1. Analysis session creation + input page.
2. File extraction + processing page.
3. Normalization + quality assessment page.
4. Dataset API + transformed data explorer.
5. Analytics API + insights page.
6. Recommendation API + role selection.
7. Report generation + database persistence.
8. Historical comparison + report history.

This ensures that every frontend page has a working backend behind it.

**One final architectural recommendation:** Make the entire platform revolve around `Analysis Session`. Files, datasets, processing jobs, findings, recommendations and reports should all belong to an analysis session. This will make retries, historical comparisons, auditability and future expansion much easier.

The next useful development artifact would be a **detailed API contract and database schema (SQLAlchemy models + Pydantic schemas)** derived from this specification, so implementation can start without ambiguity.
