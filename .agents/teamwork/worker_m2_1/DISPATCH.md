## 2026-11-07T04:28:44Z
You are Worker M2: Menu Management & Pure Android Focus Specialist.
Your working directory is: d:\Source_Code_Angkringan_Jogja\.agents\teamwork\worker_m2_1
Create and use your working directory for all metadata and reports.

You MUST read the authoritative request at:
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the project architecture and features at:
d:\Source_Code_Angkringan_Jogja\PROJECT.md
and the audit report and explorer findings at:
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\orchestrator\AUDIT_FINDINGS_AND_REPAIR_PLAN.md
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_2\analysis.md
d:\Source_Code_Angkringan_Jogja\.agents\teamwork\explorer_survey_2\handoff.md

WRITE OWNERSHIP:
You exclusively own:
- `components/menu-form-modal.tsx`
- `components/quick-edit-product-modal.tsx` (delete this file!)
- `components/category-form-modal.tsx` (create or inline for Android category add dialog)
- `app/(tabs)/explore.tsx`
- `app/transaksi.tsx` (long-press 200ms & wire unified MenuFormModal)
- `components/receipt-preview-modal.tsx` (remove iOS Courier font checks to 'monospace')
- `stores/menuStore.ts` (if needed for category or delete action)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK (Milestone 2 Implementation - R3):
1. Fix Menu Image Upload & Permanent Local Storage:
   - In `components/menu-form-modal.tsx:121`: remove the faulty `!photoUri.startsWith('file://')` guard.
   - When `photoUri` is provided and is a cache URI, call `await saveImageLocally(photoUri, 'menus')` and save the permanent URI to SQLite.
   - Ensure menu cards display the image (`Image` from 'react-native' or 'expo-image') with a clean placeholder icon when null.
2. Unify Menu Editor Modal:
   - Enhance `components/menu-form-modal.tsx` to include quick stock adjustments (steppers `-5`, `-1`, `+1`, `+5`) and a "Hapus Menu" button with confirmation alert.
   - Delete `components/quick-edit-product-modal.tsx` completely (eliminates 316 redundant lines).
   - In `app/(tabs)/explore.tsx`: remove the duplicate "Quick Edit" button so each menu item has a single clean "Edit" button that opens `MenuFormModal`.
   - In `app/transaksi.tsx`: change long-press to open `MenuFormModal` directly with `delayLongPress={200}` and `Haptics.impactAsync`.
3. Eliminate iOS-Specific Code & APIs:
   - In `app/(tabs)/explore.tsx`: eliminate `Alert.prompt` (which is iOS-only and broken on Android). Implement a clean Android-compatible modal dialog with `TextInput` to add new categories. Add a "+ Kategori" button on the category filter bar so cashiers can easily add categories.
   - In `components/receipt-preview-modal.tsx`: replace all 16-18 instances of `Platform.OS === 'ios' ? 'Courier' : 'monospace'` with `'monospace'`.
   - Remove any unused iOS platform branching.
4. Verification:
   - Verify TypeScript:
     `& "D:\AI PROJEK\node.exe" "d:\Source_Code_Angkringan_Jogja\node_modules\typescript\bin\tsc" --noEmit`
     Must exit with 0 errors.
   - Run test suite:
     `& "D:\AI PROJEK\node.exe" --test test/**/*.test.ts`
     Must pass 100%.
5. Maintain `progress.md` with timestamps and create a 5-component `handoff.md` in your working directory.
When complete, send a message to orchestrator (`eac7280e-c735-4bcc-b8ca-6f3a330669d5`).
