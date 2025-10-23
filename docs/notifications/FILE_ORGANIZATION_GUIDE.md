# Notifications Category - File Organization Guide

## Current Files (docs/notifications/)

### Purpose: **Active, user-facing documentation**
These are the docs developers should read FIRST when working with the notification system.

---

### 📄 NOTIFICATIONS.md
**Type:** Main documentation  
**Audience:** Developers implementing/maintaining notification features  
**Content:**
- System architecture overview
- API endpoints reference
- User preferences and settings
- Database schema (basic)
- Service worker integration
- Common workflows and examples

**When to read:** When you need to understand or modify the notification system

**Status:** ⚠️ Needs updates for Active Hours and Send Anytime features

---

### 📄 CRON_TIMING.md
**Type:** System overview  
**Audience:** Developers working with scheduled notifications  
**Content:**
- Current cron implementation (15-minute frequency)
- Timezone awareness system
- Framework-agnostic design principles
- Why 15 minutes (not 1 minute)
- User preference timing

**When to read:** When you need to understand notification timing/scheduling

**Status:** ✅ Current and accurate

---

### 📄 VALIDATION_REPORT.md
**Type:** Quality assurance document  
**Audience:** Maintainers, auditors, new developers  
**Content:**
- What was validated (APIs, schema, logic)
- Confirmation that code matches docs
- Gaps found (undocumented features)
- Minor discrepancies
- Action items for improvement

**When to read:** When verifying documentation accuracy or finding what's missing

**Status:** ✅ Complete with findings

---

### 📄 REDUNDANCY_ANALYSIS.md
**Type:** Consolidation decision record  
**Audience:** Documentation maintainers  
**Content:**
- Which files were redundant (and why)
- What was consolidated
- What was kept (and why)
- Archive file purposes
- Future maintenance notes

**When to read:** When understanding why certain docs are in archive vs current

**Status:** ✅ Complete reference

---

### 📄 CONSOLIDATION_SUMMARY.md
**Type:** Change log / executive summary  
**Audience:** Project managers, lead developers  
**Content:**
- What was done during consolidation
- Files deleted/created/merged
- Key discoveries (undocumented features)
- Metrics (40% reduction)
- Next steps

**When to read:** When you need a quick overview of the cleanup work

**Status:** ✅ Complete summary

---

## Archive Files (docs/notifications/archive/)

### Purpose: **Historical reference and deep implementation details**
These docs provide context, migration guides, and detailed testing scenarios that aren't needed for day-to-day work but are valuable for specific situations.

---

### 📄 CRON_IMPLEMENTATION.md
**Type:** Comprehensive implementation guide (CONSOLIDATED from 3 files)  
**Audience:** Developers migrating frameworks, setting up new environments  
**Content:**
- Detailed CronManager API reference
- Framework migration guides (Express, NestJS, Next.js)
- Step-by-step testing procedures
- Complete environment variable reference
- Troubleshooting common issues
- Performance metrics and optimization
- Historical context (how we got here)

**When to read:**
- Migrating to a different framework
- Setting up cron in a new environment
- Deep-diving into cron architecture
- Troubleshooting complex cron issues

**Why archived:** Too detailed for everyday use, but invaluable for specific scenarios

**Replaces:** CRON_SYSTEM_COMPLETE.md, CRON_SYSTEM_GUIDE.md, TIMING_SYSTEM_COMPLETE.md

---

### 📄 NOTIFICATION_THRESHOLD_GUIDE.md
**Type:** User experience guide  
**Audience:** UI/UX designers, product managers, frontend developers  
**Content:**
- Threshold categories (Instant Learner, Power User, etc.)
- User personas and use cases
- UI/UX explanations
- How the feature solves user problems
- Frontend implementation patterns

**When to read:**
- Designing notification preference UI
- Understanding user-facing threshold system
- Writing user documentation
- Explaining the feature to non-technical stakeholders

**Why archived:** Focuses on UX/product side rather than technical implementation

**Not redundant:** Unique user-facing content not in technical docs

---

### 📄 COMPREHENSIVE_TIMING_TEST_SCENARIOS.md
**Type:** Testing guide with detailed scenarios  
**Audience:** QA engineers, developers testing notification timing  
**Content:**
- 5 complete test scenarios with step-by-step instructions
- Debug panel JavaScript commands
- Browser console testing helpers
- Edge case testing (DST, timezone boundaries)
- Validation checklists
- Success criteria and metrics

**When to read:**
- Testing notification timing features
- QA validation before deployment
- Debugging timing issues
- Creating new test cases

**Why archived:** Specialized testing content not needed for normal development

**Not redundant:** Unique testing workflows and validation procedures

---

## Quick Reference Table

| File | Category | Update Frequency | Read When... |
|------|----------|------------------|--------------|
| **NOTIFICATIONS.md** | Current | Regular | Implementing features |
| **CRON_TIMING.md** | Current | Occasional | Understanding timing |
| **VALIDATION_REPORT.md** | Current | Per validation | Checking accuracy |
| **REDUNDANCY_ANALYSIS.md** | Current | Rare | Understanding cleanup |
| **CONSOLIDATION_SUMMARY.md** | Current | Once | Quick overview |
| **CRON_IMPLEMENTATION.md** | Archive | Rare | Migrating/deep-dive |
| **NOTIFICATION_THRESHOLD_GUIDE.md** | Archive | Rare | UX design work |
| **COMPREHENSIVE_TIMING_TEST_SCENARIOS.md** | Archive | Occasional | Testing/QA |

---

## Key Differences Summary

### Current Files:
✅ **What you read regularly**  
✅ **Active maintenance required**  
✅ **High-level overviews**  
✅ **Quick reference**  
✅ **Must stay accurate**

### Archive Files:
📚 **Reference when needed**  
📚 **Stable content**  
📚 **Deep implementation details**  
📚 **Specialized use cases**  
📚 **Historical context**

---

## Documentation TODO List (Tracked)

Based on VALIDATION_REPORT.md findings:

### High Priority (Missing Features)
- [ ] Add Active Hours section to NOTIFICATIONS.md
  - Feature explanation
  - API fields (`activeHoursEnabled`, `activeHoursStart`, `activeHoursEnd`)
  - UI component reference
  - Logic flow diagram update
  
- [ ] Add Send Anytime section to NOTIFICATIONS.md
  - Feature explanation (`sendAnytimeOutsideQuietHours`)
  - When it's enabled vs disabled
  - Interaction with Card Due Time
  - Precedence rules

- [ ] Add complete timing precedence rules to NOTIFICATIONS.md
  - Quiet Hours (always block)
  - Active Hours (optional window)
  - Send Anytime (ignore Card Due Time)
  - Card Due Time (±15min window)
  - Threshold (minimum cards)
  - Cooldown (6-hour minimum)

### Medium Priority (Clarifications)
- [ ] Document ScheduledNotification model in NOTIFICATIONS.md
  - Purpose (tracking notification history)
  - Schema fields
  - How it's used in cooldown logic

- [ ] Clarify IndexedDB usage in NOTIFICATIONS.md
  - SW uses it for form sync
  - Not directly for notification storage
  - Update data flow diagram

### Low Priority (Cross-references)
- [ ] Add reference from NOTIFICATIONS.md to NOTIFICATION_THRESHOLD_GUIDE.md
  - Link to UX guide for threshold feature details

- [ ] Add reference from DEVELOPMENT.md to COMPREHENSIVE_TIMING_TEST_SCENARIOS.md
  - Link to testing guide for QA workflows

- [ ] Update COMPREHENSIVE_TIMING_TEST_SCENARIOS.md
  - Change "Send Anytime" to "sendAnytimeOutsideQuietHours" (correct field name)
  - Verify all test commands work with current codebase

---

## When to Use Which Doc

### "I need to add a new notification feature"
→ Start with **NOTIFICATIONS.md**

### "I need to change the cron schedule"
→ Read **CRON_TIMING.md**

### "I'm migrating to Next.js"
→ Read **archive/CRON_IMPLEMENTATION.md**

### "I need to test timing edge cases"
→ Read **archive/COMPREHENSIVE_TIMING_TEST_SCENARIOS.md**

### "I'm redesigning the threshold UI"
→ Read **archive/NOTIFICATION_THRESHOLD_GUIDE.md**

### "Is the documentation accurate?"
→ Read **VALIDATION_REPORT.md**

### "Why are there fewer files now?"
→ Read **REDUNDANCY_ANALYSIS.md** or **CONSOLIDATION_SUMMARY.md**
