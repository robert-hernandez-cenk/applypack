# Feature Specification: Local engine address that resolves to a local machine

**Feature Branch**: `issue-31-local-ai-dns-check`

**Created**: 2026-10-14

**Status**: Draft

**Input**: Issue #31 — "Local engine address: accept a hostname that resolves to a local address". The local engine (Ollama, ADR 0057) takes an address "on this machine or your own network", but only a name that *looks* local is accepted. A name such as `ollama.lan` or `ollama.home` that points at a machine on the person's own network is refused.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use a model server by its network name (Priority: P1)

A person runs Ollama on another machine of their own network and reaches it by a name their router or DNS gives it (`ollama.lan`). They type `http://ollama.lan:11434` as the local engine's Server address (or in the welcome wizard) and it is saved, because the name points at a private address.

**Why this priority**: This is the whole request. Today the only way to use such a server is to type its numeric address, which breaks when the machine's address changes.

**Independent Test**: With a name that resolves to a private address, save it as the local engine's address: it is accepted and shown back as typed (root only). With a name that resolves to a public address, the save is refused with the existing "the local engine talks to a server on this machine or your own network" message.

**Acceptance Scenarios**:

1. **Given** a name whose every address is local (loopback, 10/8, 172.16/12, 192.168/16, IPv6 `::1` / link-local / unique-local, or 100.64/10), **When** it is saved as the local engine's address over plain `http://`, **Then** it is accepted.
2. **Given** a name that resolves to a local address AND a public one, **When** it is saved, **Then** it is refused (one public record is enough).
3. **Given** a name that resolves only to public addresses, **When** it is saved, **Then** it is refused with the "not local" message.
4. **Given** a name that does not resolve, or resolves to nothing, **When** it is saved, **Then** it is refused with a message saying the name could not be found, and nothing is stored.
5. **Given** an address that is already local by its text (an IP literal in a local range, `localhost`, `*.local`, `*.localhost`, `host.docker.internal`), **When** it is saved, **Then** it is accepted without any lookup, exactly as today.
6. **Given** `https://ollama.example.com` resolving to a public address, **When** it is saved as the local engine's address, **Then** it is still refused: a server on the internet goes in the OpenAI-compatible engine.

---

### User Story 2 - Both places that save the address agree (Priority: P2)

The same rule applies on the AI tab (`/settings`, "Server address") and in the welcome wizard's "use it" for a server found on this computer, so an address accepted in one is never refused in the other.

**Why this priority**: Consistency; the wizard re-checks the address after the common check today and would refuse a name the common check accepted.

**Independent Test**: Save the same resolving name in both places: both accept it. A server the wizard found at `127.0.0.1` or `host.docker.internal` is still accepted as before.

**Acceptance Scenarios**:

1. **Given** the local engine's address typed in `/settings`, **When** it is saved, **Then** the rule of User Story 1 applies.
2. **Given** a server found by the wizard's scan for the local engine, **When** the person picks "use it", **Then** it is saved under the same rule and is not refused for being a name.
3. **Given** the wizard's OpenAI-compatible path (LM Studio), **When** a server is picked, **Then** its behavior is unchanged: it must be local by its text.

---

### User Story 3 - The wider "local" range is applied the same everywhere (Priority: P3)

Tailscale-style addresses (100.64.0.0/10, the carrier-grade NAT range) count as the person's own network. Because every place that asks "is this address local?" shares one rule, the widening is the same for the local engine, for a LAN OpenAI-compatible server, and for the cost shown for it.

**Why this priority**: A deliberate decision (made with the owner on this issue) so a private mesh network can host the model server; it is secondary to the lookup itself.

**Independent Test**: An address in 100.64.0.0/10 typed as a literal is local for every purpose: plain http is allowed for the OpenAI-compatible engine, its cost reads "local" rather than "billed", and the crawler tokens that belong to OpenAI are dropped for it. 100.63.255.255 and 100.128.0.0 are not.

**Acceptance Scenarios**:

1. **Given** `http://100.100.1.5:11434`, **When** saved as the local engine's address, **Then** it is accepted.
2. **Given** the OpenAI-compatible engine at `http://100.100.1.5:1234/v1`, **When** the dashboard shows its cost, **Then** it is shown as local (no per-token bill) and plain http is accepted.
3. **Given** `http://100.63.255.255` and `http://100.128.0.1`, **When** tested as local addresses, **Then** both are not local.

### Edge Cases

- A name that resolves to a mix of IPv4 and IPv6 addresses is accepted only if every one of them is local.
- A name that resolves to an IPv4-mapped IPv6 form of a public address is not local (only plain `::1`, link-local and unique-local IPv6 are).
- A lookup that fails, times out or returns an empty list is "could not be found", never "accepted".
- A name that is local by its text never triggers a lookup, so a person who types `localhost` offline still saves.
- The address is judged when it is saved. Whether it still points at a local machine later is not checked.
- The `.env` fallback address (`OLLAMA_URL`) is not run through this rule; it keeps meaning what the operator wrote.
- Credentials in the address, a non-http(s) scheme and a malformed address are refused with their existing messages, before any lookup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Saving the local engine's address MUST accept a hostname that is not local by its text only if the hostname resolves, and EVERY address it resolves to is local.
- **FR-002**: A hostname whose lookup fails, times out, or returns no address MUST be refused with a message saying the name could not be found, and nothing MUST be stored.
- **FR-003**: A hostname that resolves to at least one non-local address MUST be refused with the existing "not local" message.
- **FR-004**: An address that is local by its text MUST be accepted without a lookup.
- **FR-005**: "Local" MUST be one rule shared by the text check and the check on resolved addresses: loopback (127/8, `::1`), 10/8, 172.16/12, 192.168/16, 100.64/10, IPv6 link-local and unique-local, plus the names `localhost`, `*.localhost`, `*.local` and `host.docker.internal`.
- **FR-006**: The widening to 100.64/10 MUST apply to every use of the shared rule: whether plain http is allowed for the OpenAI-compatible engine, whether that engine's cost reads "local", and whether OpenAI's crawler tokens are dropped for it.
- **FR-007**: The local engine's address MUST keep being stored as the server's root, with a pasted `/v1` or `/api` dropped, as today.
- **FR-008**: The welcome wizard and the AI tab MUST apply the same rule to the local engine's address. The wizard's OpenAI-compatible path MUST keep requiring a local address by its text.
- **FR-009**: The check MUST be testable without a network: the lookup is replaceable by a fake in tests.
- **FR-010**: The new refusal message MUST exist in every interface language the dashboard ships, in the same change.
- **FR-011**: The documentation that names where the address is checked (ADR 0057, the where-to-look table) MUST point at the new place, and ADR 0057 MUST record the decision and its limits.

### Key Entities

- **Local engine address**: the Ollama server root the person saves (or `OLLAMA_URL` when none is saved). The only value this feature validates.
- **Resolved addresses**: the addresses a hostname answers with at the moment of saving; judged, never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person whose model server has a name on their own network can save it by that name on the first attempt, without looking up a numeric address.
- **SC-002**: 100% of names that resolve to even one public address are refused when saved as the local engine's address.
- **SC-003**: Every address that was accepted before this change is still accepted, and every address that was refused for being non-local, a bad scheme or carrying credentials is still refused, except names that resolve to local addresses and the 100.64/10 range.
- **SC-004**: Saving an address that is local by its text takes no more time than before (no lookup).
- **SC-005**: All behavior above is covered by tests that run with no network.

## Assumptions

- The lookup uses the operating system's resolver (the same one the posting-URL guard already uses), so names from the router, `/etc/hosts` and a local DNS server resolve as they do for any other program on the machine.
- Inside a container, a name resolves as the container sees it; `host.docker.internal` stays local by its text.
- A refused save is the whole consequence: the address is only checked when saved, so an engine already saved keeps working even if its name later resolves elsewhere.
- Widening to 100.64/10 was chosen by the owner on this issue; it is not an open question for planning.

## Limits (documented, not fixed here)

- **DNS rebinding** is not closed: a name whose records change after it was saved is not pinned. This is the same residual as the posting-URL guard (`jobs/posting-url.ts`).
- **`OLLAMA_URL`** from the environment is not checked.
- No allowlist or denylist of names, and no change to which engine a name is used through.
- The default addresses the wizard scans (`127.0.0.1`, `host.docker.internal`) are unchanged.
