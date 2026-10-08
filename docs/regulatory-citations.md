# Regulatory citations in the MEP-family reports

What the model may cite, and what it may not.

**Added 8 October 2026** for Dal's instruction: *"can add the full health and safety and
building regs to the electrical, hvac and mep reports so they can be referenced."*

## How this works, and why it is built this way

The report templates carry a **fixed list of instruments**. The AI prompt is given that list
and told, in terms:

> *regulatory_reference must be one of these ids exactly, or null. Never invent one.*

So a finding can cite a document by name, and the model **structurally cannot produce a clause,
section, table or paragraph number** - there is nothing false in front of it to reach for. It is
not being asked to be careful; the number is not available to it.

Three consequences worth knowing:

- **The list is the whole citation surface.** If an instrument is not on it, the model will not
  name it. Add rows to the definition, not to the prompt.
- **Nothing in a label is a clause number.** That is asserted by a test, not by convention.
- **Carrying a list is what switches the rule on.** A template with no list is actively told
  *"Do not return a regulatory_reference for this survey type"*, because a prompt pointing at a
  list that was never supplied is exactly the condition under which a model improvises.

## How each entry was checked

Every entry was **verified at source** by fetching the page and confirming the instrument number
appears on it - not by trusting a summary. **46 of 50 candidates verified; 27 shipped.**

Entries that could not be verified were **excluded rather than included with a caveat**. A wrong
regulation number in front of a client costs more than a missing one.

### Excluded, and why

- **CIBSE CP1 (heat networks)** - Could only be found on a manufacturer's page, not CIBSE's own.
- **BESA DW/144, DW/143, DW/172** - The BESA publications site rate-limited every attempt (HTTP 429). Never verified at source, so not shipped.
- **Water Fittings (NI) 2009 / (Scotland) Byelaws** - Devolved variants. Verified, but the jurisdiction is not England and Wales, so they are not in a set that prints one.
- **BS EN 1717** - Shown as withdrawn on the source the researcher checked.

## Electrical template (7 references)

| id | As it prints | Instrument | Jurisdiction | Verified against |
|---|---|---|---|---|
| `bs_7671` | BS 7671 - IET Wiring Regulations (18th Edition) | BS 7671:2018+A4:2026 | UK | https://electrical.theiet.org/bs-7671-18th-edition-wiring-regulations/model-forms/ |
| `eawr_1989` | Electricity at Work Regulations 1989 | SI 1989/635 | Great Britain | https://www.legislation.gov.uk/uksi/1989/635/contents |
| `esqcr_2002` | Electricity Safety, Quality and Continuity Regulations 2002 | SI 2002/2665 | Great Britain | https://www.legislation.gov.uk/uksi/2002/2665/contents |
| `bldg_regs_2010` | Building Regulations 2010 (SI 2010/2214) | SI 2010/2214, Schedule 1, Part P | England | https://www.legislation.gov.uk/uksi/2010/2214/data.xht?view=snippet&wrap=true |
| `ad_p` | Approved Document P - electrical safety | Approved Document P (2013 edition) | England | https://www.gov.uk/government/publications/electrical-safety-approved-document-p |
| `hsg85` | HSE HSG85 - electricity at work, safe working practices | HSG85 (3rd edition, 2013) | Great Britain | https://www.hse.gov.uk/pubns/books/hsg85.htm |
| `hsr25` | HSE HSR25 - electrical safety on construction sites | HSR25 (3rd edition, 2015) | Great Britain | https://www.hse.gov.uk/pubns/books/hsr25.htm |

## Mechanical template (20 references)

| id | As it prints | Instrument | Jurisdiction | Verified against |
|---|---|---|---|---|
| `bldg_regs_2010` | Building Regulations 2010 (SI 2010/2214) | The Building Regulations 2010, SI 2010/2214 | England and Wales | https://www.legislation.gov.uk/uksi/2010/2214/contents |
| `gsiur_1998` | Gas Safety (Installation and Use) Regulations 1998 | Gas Safety (Installation and Use) Regulations 1998, SI 1998/2451 | Great Britain | https://www.legislation.gov.uk/uksi/1998/2451/contents |
| `ad_f` | Approved Document F - ventilation | Approved Document F (Ventilation): Volume 1: Dwellings; Volume 2: Buildings other than dwellings - 2021 edition (in force 15 June 2022); Approved Document F (2026) for buildings subject to the 2026 standards | England | https://www.gov.uk/government/publications/ventilation-approved-document-f |
| `ad_l` | Approved Document L - conservation of fuel and power | Approved Document L (Conservation of fuel and power): Volume 1: Dwellings (2021 edition incorporating 2023 amendments); Volume 2: Buildings other than dwellings (2021 edition incorporating 2023 amendments); Approved Document L (2026) for buildings subject to the 2026 standards | England | https://www.gov.uk/government/publications/conservation-of-fuel-and-power-approved-document-l |
| `ad_j` | Approved Document J - combustion appliances and fuel storage | Approved Document J (Combustion appliances and fuel storage systems), 2010 edition incorporating 2010, 2013 and 2022 amendments (ISBN 978-1-915722-00-3) | England | https://www.gov.uk/government/publications/combustion-appliances-and-fuel-storage-systems-approved-document-j |
| `ad_g` | Approved Document G - sanitation, hot water and water efficiency | Approved Document G: Sanitation, hot water safety and water efficiency - 2015 edition incorporating 2016 and 2024 amendments (for use in England). ISBN 9781859466001 | England | https://www.gov.uk/government/publications/sanitation-hot-water-safety-and-water-efficiency-approved-document-g |
| `ad_h` | Approved Document H - drainage and waste disposal | Approved Document H: Drainage and waste disposal (2015 edition, for use in England) | England | https://www.gov.uk/government/publications/drainage-and-waste-disposal-approved-document-h |
| `pssr_2000` | Pressure Systems Safety Regulations 2000 | Pressure Systems Safety Regulations 2000 (SI 2000/128) | Great Britain | https://www.legislation.gov.uk/uksi/2000/128/contents |
| `f_gas_2015` | Fluorinated Greenhouse Gases Regulations 2015 | The Fluorinated Greenhouse Gases Regulations 2015, SI 2015/310 | Great Britain (Northern Ireland only for import/export and GB-NI trade controls) | https://www.legislation.gov.uk/uksi/2015/310/contents |
| `f_gas_eu` | Regulation (EU) 517/2014 - fluorinated greenhouse gases (retained) | Regulation (EU) No 517/2014 of the European Parliament and of the Council of 16 April 2014 on fluorinated greenhouse gases (as retained/assimilated in UK law) | Great Britain (retained/assimilated EU law) | https://www.legislation.gov.uk/eur/2014/517/contents |
| `epb_2012` | EPB Regulations 2012 - air-conditioning inspections | The Energy Performance of Buildings (England and Wales) Regulations 2012, SI 2012/3118 | England and Wales | https://www.legislation.gov.uk/uksi/2012/3118/contents |
| `hswa_1974` | Health and Safety at Work etc. Act 1974 | Health and Safety at Work etc. Act 1974, 1974 c. 37 | Great Britain | https://www.legislation.gov.uk/ukpga/1974/37/contents |
| `l8_acop` | HSE ACOP L8 - Legionnaires' disease control | HSE Approved Code of Practice L8: Legionnaires' disease - The control of legionella bacteria in water systems (4th edition, 2013). ISBN 9780717666157 | Great Britain | https://www.hse.gov.uk/pubns/books/l8.htm |
| `hsg274` | HSE HSG274 - legionella technical guidance | HSE HSG274: Legionnaires' disease - Technical guidance (2nd edition, March 2024) | United Kingdom | https://www.hse.gov.uk/pubns/books/hsg274.htm |
| `water_fittings_1999` | Water Supply (Water Fittings) Regulations 1999 | Water Supply (Water Fittings) Regulations 1999 (SI 1999/1148), as amended | England and Wales | https://www.legislation.gov.uk/uksi/1999/1148/contents |
| `bs_7593` | BS 7593 - water treatment in heating and cooling systems | BS 7593:2019 Code of practice for the preparation, commissioning and maintenance of domestic central heating and cooling water systems | UK | https://knowledge.bsigroup.com/products/code-of-practice-for-the-preparation-commissioning-and-maintenance-of-domestic-central-heating-and-cooling-water-systems |
| `bs_en_14336` | BS EN 14336 - heating systems installation and commissioning | BS EN 14336:2004 Heating systems in buildings - Installation and commissioning of water based heating systems | UK | https://knowledge.bsigroup.com/products/heating-systems-in-buildings-installation-and-commissioning-of-water-based-heating-systems |
| `bs_en_12599` | BS EN 12599 - ventilation acceptance procedures | BS EN 12599:2012 Ventilation for buildings - Test procedures and measurement methods to hand over air conditioning and ventilation systems | UK | https://knowledge.bsigroup.com/products/ventilation-for-buildings-test-procedures-and-measurement-methods-to-hand-over-air-conditioning-and-ventilation-systems |
| `bs_en_378_1` | BS EN 378-1 - refrigerating systems and heat pumps | BS EN 378-1:2016+A1:2020 Refrigerating systems and heat pumps - Safety and environmental requirements. Part 1: Basic requirements, definitions, classification and selection criteria | UK | https://knowledge.bsigroup.com/products/refrigerating-systems-and-heat-pumps-safety-and-environmental-requirements-basic-requirements-definitions-classification-and-selection-criteria-1 |
| `besa_tr19` | BESA TR19 - internal cleanliness of ventilation systems | BESA TR19 Air - Specification for internal cleanliness and hygiene management of ventilation systems (March 2026 edition) | UK | https://publications.thebesa.com/collections/publications |

## Limits, stated on the record

- This is a **working set, not the whole of the law.** It covers the instruments a visible-condition
  survey plausibly engages. Anything outside it gets named in words, without a number.
- **Editions and amendments move.** Entries were verified on **8 October 2026**. Where an edition
  matters - BS 7671 in particular - confirm the current amendment before relying on it.
- **Jurisdiction is England and Wales or Great Britain**, as noted per instrument. Devolved variants
  are deliberately absent.
- It makes a citation **safe to issue**. It does not make it **correct for every situation**, and it
  is not legal advice.

## Held back, ready for a plumbing and water template

The product has electrical and mechanical/HVAC templates but **no plumbing or water-services
template**. These instruments were researched and verified, and are ready to use the moment that
template exists: Water Supply (Water Fittings) Regulations 1999, HSE ACOP L8, HSE HSG274,
BS 8580-1, BS EN 806, BS 8558, BS EN 12056, WRAS Approval, Water Industry Act 1991, COSHH 2002,
HSE L122.
