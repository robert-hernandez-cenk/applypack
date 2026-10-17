# User Flow Diagram — Documentation Template

## Metadata

| Field | Value |
|-------|-------|
| Date | [YYYY-MM-DD] |
| Author | [UX/UI Designer] |
| Feature | [Feature name] |
| User Type | [e.g. New user / Returning user / Admin] |
| Figma Flow | [Link to diagram] |
| Version | [1.0] |
| Status | [Draft / Review / Approved] |

## Flow Summary

[Describe the user flow in 2-3 sentences. State the user goal, where the flow starts, where it ends, and the key decision points along the path.]

- **User goal**: [e.g. Set up recurring payment for a subscription]
- **Entry point**: [e.g. Billing settings screen]
- **End point**: [e.g. Confirmation screen — recurring payment active]
- **Happy path length**: [X steps]
- **Key branches**: [e.g. Payment method exists vs. new method; annual vs. monthly billing]

## Flow Nodes Legend

| Symbol | Meaning |
|--------|---------|
| Rounded rectangle | Screen or page |
| Diamond | Decision point |
| Rectangle with wavy bottom | Document / output produced |
| Circle | Start / End point |
| Arrow | User action → system transition |

## Flow: Happy Path

[Document the happy path as a linear table. The Figma diagram is the primary artefact — this table is the written spec companion.]

| Step | Node Type | Screen / Decision | User Action | System Response | Notes |
|------|-----------|------------------|-------------|-----------------|-------|
| 1 | Start | [Entry point: Billing settings] | – | Screen loaded | First screen user sees |
| 2 | Screen | [Billing — overview] | Taps "Set up recurring payment" | Navigates to payment setup | |
| 3 | Decision | [Is payment method saved?] | – | – | Branch: Yes → Step 4a; No → Step 4b |
| 4a | Screen | [Confirm saved method — use existing] | Selects saved card; taps "Continue" | Advances to billing interval selection | Saved method path |
| 4b | Screen | [Add payment method] | Enters card details; taps "Save and continue" | Validates and saves card; advances | New method path |
| 5 | Screen | [Billing interval selection] | Selects monthly or annual; taps "Continue" | Records selection | |
| 6 | Screen | [Review and confirm] | Reviews summary; taps "Confirm" | Calls payment API; shows loading | |
| 7 | Screen | [Confirmation] | Views confirmation | Sends confirmation email; activates recurring billing | End of happy path |

## Alternative Paths

### Path A: [e.g. User has no saved payment method]

[Steps 4b replaces 4a. All other steps identical to happy path.]

### Path B: [e.g. User selects annual billing]

[Step 5 — user selects "Annual" option. Annual price shown in Step 6 review screen. No other changes to flow.]

### Path C: [e.g. Payment fails at confirmation]

| Step | Screen | User Action | System Response |
|------|--------|-------------|-----------------|
| 6a | Review — payment error | Reads error message | Show decline reason and retry option |
| 6b | Review — retry | Taps "Try again" | Re-calls payment API |
| 6c | [If second failure] | Reads second error | Offer "Change payment method" option |

## Exit Points

[Document every point where a user can exit the flow and what happens.]

| Exit Point | Screen | Exit Action | Destination | Data Preserved? |
|-----------|--------|------------|------------|-----------------|
| 1 | [Any screen] | Taps back arrow | Previous screen | [Yes — form data preserved] |
| 2 | [Any screen] | Taps "Cancel" | Billing settings overview | [Yes — no changes saved] |
| 3 | [Confirmation] | Taps "Done" | Billing settings — updated | [Yes — recurring billing now active] |

## Touchpoints with Other Flows

[Document how this flow connects to other user flows.]

| Related Flow | Connection Point | Direction |
|-------------|-----------------|-----------|
| [Auth / Sign in flow] | [If user is signed out when accessing billing] | [Prerequisite — must complete before this flow] |
| [Add payment method flow] | [Path B when no saved method exists] | [Sub-flow — returns to Step 5 on completion] |
| [Cancellation flow] | [User can cancel recurring billing from Billing settings] | [Downstream — follows this flow] |

## Open Questions

| # | Question | Owner | Due |
|---|----------|-------|-----|
| Q1 | [e.g. Should the annual vs monthly toggle default to the user's current plan?] | [PM] | [Date] |
| Q2 | [e.g. What is the behaviour if a user exits mid-flow and returns the next day?] | [PM + Engineering] | [Date] |
