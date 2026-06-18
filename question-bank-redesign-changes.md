# Question Bank Redesign Changes

Updated: 2026-06-19

This file records the current round of product and code changes for the IELTS speaking question-bank redesign.

## Confirmed Product Structure

The app now treats the speaking bank as three main map sections:

- `Part 1`
- `Part 2&3`
- `Part 2串题`

The agreed direction is topic-first navigation instead of exposing too many individual question nodes on the climbing map.

## Question Bank Data

### Part 1

- Uses currently visible topics from the Papaen Part 1 archive.
- Current visible topic count: 60.
- Level map grouping: 7 topic nodes per screen.
- Total screens: 9.
- Last screen is sparse because 60 does not divide evenly by 7.

### Part 2&3

- Uses the current visible Papaen Part 2&3 bank.
- Current topic count: 77.
- Current question count: 450.
- Level map grouping: 7 topic nodes per screen.
- Each node represents one topic.
- Practice flow for a node starts with the Part 2 cue card, then continues through visible Part 3 questions.

### Part 2串题

- Source link used: `https://ielts.papaen.com/center/speaking?ielts-speaking=%2Fspeaking_materials%2Findex%3Fpart%25M24`
- The source bank was fetched from Papaen's encrypted material file and decrypted locally.
- Archive topic count: 306.
- Current visible combo topic count: 13.
- Current visible combo question count: 13.
- Current visible combo answer count: 13.
- Level map grouping: 4 combo nodes per screen.
- Screen distribution: 4 / 4 / 4 / 1.
- Generated resource files:
  - `Resource/PART2串题题库/papaen_part2_combo_archive.json`
  - `Resource/PART2串题题库/papaen_part2_combo_archive.csv`
  - `Resource/PART2串题题库/papaen_part2_combo_archive.md`
  - `Resource/PART2串题题库/papaen_part2_combo_current.json`
  - `Resource/PART2串题题库/papaen_part2_combo_current.csv`
  - `Resource/PART2串题题库/papaen_part2_combo_current.md`

## Level Map Logic

File: `lib/question-bank.ts`

- Added `Part 2串题` as the third main part.
- Added loading for `Resource/PART2串题题库/papaen_part2_combo_current.json`.
- `Part 1` and `Part 2&3` use 7 nodes per peak.
- `Part 2串题` uses 4 nodes per peak.
- `Part 2串题` questions are treated as Part 4 internally.
- Topic-style parts are:
  - `Part 1`
  - `Part 2&3`
  - `Part 2串题`
- Topic-style parts do not use the old 3-card-plus-boss layout.

## Climbing Map UI

Files:

- `app/map/ClimbingMap.tsx`
- `app/map.module.css`

Changes:

- Top navigation labels were shortened from `Part` to `P`.
- Navigation labels now display as `P1`, `P2&3`, and `P2串题`.
- The `P` prefix is visually larger than the number/text that follows.
- Target score and climbing height were restored to the original second-row metric structure.
- Screen/page navigation dots were moved to the left side and lowered to avoid top HUD overlap.
- `Part 2串题` uses a 4-node route that visually resembles the original Part 2&3 route more than the Part 1 seven-node route.
- Node label capsules now:
  - grow according to the displayed label length,
  - use consistent left and right padding,
  - truncate long labels before drawing,
  - clamp inside the SVG screen bounds so capsules do not overflow the phone screen.

## Practice Page Logic

Files:

- `app/practice/page.tsx`
- `app/practice/CardPractice.tsx`
- `app/practice/card.module.css`

Changes:

- Topic-flow practice supports `Part 1`, `Part 2&3`, and `Part 2串题`.
- `Part 1` and `Part 2&3` still require the first 3 cards/questions to pass before lighting the node.
- `Part 2串题` requires 1 passed card to light the node.
- `Part 2串题` practice cards show:
  - combo title as the main question title,
  - guidance content as the supporting text,
  - scraped model answer in the answer panel.
- The top question-list popup remains available for topic flows.
- Previous/next text buttons were hidden; card navigation relies on pass-to-next and swipe behavior.
- The three dots above the card were removed.
- The AI sample-answer toggle was reduced to the arrow-only control.
- The card was moved slightly down from the top for better spacing.

## Profile Page

File: `app/profile/page.tsx`

Changes:

- Progress overview now reflects the three main sections:
  - `Part 1`
  - `Part 2&3`
  - `Part 2串题`
- Totals are represented as:
  - Part 1: 60
  - Part 2&3: 77
  - Part 2串题: 13

## Visual Verification Artifacts

Screenshots generated during UI checks are in `preview/`, including:

- `preview/map-after-layout.png`
- `preview/map-combo-layout-final.png`
- `preview/map-p-compact.png`
- `preview/map-label-capsules.png`
- `preview/map-label-clamped.png`
- `preview/map-larger-nav.png`

## Verification

The following checks were run successfully after the latest changes:

- TypeScript check: `tsc --noEmit`
- Map page request: `http://localhost:3000/map` returned 200.
- First Part 2 combo practice page request returned 200 during the integration step.

Known note:

- `eslint` still has pre-existing issues in the project, including hook/set-state style warnings and `any` usage. The integration work was verified with TypeScript and runtime page requests.
