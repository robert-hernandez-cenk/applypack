# Feature Specification: OIDC login for the dashboard

**Feature Branch**: `issue-2-oidc-login`

**Created**: 2026-10-12

**Status**: Draft

**Input**: GitHub issue #2 — "Enable OIDC login for the dashboard". The dashboard is protected only by an optional shared username and password. An operator who exposes it beyond their own machine has no way to use the identity provider they already run.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in through the organisation's identity provider (Priority: P1)

An operator who runs ApplyPack on a server has configured an OpenID Connect identity provider. When they open the dashboard in a browser without a session, they are sent to the provider, authenticate there, and land back on the page they asked for with access to the whole dashboard.

**Why this priority**: This is the feature. Without it nothing else matters.

**Independent Test**: With a provider configured, open a dashboard page in a browser with no session. Complete sign-in at the provider. The original page loads, and a second request in the same browser needs no new sign-in.

**Acceptance Scenarios**:

1. **Given** sign-in is configured and the visitor has no session, **When** they request any dashboard page, **Then** they are sent to the provider to authenticate.
2. **Given** the visitor completes authentication at the provider, **When** they return to the dashboard, **Then** they see the page they originally asked for, and later pages load without another sign-in.
3. **Given** the visitor cancels or fails authentication at the provider, **When** they return to the dashboard, **Then** they see a clear message that sign-in did not complete, with a way to try again, and they are not given access.
4. **Given** a return from the provider that was not started by this dashboard (stale, replayed or forged), **When** it reaches the dashboard, **Then** it is refused and no session is created.

---

### User Story 2 - Sign out and session expiry (Priority: P2)

A signed-in operator can end their session, and a session that is left alone stops working after a fixed time.

**Why this priority**: A login that cannot end is a standing hole on shared or borrowed machines.

**Independent Test**: Sign in, choose sign out, then request a dashboard page: sign-in is required again. Separately, wait past the session lifetime and observe the same.

**Acceptance Scenarios**:

1. **Given** a signed-in operator, **When** they choose sign out, **Then** their session ends and the next page request requires sign-in.
2. **Given** a session older than its lifetime, **When** the operator requests a page, **Then** they are sent to sign in again.
3. **Given** a session token that was altered or issued by a different installation, **When** it is presented, **Then** it is treated as no session.

---

### User Story 3 - Existing setups keep working (Priority: P1)

An operator who has not configured sign-in sees no change. An operator who uses the shared username and password today keeps it until they choose to configure sign-in.

**Why this priority**: Most installs run on one machine without any login; breaking them or their health checks is a regression.

**Independent Test**: Start the dashboard with no sign-in settings and with only the shared password; behaviour matches the previous release. Start with sign-in configured and check the health endpoint with the shared password.

**Acceptance Scenarios**:

1. **Given** no sign-in settings, **When** the dashboard starts, **Then** behaviour is identical to the previous release.
2. **Given** sign-in is configured and the shared username and password is also set, **When** a browser requests a page, **Then** it goes through the provider and the shared password is not accepted for pages.
3. **Given** sign-in is configured and the shared username and password is set, **When** the container health check requests the health endpoint with those credentials, **Then** it succeeds.
4. **Given** sign-in is configured and no shared password is set, **When** the health check requests the health endpoint, **Then** it must still be able to succeed without a browser session.

---

### User Story 4 - A misconfigured lock does not open the door (Priority: P1)

If the operator supplies some but not all of the sign-in settings, or a setting that cannot work, the dashboard refuses to start and says which setting is wrong, instead of serving without protection.

**Why this priority**: The failure that matters is a dashboard the operator believes is locked and is not.

**Independent Test**: Start with each required setting missing in turn, and with a malformed address; each start fails with a message naming the setting.

**Acceptance Scenarios**:

1. **Given** only some of the required sign-in settings, **When** the dashboard starts, **Then** it exits with a message naming what is missing, and serves nothing.
2. **Given** the provider cannot be reached or does not describe itself correctly at start, **When** the dashboard starts, **Then** it exits with a message saying so, and serves nothing.

---

### Edge Cases

- Signed-in operator's browser has cookies disabled: sign-in cannot complete; the operator sees a message about it, not a redirect loop.
- The provider is down while a valid session exists: existing sessions keep working until they expire.
- The provider returns an identity with no usable identifier: the sign-in is refused.
- Requests that are not browser page loads (form posts, background polling) without a session: refused with an authentication error rather than a redirect to the provider.
- Static assets (stylesheet, scripts, fonts) and the health endpoint do not trigger the sign-in redirect.
- Two installations on the same host or domain must not accept each other's sessions.
- Open redirect: the page a visitor returns to after sign-in can only be a path on this dashboard.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an operator enable sign-in through an OpenID Connect provider using settings supplied in the environment, with no change to the database.
- **FR-002**: When sign-in is enabled, every dashboard page and action MUST require a valid session, except the sign-in, return, and sign-out routes, static assets, and the health endpoint.
- **FR-003**: A visitor without a session who requests a page in a browser MUST be sent to the provider and, on success, returned to the page they requested (a path on this dashboard only).
- **FR-004**: A request that is not a page load (a form post or a background call) without a session MUST be refused with an authentication error, not redirected.
- **FR-005**: The system MUST refuse a return from the provider that does not match a sign-in this dashboard started, or whose identity token fails validation, and MUST NOT create a session.
- **FR-006**: Any user the provider authenticates MUST be allowed in; the system applies no allowlist of its own. The documentation MUST state that the provider must be restricted to the intended users.
- **FR-007**: A session MUST end on sign out and MUST expire after a fixed lifetime; a tampered session MUST be treated as no session.
- **FR-008**: The session MUST NOT be readable or sendable by page scripts and MUST be sent only over the protection the deployment provides (secure when the dashboard is served over HTTPS).
- **FR-009**: When sign-in is enabled, the shared username and password MUST NOT grant access to pages, and MUST still be accepted for the health endpoint when it is set.
- **FR-010**: When sign-in is enabled and no shared password is set, the health endpoint MUST remain reachable by the container health check.
- **FR-011**: A partial or unusable sign-in configuration, or a provider that cannot be reached at start, MUST stop the dashboard from starting with a message that names the problem.
- **FR-012**: With no sign-in settings, behaviour MUST be identical to the previous release.
- **FR-013**: The worker process MUST NOT gain any web server or sign-in code path.
- **FR-014**: Every message a person reads in the new flow MUST be available in each language the interface supports.
- **FR-015**: Secrets used for sign-in MUST be read from the environment only, never written to logs or rendered in a page.
- **FR-016**: Sign-ins, failures and sign-outs MUST be logged without secrets or tokens.
- **FR-017**: The settings, how to register the dashboard with a provider, and the "restrict your provider" warning MUST be documented where the other environment settings are.

### Key Entities

- **Sign-in settings**: provider address, client identity and secret, the dashboard's public address, the key that signs sessions, and the session lifetime.
- **Session**: who signed in (the provider's stable identifier, and a display name or email if given), when it started, when it expires.
- **Pending sign-in**: the short-lived record linking a visitor leaving for the provider to their return, including the page they wanted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator with a provider already running can go from settings to a working sign-in in under 15 minutes using only the documentation.
- **SC-002**: With sign-in enabled, 100% of dashboard pages and actions (except the listed exemptions) refuse a request with no valid session.
- **SC-003**: A returning operator with a live session reaches any page with no further provider round trip.
- **SC-004**: With none of the sign-in settings present, the existing test suite and route smoke pass unchanged.
- **SC-005**: Every misconfiguration case in Story 4 ends in a failed start with a message naming the cause, never in an unlocked dashboard.
- **SC-006**: The container health check passes with sign-in enabled, both with and without a shared password set.

## Assumptions

- The dashboard has a single operator role; there are no per-user permissions, so "who" is recorded only for the log and the display.
- The provider supports OpenID Connect discovery and returns a verified identity token; providers without these are out of scope.
- The dashboard is reached at one stable public address, which the operator supplies; the return address is derived from it.
- Sessions are held in the browser as a signed value, so a restart does not sign people out; changing the signing key does.
- Default session lifetime is 8 hours.
- Sign-out ends the dashboard's session only, not the provider's.
- Dependency on a maintained OIDC client library is a plan-stage decision, recorded in an ADR.

## Non-goals

- Roles, per-user data, or an allowlist of users or domains.
- Any change to the worker process.
- Letting the dashboard itself be managed through the provider's directory (user provisioning).
- Replacing Basic Auth for installs that do not configure sign-in.
