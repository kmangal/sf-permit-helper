# Data Sources

Data sources for the SF Permit Helper RAG system. Covers building/construction permits and street events. Verified 2026-09-12.

---

## DataSF Datasets (Socrata SODA API)

All datasets below are on SF's open data portal. No authentication required for basic access; register a free app token at [data.sf.gov](https://data.sf.gov) for 1,000 req/hr (pass via `X-App-Token` header). Base URL: `https://data.sf.gov/resource/{id}.json`. Max 50,000 rows per request; paginate with `$limit` + `$offset`.

### Building Permits — `i98e-djp9`

~1.3M permit applications filed with DBI, updated nightly. Primary dataset for finding prior similar work.

| Field | Description |
|-------|-------------|
| `permit_number` | Unique identifier |
| `permit_type` / `permit_type_definition` | Numeric code (1–8) and human-readable label |
| `description` | Free-text description of proposed work |
| `status` | Filed, issued, complete, etc. |
| `estimated_cost` | Dollar amount |
| `filed_date`, `issued_date`, `completed_date` | Dates |
| `existing_use`, `proposed_use` | Land use |
| `street_number`, `street_name`, `zipcode` | Address |
| `neighborhoods_analysis_boundaries` | Neighborhood |
| `location` | Lat/lng |

Permit type breakdown: OTC alterations (974K), additions/alterations/repairs (271K), sign erect (21K), new construction wood frame (13K), demolitions (7K), new construction (2.5K), grade/excavate (835).

```bash
curl 'https://data.sf.gov/resource/i98e-djp9.json?$limit=10&$where=lower(description)%20like%20%27%25deck%25%27&$order=filed_date%20DESC'
```

### DBI Complaints — `gm2e-bten`

~335K complaints across all DBI divisions. Use to surface likely complaints for a given project type.

| Field | Description |
|-------|-------------|
| `complaint_number` | Unique identifier |
| `complaint_description` | Free-text description |
| `status` | Open, closed, etc. |
| `receiving_division`, `assigned_division` | DBI divisions |
| `nov_type` | Notice of violation type |
| `street_number`, `street_name`, `zip_code` | Address |
| `analysis_neighborhood` | Neighborhood |
| `date_filed`, `date_abated`, `closed_date` | Dates |

```bash
curl 'https://data.sf.gov/resource/gm2e-bten.json?$limit=10&$where=lower(complaint_description)%20like%20%27%25deck%25%27'
```

### 311 Cases — `vw6y-z8j6`

~8.9M service requests since July 2008, updated nightly. Broader than DBI — includes building, housing, street, and neighborhood complaints.

| Field | Description |
|-------|-------------|
| `service_request_id` | Unique identifier |
| `service_name`, `service_subtype`, `service_details` | Complaint classification |
| `status_description`, `status_notes` | Resolution |
| `agency_responsible` | Routing |
| `address`, `analysis_neighborhood` | Location |
| `requested_datetime`, `closed_date` | Dates |

```bash
curl 'https://data.sf.gov/resource/vw6y-z8j6.json?$limit=10&$where=service_name%20like%20%27%25building%25%27'
```

### Street Closures (ISCOTT) — `8x25-yybr`

Temporary street closures. Use for "is this block already booked" and real approved case examples.

Fields: `case_num`, `case_name`, `type`, `status`, `start/end date+time`, `loc_desc`, `street`, `veh_imp`.

### Other useful datasets

| Dataset | ID | Use |
|---------|----|-----|
| Notices of Violation | `nbtm-fbw5` | DBI enforcement actions |
| Housing Code Violations | `fbaf-fhya` | Historical violations |
| Permit Types (lookup) | `6wa6-8527` | Reference table of permit type codes |
| PermitSF Permitting Data | `tyz3-vt28` | Newer permitting system data |

### SoQL query reference

| Param | Description | Example |
|-------|-------------|---------|
| `$select` | Columns to return | `permit_type,description` |
| `$where` | Filter | `status='issued'` |
| `$order` | Sort | `filed_date DESC` |
| `$limit` | Max rows (default 1,000, max 50,000) | `1000` |
| `$offset` | Pagination offset | `1000` |
| `$q` | Full-text search across all text fields | `deck construction` |

---

## SF.gov Content API

sf.gov is Next.js over Wagtail. The Wagtail REST API is public, no auth, at `https://api.sf.gov/api/v2/`.

| Endpoint | Returns |
|----------|---------|
| `pages/?search=<q>&limit=<n>` | Full-text search. Returns id, `meta.type`, slug, `first_published_at`. |
| `pages/<id>/` | Page body as structured blocks + `last_published_at`. Use for change detection. |
| `documents/?search=<q>` | Every PDF sf.gov hosts. Returns title, description, `published_date`, direct `file` URL. |

Store each page/doc with: url, wagtail id, type, last_published_at, sha256, fetched_at.

### Key pages (street events)

| Slug | Content |
|------|---------|
| `host-a-neighborhood-block-party` | Block party eligibility, fee tiers, posting rule |
| `close-a-streets-for-an-outdoor-event` | Special event closure, ISCOTT |
| `get-a-permit-to-close-a-street-for-a-special-event` | Application, form link |
| `get-entertainment-permit-your-outdoor-event` | Sound thresholds, 2wk/45d, $586, outreach |
| `apply-for-a-fire-permit-special-event` | Fire triggers, fees, lead times |
| `organize-food-vendors-for-a-special-event` | DPH sponsor duties, deadline |
| `sell-food-or-drinks-temporary-community-event` | DPH vendor permit types |
| `fees-for-outdoor-special-event-permitting` | All fees, all agencies, with fiscal years |
| `guidelines-for-outdoor-event-security` | 500+ rule, plan contents, 3-month lead |
| `insurance-requirements-for-special-event-permits` | Coverage by permit type |
| `rules-for-special-event-safety` | Lane widths, extinguishers, propane, tents |
| `check-to-see-which-permits-you-need-for-your-event` | City's own permit checker |
| `guide-hosting-street-and-sidewalk-event` | Overview, agency map |
| `guide-hosting-temporary-events-and-pop-ups` | DBI, Planning TUA, sidewalk registration |

Also search `documents/` for: "special event", "block party", "sponsor", "security plan", "site plan", "fee schedule".

---

## Regulations / Building Codes

No public API exists. Must be scraped/downloaded and chunked for vector embedding.

| Source | URL | Format | Notes |
|--------|-----|--------|-------|
| American Legal Publishing (recommended) | `codelibrary.amlegal.com/codes/san_francisco/latest/sf_building/` | HTML | Well-structured by chapter/section. Also has Planning Code at `.../sf_planning/`. |
| SF.gov amendments | `media.api.sf.gov/documents/2025_SFBC_Amendments_oLQVozH.pdf` | PDF | Needs PDF parsing |
| UpCodes | `up.codes/codes/san_francisco` | Web | Commercial, structured/searchable, may have paid API |

**Recommended approach:** Scrape amlegal HTML by chapter/section, chunk each section, embed into vector store.

---

## PDFs (direct download)

### Fire / Safety

| File | URL | Fillable |
|------|-----|----------|
| SFFD BFP Form 1010 permit app | https://sf-fire.org/media/3681 | Yes |
| SFFD 5.10 outdoor food bulletin | https://sf-fire.org/media/4069 | No |

### Transportation

| File | URL | Fillable |
|------|-----|----------|
| SFMTA special event permit conditions | https://www.sfmta.com/sites/default/files/reports-and-documents/2022/08/special_event_permit_conditions.pdf | No |
| SFMTA Fee and Fine Schedule 2026/27 | Linked from https://www.sfmta.com/reports/fee-and-fine-schedules | No |

### Other agencies

| File | URL | Fillable |
|------|-----|----------|
| Port special events guidelines | https://www.sfport.com/files/2024-01/Fillable%20PDF%20Guideline%20for%20Special%20Events%20(updated%2011-03-2023).pdf | Yes |
| ABC-221 daily liquor license | https://www.abc.ca.gov/wp-content/uploads/forms/ABC-221.pdf | Yes |
| DPH Event Sponsor Application | https://www.sf.gov/sites/default/files/2024-09/SponsorAppFillable.pdf | Yes |
| Security Plan template | https://media.api.sf.gov/documents/Security_Plan_-_07.19.pdf | No |
| Amplified Sound bulletin | https://media.api.sf.gov/documents/Outdoor_Entertainment_and_Amplified_Sound_-_07.19.pdf | No |

Extract text with pypdf/pdftotext. For fillable PDFs also dump form field names for intake mapping.

---

## Web Forms

No API for any of these. We produce paste-in values, not submissions.

| Form | URL | Notes |
|------|-----|-------|
| SFMTA block party application | https://sfmta.tfaforms.net/forms/view/62 | FormAssembly, scrapable |
| SFMTA special event closure | Linked from close-a-street page | FormAssembly |
| Entertainment Commission outdoor app | "Apply" link on entertainment page | JS app, needs browser |
| OpenGov event intake | https://sanfranciscoca.portal.opengov.com/categories/1083/record-types/6432 | JS, login required |
| Rec & Park special event app | sfrecpark.org | TBD |

---

## GIS Layers (DataSF)

Use to resolve location facts without asking the user: Muni routes (block party requires no transit), street classification (residential), police districts (security plan routing), Rec & Park property, Port jurisdiction. Find dataset IDs via `https://data.sf.gov/api/catalog/v1?q=<term>`.

---

## Operational Notes

- **Fee update cadence:** July 1 (SFMTA, Entertainment, DPH), Sept 1 (Fire), Jan 1 (Rec & Park, SFPD). Re-pull fee pages on those dates.
- **Rules are not data.** Pages and datasets are evidence. Rules get hand-written as JSON: conditions, lead days, fee, dependencies, and a source `{url, quote, fetched_at, last_published_at}`.
- **Permits still to add:** Public Works Temporary Occupancy, Public Works night noise permit, SFPD parade permit, DBI structural review for stages, Planning Temporary Use Authorization for private lots.
- **Out of scope for v1:** Cannabis, pyrotechnics, SFPUC hydrant.

## Ground Truth

Submit one real block party and one small street fair through OpenGov intake. Compare the city's returned checklist to ours. Patch gaps.
