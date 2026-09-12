# Data sources — street events vertical

What the rules engine and RAG layer need, where it lives, how to pull it. Scope: block parties, street fairs, sidewalk activations. Verified 2026-09-12.

## 1. sf.gov content API (primary source)

sf.gov is Next.js over Wagtail. Wagtail REST API is public, no auth, at `https://api.sf.gov/api/v2/`.

- `pages/?search=<q>&limit=<n>` — full-text search. Returns id, `meta.type`, slug, `first_published_at`. Filter by `type` (e.g. `sf.Transaction`, `sf.StepByStep`) once types are enumerated; `sf.Event` is calendar noise.
- `pages/<id>/` — page body as structured blocks (headings, paragraphs, links, attached docs) plus `last_published_at`. Use the date for change detection: re-pull, diff, flag rules whose source changed.
- `documents/?search=<q>` — every PDF sf.gov hosts. Returns title, description, `published_date`, direct `file` URL on `media.api.sf.gov`. The media host 403s on directory listing; individual files download fine.

Store each page/doc with: url, wagtail id, type, last_published_at, sha256, fetched_at.

### Pages to pull (slugs)

| Slug | Feeds |
|---|---|
| host-a-neighborhood-block-party | block party eligibility, fee tiers, posting rule |
| close-a-streets-for-an-outdoor-event | special event closure, ISCOTT |
| get-a-permit-to-close-a-street-for-a-special-event | application, form link |
| get-entertainment-permit-your-outdoor-event | sound thresholds, 2wk/45d, $586, outreach |
| apply-for-a-fire-permit-special-event | fire triggers, fees, lead times, form list |
| organize-food-vendors-for-a-special-event | DPH sponsor duties, deadline, mail address |
| sell-food-or-drinks-temporary-community-event | DPH vendor permit types |
| information--cases-where-your-permit-free-or-you-dont-need-one | DPH exemptions |
| fees-for-outdoor-special-event-permitting | all fees, all agencies, with fiscal years |
| guidelines-for-outdoor-event-security | 500+ rule, plan contents, 3-month lead |
| insurance-requirements-for-special-event-permits | coverage by permit type |
| rules-for-special-event-safety | lane widths, extinguishers, propane, tents |
| reduced-and-waived-fee-programs-for-special-events | eligibility, 90-day rule |
| check-to-see-which-permits-you-need-for-your-event | city's own checker |
| neighborhood-block-party-site-plan-examples | site plan template |
| zero-waste-resources-for-special-events | 1,000+ rule |
| guide-hosting-street-and-sidewalk-event | overview, agency map |
| guide-hosting-temporary-events-and-pop-ups | DBI, Planning TUA, sidewalk registration |
| information--permit-center-special-events-services | walk-in submissions |
| close-street-traffic-regularly-recurring-activation | Shared Spaces recurring track |
| news-mayor-lurie-signs-legislation-to-make-it-easier-to-throw-block-parties-and-neighborhood-events | recent rule changes — read before encoding block party rules |

Also search `documents/` for: "special event", "block party", "sponsor", "security plan", "site plan", "fee schedule".

## 2. PDFs outside sf.gov (direct download)

| File | URL | Fillable |
|---|---|---|
| SFFD BFP Form 1010 permit application | https://sf-fire.org/media/3681 | yes |
| SFFD 5.10 outdoor food/street fair bulletin | https://sf-fire.org/media/4069 | no |
| SFMTA special event permit conditions | https://www.sfmta.com/sites/default/files/reports-and-documents/2022/08/special_event_permit_conditions.pdf | no |
| SFMTA Fee and Fine Schedule 2026/27 (Table 902(b)) | linked from https://www.sfmta.com/reports/fee-and-fine-schedules | no |
| Port special events guidelines + application | https://www.sfport.com/files/2024-01/Fillable%20PDF%20Guideline%20for%20Special%20Events%20(updated%2011-03-2023).pdf | yes |
| ABC-221 daily license | https://www.abc.ca.gov/wp-content/uploads/forms/ABC-221.pdf | yes |
| Rec & Park special event application | via https://sfrecpark.org/541/Special-Event-Application-Information | tbd |

On sf.gov's doc store (pull via documents API, URLs already known):

- DPH Event Sponsor Application: `https://www.sf.gov/sites/default/files/2024-09/SponsorAppFillable.pdf` (fillable)
- DPH Concessionaire (vendor) application: linked from sell-food page (fillable)
- Security Plan template: `https://media.api.sf.gov/documents/Security_Plan_-_07.19.pdf`
- Outdoor Entertainment & Amplified Sound bulletin: `https://media.api.sf.gov/documents/Outdoor_Entertainment_and_Amplified_Sound_-_07.19.pdf`

Extract text with pypdf/pdftotext. For fillable PDFs also dump form field names — the fill step maps intake fields onto these.

## 3. Web forms (capture field maps once, by hand or headless browser)

No API for any of these. We produce paste-in values, not submissions.

| Form | URL | Notes |
|---|---|---|
| SFMTA block party application | https://sfmta.tfaforms.net/forms/view/62 | FormAssembly, server-rendered, scrapable |
| SFMTA special event closure application | linked from close-a-street page | FormAssembly |
| SFMTA posting declaration | same tfaforms | photos of 7-day posting |
| Entertainment Commission one-time outdoor application | "Apply" link on entertainment page | JS app, needs browser |
| OpenGov event intake | https://sanfranciscoca.portal.opengov.com/categories/1083/record-types/6432 | JS, login. City's mandatory front door; returns their checklist in 2 business days |
| Fee waiver application | Microsoft Form linked from fee waiver page | |
| Rec & Park special event application | sfrecpark.org | |

## 4. DataSF (Socrata SODA, no auth for reads)

- Temporary street closures, ISCOTT unit, daily: `https://data.sf.gov/resource/8x25-yybr.json` — fields: case_num, case_name, type, status, start/end date+time, loc_desc, street, veh_imp. Use for "is this block already booked" and for real approved case examples.
- GIS layers to resolve location facts without asking the user: Muni routes (block party requires no transit), street classification (residential), police districts (security plan goes to district station), Rec & Park property, Port jurisdiction. Find 4x4 ids via `https://data.sf.gov/api/catalog/v1?q=<term>` (catalog search returned 0 once; retry with `search_context` or browse UI).

## 5. Permits covered vs. still to add

Covered by the above: SFMTA block party closure, SFMTA special event closure, No Parking signs, Entertainment one-time outdoor, Fire temporary special event, DPH sponsor + vendor, ABC daily license, SFPD security plan, DEM medical plan, zero waste plan, insurance, fee waivers, Rec & Park, Port.

Add pages for: Public Works Temporary Occupancy (`sfpublicworks.org/services/permits/temporary-occupancy`, structures on sidewalk/roadway), Public Works night noise permit, SFPD parade permit (`sanfranciscopolice.org/get-service/permits`, district station, in person), DBI structural review for stages, Planning Temporary Use Authorization for private lots. Out of scope for v1: cannabis, pyrotechnics, SFPUC hydrant.

## 6. What the pull does not give

- Rules as logic. Pages are evidence. Rules get hand-written as JSON: conditions, lead days, fee, dependencies, and a source {url, quote, fetched_at, last_published_at}. ~30–40 rules for this vertical. LLM never decides applicability.
- Anything after submission. No status API anywhere. Gmail integration is the only route.
- Fees roll every July 1 (SFMTA, Entertainment, DPH), Sept 1 (Fire), Jan 1 (Rec & Park, SFPD). Re-pull the fees page on those dates.

## 7. Ground truth check

Submit one real block party and one small street fair through OpenGov intake. Compare the city's returned checklist to ours. Patch gaps. Only way to verify completeness.
