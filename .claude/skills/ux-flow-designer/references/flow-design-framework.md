# User Flow Design Framework

A guide for mapping end-to-end user flows with consistent notation, annotation standards, and validation criteria.

---

## Core Methodology

A user flow answers three questions at every step:
1. **What does the user want to accomplish?** (goal annotation)
2. **What action do they take?** (user action)
3. **What does the system do?** (system response)

Flows that skip any of these three compress decision-making into engineering implementation, where user-centered rationale is lost.

---

## Flow Types

| Type | Purpose | When to Create |
|------|---------|---------------|
| **End-to-end user flow** | Maps the full journey from entry to task completion | Before wireframing; scope-setting |
| **Detailed interaction flow** | Specifies step-level triggers, responses, and feedback | Before prototyping or engineering handoff |
| **Error and recovery flow** | Maps every failure point and recovery path | Alongside happy path; required for handoff |
| **Entry point map** | Documents all paths into a feature | When feature has multiple entry contexts |

---

## Flow Diagram Elements

| Element | Symbol (text notation) | Meaning |
|---------|----------------------|---------|
| Screen | [Rectangle] | A view the user sees |
| Action | → | User action leading to next state |
| System event | --→ | System-initiated transition (no user action) |
| Decision | ◇ | Conditional branch point |
| Entry | (START) | Flow entry point |
| Exit / success | (END ✓) | Task successfully completed |
| Exit / error unrecovered | (END ✗) | User exits without completing task |
| Wait / async | ≈ | System processing without immediate feedback |

---

## Annotation Standards

Each step in the flow must include:

| Annotation Type | What to Note |
|----------------|-------------|
| User goal | What the user is trying to accomplish at this step |
| Screen name | Matches Figma page/frame name exactly |
| User action | Tap, swipe, input, submit, etc. |
| System response | State change, navigation, API trigger, validation |
| Analytics event | Event name to fire at this step (if known) |
| Open question | Any unresolved product or technical decision |

---

## Entry Point Documentation

For each flow, document all known entry points:

| Entry Point | Source | User Context | State on Arrival |
|-------------|--------|-------------|-----------------|
| Direct navigation | Bottom tab / sidebar | User is actively browsing | Default |
| Deep link | Email notification | User is responding to a notification | Pre-populated |
| Cross-sell surface | Feature banner | User is exploring | Onboarding variant |
| Re-engagement | Push notification | User is returning after inactivity | May see empty state |

---

## State Coverage Template

For each screen in the flow, verify all states are mapped:

```
Screen: [Name]

States to map:
  □ Default / loaded state
  □ Loading / skeleton state
  □ Empty state (no data)
  □ Partial data state
  □ Error state (and recovery path)
  □ Success / completion state
  □ Permission-gated state (if applicable)
  □ Disabled / read-only state (if applicable)
```

---

## System Behaviour Annotations

At each step where the system acts, annotate:

| Annotation | Example |
|-----------|---------|
| Data fetched | "Fetch /api/projects — show skeleton until resolved" |
| State persisted | "Save draft to local storage on every input change" |
| Event fired | "Track event: project_created with {id, template, timestamp}" |
| Notification triggered | "Send email: project_invitation to each invited member" |
| Permission checked | "If user.role !== admin, redirect to read-only view" |

---

## Flow Review Checklist

Before presenting the flow to stakeholders:

- [ ] Happy path is complete from entry to success
- [ ] All decision points have branches for each condition
- [ ] Error states are defined at every point where they can occur
- [ ] Recovery paths exist for every error state
- [ ] All screen names match Figma frame names
- [ ] System behaviour is annotated at async steps
- [ ] Entry points are documented (not just "User opens the app")
- [ ] Analytics events are noted for product and engineering
- [ ] Open questions are flagged — not silently assumed
- [ ] Flow has been validated against research insights or user mental model data
