# Event permit rule diagrams

Generated from `backend/app/engine/rules.yaml`. Do not edit by hand;
regenerate with `cd backend && python -m app.engine.diagrams`.

Diamonds are questions, hexagons are macros (each drawn further down), and
boxes are rules, colored by kind. Dashed `before` edges mean one approval
must come first (group requirements such as `property_permission` are not
drawn); `then` edges hang rules that depend on another rule applying. A
diamond with several `yes` edges means every branch is checked.

## 00 · Overview

[`00_overview.mmd`](00_overview.mmd)

```mermaid
flowchart TD
  start(["00 · Overview"])
  n1{"event_type in [parade, march_or_protest, film_production]?"}
  start --> n1
  n1 -->|yes| r_out_of_scope_event_type
  n2{"location in [federal_nps, federal_presidio_trust]?"}
  n1 -->|no| n2
  n2 -->|yes| s_07
  n2 -->|no| r_permitsf_intake
  n2 -->|no| r_noise_limits
  n2 -->|no| s_08c
  n2 -->|no| s_08d
  n1 -->|no| r_written_final_approval
  n3{"location?"}
  n1 -->|no| n3
  n3 -->|private_residence| s_01
  n3 -->|commercial_indoor, commercial_outdoor| s_02
  n3 -->|commercial_outdoor| s_03
  n3 -->|street_or_sidewalk| s_04
  n3 -->|city_park| s_05
  n3 -->|port, treasure_island| s_06
  n1 -->|no| s_08a
  n1 -->|no| s_08b
  r_out_of_scope_event_type[["Parades, marches/protests and film shoots use separate processes<br/><i>out_of_scope_event_type</i>"]]:::stop
  r_permitsf_intake["Submit the PermitSF pre-application intake form<br/><i>permitsf_intake</i>"]:::advisory
  r_written_final_approval["Have written final approval from every agency before the event<br/><i>written_final_approval</i>"]:::advisory
  r_noise_limits["Follow City noise limits (Police Code Art. 29, Regulation of Noise)<br/><i>noise_limits</i>"]:::requirement
  s_01(["01 · Private residence"]):::section
  s_02(["02 · Private commercial property"]):::section
  s_03(["03 · Private commercial outdoor space"]):::section
  s_04(["04 · Street or sidewalk"]):::section
  s_05(["05 · City park"]):::section
  s_06(["06 · Port and Treasure Island"]):::section
  s_07(["07 · Federal land"]):::section
  s_08a(["08a · Food and drink"]):::section
  s_08b(["08b · Alcohol"]):::section
  s_08c(["08c · Fire and structures"]):::section
  s_08d(["08d · Crowd size"]):::section
  classDef requirement fill:#fef3c7,stroke:#b45309,color:#111
  classDef advisory fill:#f1f5f9,stroke:#475569,color:#111
  classDef stop fill:#fee2e2,stroke:#b91c1c,color:#111
  classDef section fill:#e0f2fe,stroke:#0369a1,color:#111
```

## 01 · Private residence

[`01_private_residence.mmd`](01_private_residence.mmd)

```mermaid
flowchart TD
  start(["01 · Private residence"])
  n1{"open_to_public?"}
  start --> n1
  n1 -->|yes| r_residence_public_confirm_zoning
  n2{"sells_goods_or_services?"}
  n1 -->|no| n2
  n3{"closes_street?"}
  n2 -->|no| n3
  n3 -->|no| r_residence_private_no_city_permit
  n4{"sells_goods_or_services?"}
  start --> n4
  n4 -->|yes| r_residence_public_confirm_zoning
  r_residence_private_no_city_permit["Private party at a home generally needs no City event permit<br/><i>residence_private_no_city_permit</i>"]:::exemption
  r_residence_public_confirm_zoning["Confirm with Planning that a public or commercial event is allowed at the home<br/><i>residence_public_confirm_zoning</i>"]:::advisory
  classDef exemption fill:#dcfce7,stroke:#15803d,color:#111
  classDef advisory fill:#f1f5f9,stroke:#475569,color:#111
```

## 02 · Private commercial property

[`02_private_commercial_property.mmd`](02_private_commercial_property.mmd)

```mermaid
flowchart TD
  start(["02 · Private commercial property"])
  start --> r_owner_permission
  n1{"zoning_matches_event_use?"}
  start --> n1
  n1 -->|no| r_planning_temporary_use_authorization
  n2{"location = commercial_indoor?"}
  start --> n2
  n3{"peak_attendance ≥ 50?"}
  n2 -->|yes| n3
  n4{"venue_has_adequate_place_of_assembly?"}
  n3 -->|yes| n4
  n4 -->|no| r_sffd_place_of_assembly
  n5{"live_entertainment?"}
  n2 -->|yes| n5
  n6{"venue_has_poe_or_llp?"}
  n5 -->|yes| n6
  n6 -->|no| r_ec_one_time_indoor
  n7{"within_venue_permitted_hours?"}
  n5 -->|yes| n7
  n7 -->|no| r_ec_one_time_indoor
  r_owner_permission["Written permission from the property owner or manager<br/><i>owner_permission</i>"]:::plan
  r_planning_temporary_use_authorization["Temporary Use Authorization<br/><i>planning_temporary_use_authorization</i>"]:::permit
  r_sffd_place_of_assembly["Place of Assembly Permit (temporary or permanent)<br/><i>sffd_place_of_assembly</i>"]:::permit
  r_ec_one_time_indoor["One Time Indoor Entertainment Permit<br/><i>ec_one_time_indoor</i>"]:::permit
  r_owner_permission -.->|before| r_planning_temporary_use_authorization
  r_sffd_place_of_assembly -.->|before| r_ec_one_time_indoor
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef plan fill:#ede9fe,stroke:#6d28d9,color:#111
```

## 03 · Private commercial outdoor space

[`03_private_commercial_outdoor_space.mmd`](03_private_commercial_outdoor_space.mmd)

```mermaid
flowchart TD
  start(["03 · Private commercial outdoor space"])
  n1{"live_entertainment?"}
  start --> n1
  n2{"venue_approved_outdoor_entertainment?"}
  n1 -->|yes| n2
  n2 -->|no| r_ec_one_time_outdoor
  n3{"amplified_sound?"}
  start --> n3
  n4{"venue_approved_outdoor_entertainment?"}
  n3 -->|yes| n4
  n4 -->|no| r_ec_one_time_outdoor
  r_ec_one_time_outdoor["One Time Outdoor Event Permit<br/><i>ec_one_time_outdoor</i>"]:::permit
  o_ec_one_time_outdoor_1[/"if ec_outdoor_extended: lead time 45 days"/]:::note
  r_ec_one_time_outdoor -.- o_ec_one_time_outdoor_1
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef note fill:#fafafa,stroke:#a3a3a3,color:#111,stroke-dasharray:3 3
```

## 04 · Street or sidewalk

[`04_street_or_sidewalk.mmd`](04_street_or_sidewalk.mmd)

```mermaid
flowchart TD
  start(["04 · Street or sidewalk"])
  n1{"closes_street?"}
  start --> n1
  n2{"recurring_closure?"}
  n1 -->|yes| n2
  n2 -->|yes| r_shared_spaces_permit
  n3{{"block_party_eligible?"}}
  n2 -->|no| n3
  n3 -->|yes| r_sfmta_block_party_closure
  n3 -->|no| r_sfmta_special_event_closure
  n1 -->|no| r_dpw_sidewalk_occupancy
  n4{"in_entertainment_zone?"}
  start --> n4
  n5{"ez_to_go_alcohol?"}
  n4 -->|yes| n5
  n5 -->|yes| r_entertainment_zone_event
  n6{"live_entertainment?"}
  start --> n6
  n7{"venue_approved_outdoor_entertainment?"}
  n6 -->|yes| n7
  n7 -->|no| r_ec_one_time_outdoor
  n8{"amplified_sound?"}
  start --> n8
  n9{"venue_approved_outdoor_entertainment?"}
  n8 -->|yes| n9
  n9 -->|no| r_ec_one_time_outdoor
  n10{{"admin_review_eligible?"}}
  r_sfmta_special_event_closure -->|then| n10
  n10 -->|yes| r_iscott_administrative_review
  n11{"iscott_administrative_review applies?"}
  r_sfmta_special_event_closure -->|then| n11
  n11 -->|no| r_iscott_public_hearing
  n12{"sells_goods_or_services?"}
  r_sfmta_special_event_closure -->|then| n12
  n12 -->|yes| r_sfpd_street_fair_staffing
  r_dpw_sidewalk_occupancy["Temporary sidewalk occupancy permit (or existing Cafe Tables and Chairs / Shared Spaces parklet permit)<br/><i>dpw_sidewalk_occupancy</i>"]:::permit
  r_shared_spaces_permit["Shared Spaces Permit for a recurring street closure<br/><i>shared_spaces_permit</i>"]:::permit
  r_sfmta_block_party_closure["Neighborhood Block Party Street Closure<br/><i>sfmta_block_party_closure</i>"]:::permit
  r_sfmta_special_event_closure["Special Event Street Closure<br/><i>sfmta_special_event_closure</i>"]:::permit
  r_iscott_administrative_review["Administrative review, no public hearing<br/><i>iscott_administrative_review</i><br/>from 2026-05-21"]:::requirement
  r_iscott_public_hearing["ISCOTT public hearing<br/><i>iscott_public_hearing</i>"]:::requirement
  r_sfpd_street_fair_staffing["Police staffing may be required for street fairs (Transportation Code 6.6)<br/><i>sfpd_street_fair_staffing</i>"]:::requirement
  r_entertainment_zone_event["Entertainment Zone one-day event permit (for each day)<br/><i>entertainment_zone_event</i>"]:::permit
  r_ec_one_time_outdoor["One Time Outdoor Event Permit<br/><i>ec_one_time_outdoor</i>"]:::permit
  o_sfmta_special_event_closure_1[/"if sells_goods_or_services = yes: lead time 90 days"/]:::note
  r_sfmta_special_event_closure -.- o_sfmta_special_event_closure_1
  o_ec_one_time_outdoor_1[/"if ec_outdoor_extended: lead time 45 days"/]:::note
  r_ec_one_time_outdoor -.- o_ec_one_time_outdoor_1
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef requirement fill:#fef3c7,stroke:#b45309,color:#111
  classDef note fill:#fafafa,stroke:#a3a3a3,color:#111,stroke-dasharray:3 3
```

## 05 · City park

[`05_city_park.mmd`](05_city_park.mmd)

```mermaid
flowchart TD
  start(["05 · City park"])
  n1{{"park_code_7_03_trigger?"}}
  start --> n1
  n1 -->|yes| r_rpd_special_event_permit
  n1 -->|no| r_rpd_no_event_permit
  n2{"amplified_sound?"}
  start --> n2
  n2 -->|yes| r_rpd_amplified_sound_application
  n3{"alcohol_served?"}
  start --> n3
  n3 -->|yes| r_rpd_fenced_beer_garden
  n4{"peak_attendance ≥ 1000?"}
  start --> n4
  n4 -->|yes| r_rpd_ada_forms
  n5{"peak_attendance ≥ 5000?"}
  start --> n5
  n5 -->|yes| r_rpd_transportation_plan
  r_rpd_special_event_permit["Rec and Park Special Event Permit<br/><i>rpd_special_event_permit</i>"]:::permit
  r_rpd_amplified_sound_application["Amplified Sound Application<br/><i>rpd_amplified_sound_application</i>"]:::permit
  r_rpd_no_event_permit["No park special event permit; reserve the picnic area, field or facility if the site requires it<br/><i>rpd_no_event_permit</i>"]:::exemption
  r_rpd_fenced_beer_garden["Alcohol only inside a fenced beer garden; no glass or cans; precinct police review<br/><i>rpd_fenced_beer_garden</i>"]:::requirement
  r_rpd_ada_forms["ADA forms for events of 1,000+ participants<br/><i>rpd_ada_forms</i>"]:::requirement
  r_rpd_transportation_plan["Transportation plan for events drawing 5,000+<br/><i>rpd_transportation_plan</i>"]:::plan
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef plan fill:#ede9fe,stroke:#6d28d9,color:#111
  classDef requirement fill:#fef3c7,stroke:#b45309,color:#111
  classDef exemption fill:#dcfce7,stroke:#15803d,color:#111
```

## 06 · Port and Treasure Island

[`06_port_and_treasure_island.mmd`](06_port_and_treasure_island.mmd)

```mermaid
flowchart TD
  start(["06 · Port and Treasure Island"])
  n1{"indoors?"}
  start --> n1
  n2{"peak_attendance ≥ 50?"}
  n1 -->|yes| n2
  n3{"venue_has_adequate_place_of_assembly?"}
  n2 -->|yes| n3
  n3 -->|no| r_sffd_place_of_assembly
  n4{"live_entertainment?"}
  n1 -->|yes| n4
  n5{"venue_has_poe_or_llp?"}
  n4 -->|yes| n5
  n5 -->|no| r_ec_one_time_indoor
  n6{"within_venue_permitted_hours?"}
  n4 -->|yes| n6
  n6 -->|no| r_ec_one_time_indoor
  n7{"live_entertainment?"}
  n1 -->|no| n7
  n8{"venue_approved_outdoor_entertainment?"}
  n7 -->|yes| n8
  n8 -->|no| r_ec_one_time_outdoor
  n9{"amplified_sound?"}
  n1 -->|no| n9
  n10{"venue_approved_outdoor_entertainment?"}
  n9 -->|yes| n10
  n10 -->|no| r_ec_one_time_outdoor
  n11{"location?"}
  start --> n11
  n11 -->|port| r_port_special_event_license
  n11 -->|treasure_island| r_tida_use_permit
  r_sffd_place_of_assembly["Place of Assembly Permit (temporary or permanent)<br/><i>sffd_place_of_assembly</i>"]:::permit
  r_ec_one_time_indoor["One Time Indoor Entertainment Permit<br/><i>ec_one_time_indoor</i>"]:::permit
  r_ec_one_time_outdoor["One Time Outdoor Event Permit<br/><i>ec_one_time_outdoor</i>"]:::permit
  r_port_special_event_license["Port Special Event License<br/><i>port_special_event_license</i>"]:::permit
  r_tida_use_permit["TIDA Use Permit<br/><i>tida_use_permit</i>"]:::permit
  r_sffd_place_of_assembly -.->|before| r_ec_one_time_indoor
  o_ec_one_time_outdoor_1[/"if ec_outdoor_extended: lead time 45 days"/]:::note
  r_ec_one_time_outdoor -.- o_ec_one_time_outdoor_1
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef note fill:#fafafa,stroke:#a3a3a3,color:#111,stroke-dasharray:3 3
```

## 07 · Federal land

[`07_federal_land.mmd`](07_federal_land.mmd)

```mermaid
flowchart TD
  start(["07 · Federal land"])
  n1{"location?"}
  start --> n1
  n1 -->|federal_nps| r_nps_special_park_use_permit
  n1 -->|federal_presidio_trust| r_presidio_trust_special_use_permit
  start --> r_federal_confirm_other_requirements
  r_nps_special_park_use_permit["Special Park Use Permit<br/><i>nps_special_park_use_permit</i>"]:::permit
  r_presidio_trust_special_use_permit["Special Use Permit<br/><i>presidio_trust_special_use_permit</i>"]:::permit
  r_federal_confirm_other_requirements["Confirm food, alcohol, fire and medical requirements with the federal land manager<br/><i>federal_confirm_other_requirements</i>"]:::advisory
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef advisory fill:#f1f5f9,stroke:#475569,color:#111
```

## 08a · Food and drink

[`08a_food_and_drink.mmd`](08a_food_and_drink.mmd)

```mermaid
flowchart TD
  start(["08a · Food and drink"])
  n1{"location in [federal_nps, federal_presidio_trust]?"}
  start --> n1
  n2{"event_type = farmers_market?"}
  n1 -->|no| n2
  n2 -->|yes| r_sf_certified_farmers_market_permits
  n2 -->|yes| r_cdfa_certified_farmers_market_certificate
  n3{"food_to_public?"}
  n1 -->|no| n3
  n4{"event_type = farmers_market?"}
  n3 -->|yes| n4
  n4 -->|no| r_dph_temporary_food_facility
  n5{"food_trucks?"}
  n1 -->|no| n5
  n5 -->|yes| r_dph_mobile_food_concession
  n6{"event_type = farmers_market?"}
  start --> n6
  n7{"farmers_market_operator = other?"}
  n6 -->|yes| n7
  n7 -->|yes| r_farmers_market_operator_ineligible
  n8{"nonprofit_donated_food_only?"}
  r_dph_temporary_food_facility -->|then| n8
  n8 -->|yes| r_dph_nonprofit_donated_food_exemption
  r_sf_certified_farmers_market_permits["SF agricultural certificate and food safety permit for a Certified Farmers Market<br/><i>sf_certified_farmers_market_permits</i>"]:::permit
  r_cdfa_certified_farmers_market_certificate["State Certified Farmers' Market certificate<br/><i>cdfa_certified_farmers_market_certificate</i>"]:::permit
  r_farmers_market_operator_ineligible[["A certified farmers market may only be operated by certified producers, a nonprofit, or a government agency<br/><i>farmers_market_operator_ineligible</i>"]]:::stop
  r_dph_temporary_food_facility["Temporary Food Facility permits (organizer + every vendor)<br/><i>dph_temporary_food_facility</i>"]:::permit
  r_dph_nonprofit_donated_food_exemption["Nonprofit serving only donated food may qualify for an exemption form<br/><i>dph_nonprofit_donated_food_exemption</i>"]:::advisory
  r_dph_mobile_food_concession["Mobile Food Facility concessionaire application for each food truck<br/><i>dph_mobile_food_concession</i>"]:::permit
  r_cdfa_certified_farmers_market_certificate -.->|before| r_sf_certified_farmers_market_permits
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef advisory fill:#f1f5f9,stroke:#475569,color:#111
  classDef stop fill:#fee2e2,stroke:#b91c1c,color:#111
```

## 08b · Alcohol

[`08b_alcohol.mmd`](08b_alcohol.mmd)

```mermaid
flowchart TD
  start(["08b · Alcohol"])
  n1{"alcohol_served?"}
  start --> n1
  n2{"open_to_public?"}
  n1 -->|yes| n2
  n3{"free_admission?"}
  n2 -->|no| n3
  n4{"alcohol_free_of_charge?"}
  n3 -->|yes| n4
  n5{"licensed_premises?"}
  n4 -->|yes| n5
  n5 -->|no| r_abc_license_not_required
  n6{"location in [federal_nps, federal_presidio_trust]?"}
  start --> n6
  n7{"alcohol_served?"}
  n6 -->|no| n7
  n8{"venue_serves_under_own_license?"}
  n7 -->|yes| n8
  n9{"abc_license_not_required applies?"}
  n8 -->|no| n9
  n9 -->|no| r_abc_daily_license
  r_abc_daily_license -->|then| r_sfpd_alcohol_approval
  r_abc_license_not_required["No ABC license for a private, free event with free alcohol<br/><i>abc_license_not_required</i>"]:::exemption
  r_abc_daily_license["One-day ABC license (Form ABC-221 or authorization)<br/><i>abc_daily_license</i>"]:::permit
  r_sfpd_alcohol_approval["Police district station approval of the liquor license<br/><i>sfpd_alcohol_approval</i>"]:::permit
  r_sfpd_alcohol_approval -.->|before| r_abc_daily_license
  o_sfpd_alcohol_approval_1[/"if outdoor_setting: lead time 90 days"/]:::note
  r_sfpd_alcohol_approval -.- o_sfpd_alcohol_approval_1
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef exemption fill:#dcfce7,stroke:#15803d,color:#111
  classDef note fill:#fafafa,stroke:#a3a3a3,color:#111,stroke-dasharray:3 3
```

## 08c · Fire and structures

[`08c_fire_and_structures.mmd`](08c_fire_and_structures.mmd)

```mermaid
flowchart TD
  start(["08c · Fire and structures"])
  n1{"tent_max_sqft #gt; 400?"}
  start --> n1
  n1 -->|yes| r_sffd_tent_permit
  n2{"canopy_total_sqft #gt; 700?"}
  start --> n2
  n3{"canopy_firebreaks_12ft?"}
  n2 -->|yes| n3
  n3 -->|no| r_sffd_canopy_permit
  n4{"tent_occupant_load ≥ 50?"}
  start --> n4
  n4 -->|yes| r_sffd_tent_site_plan
  n5{"cooking_fuel_or_open_flame?"}
  start --> n5
  n5 -->|yes| r_sffd_cooking_permits
  n6{"generator_gasoline_gal #gt; 10?"}
  start --> n6
  n6 -->|yes| r_sffd_generator_permit
  n7{"generator_diesel_gal #gt; 60?"}
  start --> n7
  n7 -->|yes| r_sffd_generator_permit
  n8{"inflatables_flame_effects_or_flammable_liquids?"}
  start --> n8
  n8 -->|yes| r_sffd_other_operational_permits
  n9{"temporary_structures_or_construction?"}
  start --> n9
  n9 -->|yes| r_dbi_sffd_construction_review
  r_sffd_tent_permit["Tent construction + operational permit (tents over 400 sq ft)<br/><i>sffd_tent_permit</i>"]:::permit
  r_sffd_canopy_permit["Permit for open-sided canopies totaling over 700 sq ft without 12 ft fire breaks<br/><i>sffd_canopy_permit</i>"]:::permit
  r_sffd_tent_site_plan["Detailed site map and floor plan for any tent with occupant load of 50+<br/><i>sffd_tent_site_plan</i>"]:::requirement
  r_sffd_cooking_permits["Cooking and open-flame permits (event sponsor + each cooking vendor)<br/><i>sffd_cooking_permits</i>"]:::permit
  r_sffd_generator_permit["Separate generator permit<br/><i>sffd_generator_permit</i>"]:::permit
  r_sffd_other_operational_permits["Operational permit for each regulated activity (inflatables, flame effects, flammable liquids)<br/><i>sffd_other_operational_permits</i>"]:::permit
  r_dbi_sffd_construction_review["DBI and SFFD review of temporary structures or construction<br/><i>dbi_sffd_construction_review</i>"]:::permit
  classDef permit fill:#dbeafe,stroke:#1d4ed8,color:#111
  classDef requirement fill:#fef3c7,stroke:#b45309,color:#111
```

## 08d · Crowd size

[`08d_crowd_size.mmd`](08d_crowd_size.mmd)

```mermaid
flowchart TD
  start(["08d · Crowd size"])
  n1{"peak_attendance #gt; 500?"}
  start --> n1
  n1 -->|yes| r_security_plan
  n2{{"outdoor_setting?"}}
  start --> n2
  n3{"abc_daily_license applies?"}
  n2 -->|yes| n3
  n3 -->|yes| r_security_plan
  n4{"peak_attendance #gt; 1000?"}
  start --> n4
  n4 -->|yes| r_event_medical_plan
  n5{"swimmers #gt; 100?"}
  start --> n5
  n5 -->|yes| r_event_medical_plan
  n6{"location in [street_or_sidewalk, city_park, port, treasure_island]?"}
  start --> n6
  n7{"peak_attendance #gt; 100?"}
  n6 -->|yes| n7
  n7 -->|yes| r_bottled_water_restriction
  r_security_plan["Formal security plan<br/><i>security_plan</i>"]:::plan
  r_event_medical_plan["Event Medical Plan (EMS Agency Policy 7010)<br/><i>event_medical_plan</i>"]:::plan
  r_bottled_water_restriction["No single-serve bottled water under 1 liter at events over 100 attendees<br/><i>bottled_water_restriction</i>"]:::requirement
  classDef plan fill:#ede9fe,stroke:#6d28d9,color:#111
  classDef requirement fill:#fef3c7,stroke:#b45309,color:#111
```

## Macro · admin_review_eligible

[`macro_admin_review_eligible.mmd`](macro_admin_review_eligible.mmd)

```mermaid
flowchart TD
  start(["macro · admin_review_eligible"])
  n1{"blocks_closed ≤ 3?"}
  start --> n1
  n2{"closes_intersections?"}
  n1 -->|yes| n2
  n3{"affects_muni?"}
  n2 -->|no| n3
  n3 -->|no| m_admin_review_eligible
  m_admin_review_eligible(["✓ admin_review_eligible"]):::exemption
  classDef exemption fill:#dcfce7,stroke:#15803d,color:#111
```

## Macro · block_party_eligible

[`macro_block_party_eligible.mmd`](macro_block_party_eligible.mmd)

```mermaid
flowchart TD
  start(["macro · block_party_eligible"])
  n1{"event_type in [parade, march_or_protest, film_production]?"}
  start --> n1
  n2{"location = street_or_sidewalk?"}
  n1 -->|no| n2
  n3{"closes_street?"}
  n2 -->|yes| n3
  n4{"recurring_closure?"}
  n3 -->|yes| n4
  n5{"host_is_block_resident?"}
  n4 -->|no| n5
  n6{"blocks_closed = 1?"}
  n5 -->|yes| n6
  n7{"residential_street?"}
  n6 -->|yes| n7
  n8{"affects_muni?"}
  n7 -->|yes| n8
  n9{"sells_goods_or_services?"}
  n8 -->|no| n9
  n10{"promotes_business?"}
  n9 -->|no| n10
  n11{"duration_hours ≤ 8?"}
  n10 -->|no| n11
  n12{"within_7am_10pm?"}
  n11 -->|yes| n12
  n12 -->|yes| m_block_party_eligible
  m_block_party_eligible(["✓ block_party_eligible"]):::exemption
  classDef exemption fill:#dcfce7,stroke:#15803d,color:#111
```

## Macro · ec_outdoor_extended

[`macro_ec_outdoor_extended.mmd`](macro_ec_outdoor_extended.mmd)

```mermaid
flowchart TD
  start(["macro · ec_outdoor_extended"])
  n1{"amplified_hours_per_day #gt; 6?"}
  start --> n1
  n1 -->|yes| m_ec_outdoor_extended
  n2{"amplified_outside_9am_10pm?"}
  start --> n2
  n2 -->|yes| m_ec_outdoor_extended
  n3{"entertainment_days_per_year_at_location #gt; 12?"}
  start --> n3
  n3 -->|yes| m_ec_outdoor_extended
  m_ec_outdoor_extended(["✓ ec_outdoor_extended"]):::exemption
  classDef exemption fill:#dcfce7,stroke:#15803d,color:#111
```

## Macro · outdoor_setting

[`macro_outdoor_setting.mmd`](macro_outdoor_setting.mmd)

```mermaid
flowchart TD
  start(["macro · outdoor_setting"])
  n1{"event_type in [parade, march_or_protest, film_production]?"}
  start --> n1
  n2{"location?"}
  n1 -->|no| n2
  n2 -->|commercial_outdoor, street_or_sidewalk| m_outdoor_setting
  n3{"indoors?"}
  n2 -->|port, treasure_island| n3
  n3 -->|no| m_outdoor_setting
  m_outdoor_setting(["✓ outdoor_setting"]):::exemption
  classDef exemption fill:#dcfce7,stroke:#15803d,color:#111
```

## Macro · park_code_7_03_trigger

[`macro_park_code_7_03_trigger.mmd`](macro_park_code_7_03_trigger.mmd)

```mermaid
flowchart TD
  start(["macro · park_code_7_03_trigger"])
  n1{"peak_attendance ≥ 25?"}
  start --> n1
  n1 -->|yes| m_park_code_7_03_trigger
  n2{"amplified_sound?"}
  start --> n2
  n2 -->|yes| m_park_code_7_03_trigger
  n3{"food_to_public?"}
  start --> n3
  n3 -->|yes| m_park_code_7_03_trigger
  n4{"is_concert?"}
  start --> n4
  n5{"publicized_hours_ahead ≥ 4?"}
  n4 -->|yes| n5
  n5 -->|yes| m_park_code_7_03_trigger
  n6{"has_band?"}
  n4 -->|yes| n6
  n6 -->|yes| m_park_code_7_03_trigger
  n7{"is_race?"}
  start --> n7
  n8{"race_participants ≥ 25?"}
  n7 -->|yes| n8
  n8 -->|yes| m_park_code_7_03_trigger
  m_park_code_7_03_trigger(["✓ park_code_7_03_trigger"]):::exemption
  classDef exemption fill:#dcfce7,stroke:#15803d,color:#111
```
