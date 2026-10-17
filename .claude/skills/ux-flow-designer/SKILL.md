---
name: ux-flow-designer
description: >
  This skill designs end-to-end user flows that map the steps a user takes to complete a
  task. Use when asked to create a user flow diagram, map a journey from entry to completion,
  or document the navigation structure of a feature. Also consider when a product spec
  describes functionality without specifying the user's path through it. Suggest when
  wireframes are being created without an agreed-upon user flow.
department: design
agent: ux-ui-designer
version: 1.0.0
complexity: medium
related-skills:
  - flow-designer
  - wireframe-builder
  - spec-translator-design
triggers:
  - "UX flow"
  - "usability review"
  - "usability-heuristic-reviewer"
  - "user flow design"
---

# ux-flow-designer

## Agent: UX/UI Designer

L2 UX/UI designer (Nx) responsible for user flow design, wireframing, prototyping, and component mapping.

Department ethos: [ideal-design.md](../../../../departments/design/ideal-design.md)

## Skill Description

Designs end-to-end user flows that map every step, decision point, and system response a user encounters while completing a task within the product.

## When to Use

- When a new feature or product area needs a user flow before wireframing begins.
- When a product spec defines functionality but does not specify the user's navigation path through it.
- When an existing flow needs to be documented, evaluated, or redesigned based on usability data.
- When multiple teams (design, engineering, product) need a shared reference for how a user moves through a feature.

## Workflow

1. **Identify the user goal**: Define the task the user is trying to accomplish, the entry points (how they arrive), and the success condition (what "done" looks like). Deliverable: user goal statement with entry/exit criteria.
2. **Map the primary flow**: Chart the step-by-step path from entry to task completion. Include screens, user actions, and system responses at each step. Keep the primary flow linear and minimal. Deliverable: primary flow diagram.
3. **Add secondary and error paths**: Branch from the primary flow to cover alternative paths (different user choices, permissions, account states) and error paths (validation failures, connectivity issues, permission denials). Deliverable: complete flow diagram with all paths.
4. **Annotate system behavior**: Document what the system does at each step -- data fetching, state persistence, notification triggers, analytics events. These annotations bridge design and engineering. Deliverable: annotated flow with system behavior notes.
5. **Validate with stakeholders**: Review the flow with product (for requirement coverage), engineering (for technical feasibility), and research (for user mental model alignment). Deliverable: validated flow with stakeholder sign-off.

## Anti-Patterns

- **Designing screens before flows**: Jumping to wireframes or visual design without agreeing on the user's path through the experience. *Why*: screens designed without flow context frequently miss steps, create dead ends, or fail to handle branching -- all of which are expensive to fix after visual design is complete.
- **Abstracting away complexity**: Collapsing multi-step sequences into single nodes (e.g., "user authenticates") that hide interaction decisions. *Why*: compressed nodes defer design decisions to engineering, who will implement them without user-centered rationale.
- **Ignoring entry context**: Designing the flow assuming a single entry point when users may arrive from notifications, deep links, search results, or cross-sell surfaces. *Why*: each entry point may require different context setting, and ignoring this produces disorienting experiences.

## Output

**On success**: Produces a complete user flow diagram with primary path, secondary paths, error paths, and system behavior annotations. Includes entry/exit criteria and stakeholder sign-off. Delivered as a Figma page or FigJam board linked to the project file.

**On failure**: Report which flow paths could not be mapped (undefined business rules, unresolved product decisions, missing technical constraints), what partial flow was created, and the open questions blocking completion.

## Related Skills

- [`flow-designer`](../flow-designer/SKILL.md) -- End-to-end user flows provide the structure; interaction flows add step-level detail.
- [`wireframe-builder`](../wireframe-builder/SKILL.md) -- User flows are a prerequisite for informed wireframing.
- [`spec-translator-design`](../../../design/head-of-design/spec-translator-design/SKILL.md) -- Translated design briefs define the feature scope that user flows operationalize.
