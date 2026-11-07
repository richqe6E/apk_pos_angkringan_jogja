## 2026-11-07T11:02:31Z
You are Explorer 3 (Data Layer, State Management & Integrations Explorer) for POS Angkringan Jogja.
Your state folder: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_explorer_survey_3\
Original request path: d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\ORIGINAL_REQUEST.md

CRITICAL INSTRUCTIONS:
1. First, read ORIGINAL_REQUEST.md in full.
2. Investigate the data layer, persistence models, storage mechanisms, and operational flows:
   - Data storage architecture: Is it localStorage, IndexedDB, in-memory, or backend API? Where are data models and store services located (e.g., `src/services`, `src/store`, `src/types`, etc.)?
   - Default menu items: Where and how are initial/default menu items populated? Why can't they be deleted or why do they reappear?
   - Table data storage: How are tables represented? Where are the hardcoded tables (e.g. Meja 1..Meja 10)? How can dynamic CRUD (add table, edit name, edit number) be stored and integrated with cashier order state?
   - Cashier identity: How are orders/transactions structured? Where are cashier names or employee IDs stored in transaction records, customer receipts, and internal cashier audit receipts?
   - Customer rewards & Supplier purchases: Where is customer reward tier data stored? Where are supplier purchase transactions recorded, and how do they integrate into cashflow/debts (keuangan / utang supplier)?
   - Attendance data: How is employee attendance recorded and stored? How does it map to calendar dates?
   - Payment settings: How are QRIS image and multi-bank account details stored in settings?
   - R3 Evaluation: Locate the temporary bill receipt ("struk tagihan sementara") code. Trace its complete flow, trigger, purpose, and differences with final receipt. Formulate an in-depth analysis of why it exists in real POS F&B operations (e.g., bill presentation before payment, checking orders before settlement) and evaluate its necessity.
   - R8 Bank Integration: Formulate a thorough analysis and multiple alternative approaches for bank integration (e.g. Open Banking / SNAP BI, Mutasi Scraper / Aggregator API like Moota/Oy!/Xendit, Dynamic QRIS webhook / payment gateway notification, manual upload / cashier reconciliation) with pros/cons and implementation requirements for the final report.
3. Write your comprehensive technical analysis to:
   d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_explorer_survey_3\analysis.md
   and write a summary handoff at:
   d:\apk pos angkringan jogja\apk_pos_angkringan_jogja\.agents\teamwork\teamwork_explorer_survey_3\handoff.md

Send a message when done with the file path.
