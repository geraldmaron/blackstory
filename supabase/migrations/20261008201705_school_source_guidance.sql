-- Extend the existing registry from the reviewed school evidence; do not create a second registry.
WITH guidance(host,body) AS (VALUES
  ('npgallery.nps.gov', '{
    "collection":"National Register and National Historic Landmark nomination files",
    "coverage":"Nominated properties in the United States; historical narratives, physical descriptions, boundaries and bibliographies",
    "suitableClaims":["historic property identity","documented building chronology","nomination boundaries","attributed significance assessments"],
    "searchMethods":["Search by NRIS identifier and state, then inspect the nomination PDF and its bibliography","Compare form dates, construction dates, school opening dates and institutional founding dates"],
    "limitations":["Nomination authors can repeat earlier accounts; a government host does not make every passage a government-authored primary record","A nomination and a later page citing it share an evidence lineage","Historical descriptions do not establish current access or use"],
    "provenance":["https://npgallery.nps.gov/GetAsset/9814b816-e5bd-4513-8b58-415d397c5297","https://npgallery.nps.gov/GetAsset/81caf24c-7dae-4316-8ada-a13a4d8647ce"],
    "preservationConditions":"Assess each document and its third-party contributions; collection membership confers no retention or image license."
  }'::jsonb),
  ('mostateparks.com', '{
    "collection":"Missouri historic-preservation nomination documents",
    "coverage":"Missouri properties with published nomination documents",
    "suitableClaims":["property identity","building and institutional chronology","bibliographic leads to district and archival records"],
    "searchMethods":["Search the named property and county, open the nomination PDF, and follow the cited records","Separate district establishment, secondary coursework, successive buildings and current school identity"],
    "limitations":["The Lincoln nomination and district retrospective disagree about the early founding chronology","An anniversary brochure cannot silently resolve a disputed date","An institution can occupy multiple buildings over time"],
    "provenance":["https://mostateparks.com/sites/g/files/zuston361/files/media/pdf/2025/02/lincoln-high-school-jackson-county.pdf"],
    "preservationConditions":"Assess rights and sensitivity for the exact PDF; inspect third-party photographs and quotations separately."
  }'::jsonb),
  ('archives.delaware.gov', '{
    "collection":"Delaware Public Archives historical accounts and marker records",
    "coverage":"Delaware institutions, places and state historical narratives",
    "suitableClaims":["attributed state historical accounts","discovery of archival records and legal-case context"],
    "searchMethods":["Search the school, city and legal case separately","Check original case records and nomination documents where dates or legal roles differ"],
    "limitations":["A marker date is an assertion to corroborate; it does not override a conflicting nomination","The school families sought to enter differs from the segregated school they had to attend","Current mailing addresses may refer to a later annex"],
    "provenance":["docs/research/historic-black-secondary-schools-2026-10-07.md"],
    "preservationConditions":"Assess the exact published item; no blanket permission for associated archival collections."
  }'::jsonb)
)
UPDATE evidence.evidence_sources source SET research_guidance=guidance.body,updated_at=now()
FROM guidance WHERE source.research_guidance='{}'::jsonb AND
  (source.display_name=guidance.host OR EXISTS (
    SELECT 1 FROM evidence.source_items item WHERE item.source_id=source.id
      AND lower(split_part(item.url,'/',3))=guidance.host
  ));
