# CleverAI Documentation

This directory contains all project documentation organized by category.

## Structure

### 📂 [notifications/](./notifications/)
Notification system, push notifications, cron jobs, and timing logic.
- `NOTIFICATIONS.md` - Main notification system documentation
- `CRON_TIMING.md` - Cron job timing and scheduling
- `VALIDATION_REPORT.md` - Validation findings and undocumented features
- `REDUNDANCY_ANALYSIS.md` - Archive consolidation analysis
- `archive/` - Historical notification documentation
  - `CRON_IMPLEMENTATION.md` - Complete cron implementation guide (consolidated)
  - `NOTIFICATION_THRESHOLD_GUIDE.md` - User-facing threshold UX guide
  - `COMPREHENSIVE_TIMING_TEST_SCENARIOS.md` - Detailed testing workflows

### 📂 [pwa/](./pwa/)
Progressive Web App (PWA) implementation, service workers, and offline functionality.
- `PWA.md` - Main PWA documentation (paths corrected)
- `VALIDATION_REPORT.md` - Validation findings and path discrepancies
- `REDUNDANCY_ANALYSIS.md` - Archive consolidation analysis
- `CONSOLIDATION_SUMMARY.md` - Cleanup summary and metrics
- `archive/` - Historical PWA documentation
  - `PWA_COMPLETE_GUIDE.md` - Historical comprehensive guide (superseded by PWA.md)
  - `PWA_REFACTORING_HISTORY.md` - Constants refactoring history (consolidated)
  - `CI-SW-VALIDATION.md` - CI validation procedures
  - `test-offline-functionality.md` - Offline testing guide
  - `test-sw-updates.md` - Update system testing guide

### 📂 [spaced-repetition/](./spaced-repetition/)
Spaced repetition algorithm (SM-2), card review system, and scheduling.
- `SPACED_REPETITION.md` - Main comprehensive documentation (grade scale 0-5, domain architecture, complete API reference)
- `VALIDATION_REPORT.md` - Codebase validation results (92% accuracy)
- `REDUNDANCY_ANALYSIS.md` - Archive content analysis and consolidation strategy
- `archive/` - Historical spaced-repetition documentation
  - `SPACED_REPETITION_README.md` - Original comprehensive guide (superseded)
  - `SM2_ALGORITHM_EXAMPLES.md` - Detailed algorithm examples (educational reference - kept)
  - `SPACED_REPETITION_DEBUG_CONTROLS.md` - Debug implementation details (partially superseded)
  - `test-review-workflow.md` - E2E test workflow (fully superseded)

### 📂 [error-handling/](./error-handling/)
Centralized error handling, migration guides, and error management patterns.
- `CENTRALIZED_ERROR_HANDLING.md` - Main error handling documentation
- `CENTRALIZED_ERROR_HANDLING_MIGRATION.md` - Migration guide
- `ERROR_HANDLING_MIGRATION.md` - Additional migration notes
- `archive/` - Historical error handling documentation

### 📂 [architecture/](./architecture/)
System architecture, API design, and high-level technical decisions.
- `ARCHITECTURE-API-REFactor.md` - API refactoring documentation
- `archive/` - Historical architecture documentation

### 📂 [development/](./development/)
Development guides, setup instructions, and developer workflows.
- `DEVELOPMENT.md` - Main development guide
- `database-error-examples.ts` - Database error handling examples
- `archive/` - Historical development documentation

## Documentation Status

Each category contains:
- **Current docs** - Active, maintained documentation
- **archive/** - Historical documentation kept for reference

## Contributing

When updating documentation:
1. Update the relevant file in its category folder
2. If superseding old documentation, move the old version to `archive/`
3. Keep file paths and code examples accurate with the current codebase
4. Cross-reference related documentation when applicable
