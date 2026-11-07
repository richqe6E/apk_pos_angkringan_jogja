## 2026-11-07T03:48:17Z
You are Explorer 2: Menu Management, Photo Upload & Pure Android UX Specialist.
Your working directory is: d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_2
Create and use your working directory for all metadata and reports.

You MUST read the authoritative request at:
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\ORIGINAL_REQUEST.md

Also read the ponytail skills:
- d:\Source_Code_Angkringan_Jogja\.agents\skills\ponytail\SKILL.md
- d:\Source_Code_Angkringan_Jogja\.agents\skills\ponytail-audit\SKILL.md
- d:\Source_Code_Angkringan_Jogja\.agents\skills\ponytail-debt\SKILL.md
- d:\Source_Code_Angkringan_Jogja\.agents\skills\ponytail-review\SKILL.md
- d:\Source_Code_Angkringan_Jogja\.agents\skills\ponytail-help\SKILL.md

YOUR MISSION (READ-ONLY INVESTIGATION - DO NOT MODIFY CODE):
Investigate Requirement R3 in detail:
1. Menu image upload:
   - Check how menu photos are handled currently in the database schema (`items` or `menu_items`), stores, and UI.
   - Investigate image picker integration (`expo-image-picker`), saving permanently to local app storage (`expo-file-system` documentDirectory), generating unique filenames, storing local URI in database, and displaying the photo on menu cards (with placeholder fallback when photo is null).
2. Unification of Menu Editor:
   - Audit the existing 'Quick Edit' and 'Edit' modals in the Menu screen and Transaction screen.
   - Trace all props, state, and actions used by both modals.
   - Design a single comprehensive menu edit modal that allows updating ALL attributes (photo, name, price, category, stock, barcode).
   - Ensure this single modal can be invoked seamlessly both from the Menu management screen and from the Transaction screen.
3. Full add-menu form:
   - Check existing add-menu functionality and ensure it covers all required fields cleanly.
4. Android-pure focus & elimination of iOS-specific code:
   - Search the entire repository for iOS-specific APIs, especially `Alert.prompt`, `Platform.OS === 'ios'`, iOS conditional styles, or iOS platform checks.
   - Detail where `Alert.prompt` is used (e.g. adding categories) and prescribe Android-compatible modal/dialog replacements with TextInput that work smoothly on Android phones and tablets.
5. Long-press responsiveness on transaction screen:
   - Inspect product cards on the transaction screen.
   - Check `delayLongPress` setting (needs to be responsive, ~200ms) and ensure long-press opens the unified menu editor modal.
6. Ponytail debt & audit:
   - Identify shortcut comments, dead code, bloat, and risks in the menu and product card codebase.

OUTPUT REQUIREMENTS:
- Keep a `progress.md` in your directory with timestamp heartbeat.
- Write a comprehensive `analysis.md` and `handoff.md` in `d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_2\`.
- Include file paths, line numbers, verified root causes, and exact proposed minimal changes following Ponytail principles.
- When complete, send a message to the orchestrator (conversation ID: eac7280e-c735-4bcc-b8ca-6f3a330669d5) with a summary and reference to your handoff.md.
