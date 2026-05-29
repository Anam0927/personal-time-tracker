# Functional Requirements Document (FRD)
## Multi-Device Personal Time Tracker for Linux and Mac

## 1. Overview
This document defines the functional requirements for a **personal time-tracking system** used across **two device types: a main Linux machine and a Mac**. The system will provide a **CLI + TUI client** on both devices, backed by a shared **API** and **Neon Postgres database**. The application is intended for **single-user personal use only**.

The system must support:
- tracking time by **client + project**
- optional **notes and tags**
- one **active timer** at a time
- **device ownership** of the active timer
- **ownership transfer**
- per-device activity detection and prompts
- **suspend/resume** behavior on the owner device
- per-entry threshold reminders
- reports across clients, projects, and devices

The TUI is a first-class requirement in v1. Python is an acceptable implementation language for both the client and backend, and FastAPI provides built-in patterns for token-style API key auth while Textual provides a Python TUI framework with app/screen architecture and notifications support. Textual also documents that apps can run over SSH, which is useful for future flexibility even though SSH-specific detection is currently out of scope. ([fastapi.tiangolo.com](https://fastapi.tiangolo.com/de/reference/security/?utm_source=openai))

---

## 2. Product Goals

### Primary goals
- Provide a **single personal time-tracking system** usable from both Linux and Mac.
- Make switching between projects fast and safe.
- Ensure only **one timer** is active globally.
- Support **device-aware ownership** of the active timer.
- Allow another device to **view**, **stop/switch**, or **take ownership** of the timer.
- Prompt before ownership-affecting actions when another device owns the timer.
- Detect inactivity on the **owner device**, prompt the user, and auto-pause if no response is received.
- Pause on **suspend** and conditionally resume after wake if sleep was short.
- Send reminder notifications after entry thresholds are reached.
- Provide a usable **CLI and TUI** in v1.
- Keep the tool easy enough to use consistently.

### Success criteria
The project is worth building only if it remains:
- fast to access
- low-friction
- trustworthy
- easier to use consistently than the current workaround tools

---

## 3. Non-Goals
The following are out of scope for v1:

- multi-user/team support
- full SSH-specific activity heuristics
- browser/PWA client
- offline-first sync
- native mobile apps
- invoicing/billing integrations
- calendar/task-manager integrations
- advanced manual time correction such as merge/split sessions
- cloud collaboration
- role-based permissions

---

## 4. Users

### Primary user
- One individual user operating across:
  - a **main Linux machine**
  - a **Mac**
- The same user may switch devices during the day.
- The same user may want to inspect and control the same active timer from either device.

---

## 5. Product Scope

The system includes:

### Client applications
- CLI on Linux
- CLI on Mac
- TUI on Linux
- TUI on Mac

### Shared backend
- API layer
- Neon Postgres database

### System capabilities
- authentication via simple token
- device registration and identification
- timer ownership model
- time tracking and switching
- activity prompts and auto-pause
- suspend/resume handling
- threshold reminders
- reporting
- audit/history logging

---

## 6. Core Concepts

### 6.1 Timer
A timer represents the currently active work session.

### 6.2 Session
A session is a tracked work interval tied to:
- one client
- one project
- optional notes
- optional tags

### 6.3 Device
A device is a named client installation, such as:
- `linux-main`
- `mac-neo`

### 6.4 Owner device
The **owner device** is the device currently responsible for the active timer’s automatic behaviors, including:
- inactivity prompts
- auto-pause logic
- suspend/resume handling
- threshold notification delivery

### 6.5 Ownership transfer
Ownership may move from one device to another through explicit user action.

---

## 7. User Stories

- As a user, I want to start a timer on Linux or Mac and see the same active session from either device.
- As a user, I want only one global timer to exist at a time.
- As a user, I want switching projects to automatically stop the current timer and start the new one.
- As a user, I want the system to know which device currently owns the active timer.
- As a user, I want another device to be able to view, stop, switch, or take ownership of the timer.
- As a user, I want the system to ask for confirmation before interrupting a timer owned by another device.
- As a user, I want inactivity on the owner device to trigger a prompt first, then auto-pause if I do not respond.
- As a user, I want suspend on the owner device to pause the timer.
- As a user, I want the timer to resume only if wake happens after a short sleep of 2 minutes or less.
- As a user, I want per-entry reminders after a threshold, repeating every 10 minutes.
- As a user, I want device-local notifications on the owner device.
- As a user, I want reports by day, week, client, project, and device.
- As a user, I want a history of ownership changes and major timer events so I can trust what happened.

---

## 8. Functional Requirements

## FR-1: Single-user authentication
The system shall support a **single user account** authenticated through a **simple token**.

### Acceptance criteria
- The client can authenticate using a configured token.
- Requests without a valid token are rejected.
- The system does not require username/password flows in v1.

FastAPI provides built-in support for API key patterns including header-based API keys, which aligns with a simple token approach. ([fastapi.tiangolo.com](https://fastapi.tiangolo.com/de/reference/security/?utm_source=openai))

---

## FR-2: Device registration and identity
The system shall support named devices.

### Acceptance criteria
- Each client installation can be registered with a device name.
- Device names are visible in status, reports, and history.
- The system records the device associated with each relevant action.

### Example device names
- `linux-main`
- `mac-neo`

---

## FR-3: Client management
The system shall allow creation, listing, viewing, and archiving of clients.

### Acceptance criteria
- A client has a unique name per user.
- Archived clients remain available in historical reports.
- Archived clients are hidden from default active selections.

---

## FR-4: Project management
The system shall allow creation, listing, viewing, and archiving of projects.

### Acceptance criteria
- A project belongs to one client.
- Projects can be listed by client.
- Archived projects remain available historically.
- Archived projects cannot be newly started unless restored.

---

## FR-5: Session model
The system shall store tracked sessions with:
- client
- project
- optional note
- optional tags
- device metadata
- threshold configuration
- ownership metadata
- lifecycle state

### Acceptance criteria
- Every session belongs to one client and one project.
- Notes and tags are optional.
- Session records are stored in the database.
- Device/action metadata is retained.

---

## FR-6: Start timer
The system shall allow the user to start a timer for a selected client and project.

### Acceptance criteria
- Starting a timer creates a new active session.
- The starting device becomes the owner device.
- Optional note/tags may be supplied.
- Optional threshold may be supplied.
- If another timer is active, the system uses switch behavior rather than creating parallel timers.

---

## FR-7: Stop timer
The system shall allow the user to stop the active timer.

### Acceptance criteria
- Stopping a timer sets an end time.
- Stop events record which device initiated the stop.
- The active timer is cleared globally.
- If the timer is owned by another device, the system prompts for confirmation before stopping.

---

## FR-8: Switch timer
The system shall allow the user to switch from the current active session to a new one.

### Acceptance criteria
- Switching automatically stops the current session and starts a new one.
- The new session becomes active immediately.
- The initiating device becomes the owner device after the switch.
- If another device owns the current timer, the system prompts for confirmation before switching.

---

## FR-9: Single active timer rule
The system shall enforce exactly one active global timer at a time.

### Acceptance criteria
- No two sessions can both be active simultaneously.
- Concurrent actions from different devices are resolved safely by the backend.
- The API is the source of truth for active session state.

---

## FR-10: Ownership model
The system shall maintain explicit ownership of the active timer.

### Acceptance criteria
- Every active timer has one owner device.
- Ownership is visible in status output and TUI views.
- Ownership determines which device performs inactivity and suspend/resume automation.
- Ownership changes are recorded.

---

## FR-11: Ownership transfer
The system shall support explicit ownership transfer between devices.

### Acceptance criteria
- A device can request to take ownership of the active timer.
- If another device owns the timer, the system prompts for confirmation before transfer.
- Successful transfer updates the owner device immediately.
- Ownership transfer is logged in history.

---

## FR-12: Cross-device control
The system shall allow another device to:
- view the active timer
- stop the active timer
- switch the active timer
- take ownership of the timer

### Acceptance criteria
- Cross-device actions are allowed for the authenticated user.
- Potentially disruptive actions require confirmation when initiated from a non-owner device.
- The result of the action is reflected across clients on refresh.

---

## FR-13: Inactivity detection by owner device
The system shall support activity/inactivity detection on the owner device only.

### Acceptance criteria
- Only the owner device may trigger automatic inactivity workflows.
- Inactivity detection is device-scoped, not global.
- The non-owner device does not auto-pause the active timer.

### Design note
Because Linux and Mac expose different local activity signals, the implementation may vary by platform. The FRD intentionally defines behavior at the feature level rather than mandating one single cross-platform mechanism.

---

## FR-14: Prompt before auto-pause
The system shall prompt the user on the owner device when inactivity is detected.

### Acceptance criteria
- The user receives a local prompt asking whether they are still working.
- If the user confirms, the session remains active.
- If the user does not respond within the configured grace period, the timer is auto-paused.
- Prompt and timeout events are recorded.

---

## FR-15: Auto-pause after unanswered prompt
The system shall auto-pause the active timer when an inactivity prompt is unanswered.

### Acceptance criteria
- Auto-pause occurs only after a prompt has been issued.
- Auto-pause records the reason and triggering device.
- Paused time is excluded from tracked duration totals.

---

## FR-16: Suspend handling
The system shall pause the active timer when the **owner device** suspends.

### Acceptance criteria
- Suspend on a non-owner device does not automatically pause the timer.
- Suspend on the owner device triggers a pause event.
- The pause reason is recorded as suspend.

---

## FR-17: Wake handling
The system shall detect wake on the owner device and handle timer resumption conditionally.

### Acceptance criteria
- If sleep duration is **2 minutes or less**, the system may resume automatically.
- If sleep duration is greater than 2 minutes, the timer remains paused.
- If another device becomes active during that time, the system asks before resuming.
- Wake-related actions are logged.

---

## FR-18: Ask before conflicting resume behavior
The system shall ask before automatic resume in conflict cases.

### Acceptance criteria
- If the owner device wakes but another device has intervened, the system does not silently resume.
- The user is asked what to do if the ownership or active-session state changed during sleep.

---

## FR-19: Threshold reminders
The system shall support reminder thresholds configured per entry.

### Acceptance criteria
- A session can specify a threshold such as 4 hours.
- Thresholds are stored with the session.
- Different sessions may use different thresholds.

---

## FR-20: Repeating reminders
The system shall send repeated reminders every **10 minutes** after the threshold has been reached, while the session remains active.

### Acceptance criteria
- The first reminder is sent when tracked active time reaches the threshold.
- Follow-up reminders occur every 10 minutes.
- Reminders stop when the session stops, switches, or pauses.
- Duplicate reminders for the same reminder window are prevented.

---

## FR-21: Notification delivery
The system shall deliver reminders and prompts as **device-local notifications** on the owner device.

### Acceptance criteria
- Notifications are shown on the device responsible for the active timer.
- The notification mechanism may be platform-specific.
- Notification delivery failures do not crash the app.

Textual includes notification support within the app framework, which can be useful for TUI-level alerts, though OS-native notification plumbing may still require platform-specific implementation. ([textual.textualize.io](https://textual.textualize.io/api/app/?utm_source=openai))

---

## FR-22: Reports
The system shall provide reports for:
- today
- this week
- by client
- by project
- by device

### Acceptance criteria
- Reports are available via CLI and TUI.
- Report totals exclude paused durations.
- Reports can show source device information.
- Aggregation is accurate across devices.

---

## FR-23: Status view
The system shall provide a current status view.

### Acceptance criteria
If a timer is active, status must show:
- client
- project
- note/tags if present
- elapsed tracked time
- threshold/reminder status
- owner device
- started-by device
- current lifecycle state

If no timer is active, status must say so clearly.

---

## FR-24: Recent sessions view
The system shall provide access to recent sessions.

### Acceptance criteria
- Recent sessions are visible in CLI and/or TUI.
- Sessions can display note, tags, device, and duration.
- Paused/auto-paused states are visible.

---

## FR-25: Ownership history
The system shall provide visibility into ownership changes and key lifecycle events.

### Acceptance criteria
- The system records:
  - start
  - stop
  - switch
  - pause
  - resume
  - ownership transfer
  - inactivity prompt
  - prompt timeout
  - auto-pause
  - suspend
  - wake
- History can be inspected from the client.
- Event entries include timestamp and device.

---

## FR-26: Limited manual editing
The system shall support **limited manual editing** in v1.

### Scope of limited editing
Recommended v1 scope:
- edit notes on a session
- edit tags on a session
- optionally delete the most recent session
- no editing of start/end timestamps in v1
- no merge/split in v1

### Acceptance criteria
- Notes/tags can be updated after session completion.
- Manual editing is restricted to approved editable fields.
- All edits are auditable.

---

## FR-27: CLI
The system shall provide a scriptable CLI.

### Minimum commands
- `track start`
- `track stop`
- `track switch`
- `track status`
- `track report today`
- `track report week`
- `track report client`
- `track report project`
- `track report device`
- `track devices list`
- `track device status`
- `track device claim`
- `track tui`

### Acceptance criteria
- Commands are human-friendly and shell-friendly.
- Commands return useful exit codes.
- Commands work on Linux and Mac.

---

## FR-28: TUI
The system shall provide a TUI in v1.

### TUI capabilities
- current timer dashboard
- client/project browsing
- start/stop/switch
- device status
- ownership transfer
- recent sessions
- reports
- prompts and reminders
- history view

### Acceptance criteria
- The TUI can be launched from a single command.
- The active session and current owner device are obvious.
- Common daily actions can be completed without leaving the TUI.

Textual supports app/screen-based terminal interfaces and a built-in command palette, which is a good fit for a Python TUI with multiple views. ([textual.textualize.io](https://textual.textualize.io/?utm_source=openai))

---

## FR-29: Backend API
The system shall provide a backend API as the source of truth for business logic.

### Acceptance criteria
- Clients do not write directly to the database.
- The API enforces:
  - single active timer rule
  - ownership logic
  - confirmation rules
  - session lifecycle validation
- The API is stateless with persistent storage in Neon Postgres.

---

## FR-30: Database
The system shall persist shared state in Neon Postgres.

### Acceptance criteria
- All persistent tracking data is stored centrally.
- The backend supports concurrent requests from multiple devices.
- The schema supports event history and ownership metadata.

Neon provides hosted Postgres, which fits the API-plus-database design and avoids direct SQLite file syncing across devices. ([neon.tech](https://neon.tech/pdf/DPA.pdf?utm_source=openai))

---

## 9. Non-Functional Requirements

### NFR-1: Usability
The system must be easy enough to use consistently.
- Core commands should be short.
- The TUI should be keyboard-first.
- The most common action path should take minimal steps.

### NFR-2: Trustworthiness
The user must be able to understand why the timer is in its current state.
- ownership must be visible
- prompts and auto-pauses must be logged
- suspend/wake effects must be inspectable

### NFR-3: Reliability
- the backend must prevent duplicate active timers
- event ordering must remain consistent
- failed client actions must not corrupt global state

### NFR-4: Performance
- status and common commands should feel fast
- reports should load quickly for a personal dataset

### NFR-5: Cross-platform support
- v1 supports Linux and Mac clients
- platform-specific activity/notification mechanisms may differ
- business behavior must remain consistent

### NFR-6: Security
- token-based auth must be supported
- secrets must not be hard-coded
- clients must store tokens safely enough for personal use

---

## 10. Suggested Architecture

## Client
- Python CLI
- Python TUI using Textual
- local config for:
  - token
  - device name
  - API URL
  - platform-specific notification settings

## Backend
- Python API using FastAPI
- business logic enforcement at API layer
- Neon Postgres as system of record

## Services / modules
- auth
- devices
- sessions
- ownership
- reminders
- inactivity
- suspend/wake integration
- reports
- audit/history

---

## 11. Suggested Data Model

### users
- id
- token_hash
- created_at

### devices
- id
- user_id
- name
- platform
- last_seen_at
- is_active
- created_at

### clients
- id
- user_id
- name
- archived_at
- created_at

### projects
- id
- client_id
- name
- archived_at
- created_at

### sessions
- id
- user_id
- client_id
- project_id
- note
- threshold_minutes
- reminder_interval_minutes
- status
- owner_device_id
- started_by_device_id
- stopped_by_device_id
- start_at
- end_at
- created_at
- updated_at

### session_tags
- id
- session_id
- tag

### pauses
- id
- session_id
- paused_at
- resumed_at
- reason
- device_id

### prompts
- id
- session_id
- device_id
- prompt_type
- shown_at
- responded_at
- response
- timeout_at

### event_log
- id
- session_id
- device_id
- event_type
- payload
- created_at

---

## 12. Open Decisions
These are still implementation decisions, not product blockers:

1. **Network unavailable behavior**
   - not yet defined
   - recommend: read-only status + clear error for write actions in v1

2. **Confirmation UX**
   - command-line prompt
   - TUI modal/dialog
   - both

3. **How inactivity is detected on Linux vs Mac**
   - implementation-specific
   - should be abstracted behind a client-side activity service

4. **How long the inactivity prompt grace period should be**
   - recommend default: 1–2 minutes

5. **Whether deleting the most recent session is included in limited editing**
   - recommended: yes

---

## 13. Rollout Phases

## Phase 1: Shared Core
- FastAPI backend
- Neon schema
- token auth
- device registration
- client/project/session CRUD
- single active timer rule

## Phase 2: Daily Usability
- start/stop/switch/status
- notes/tags
- today/week/client/project reports
- device reports
- ownership model

## Phase 3: Device Intelligence
- inactivity prompts
- auto-pause
- ownership transfer
- event history

## Phase 4: System Integration
- Linux + Mac notifications
- suspend/wake handling
- short-sleep resume logic

## Phase 5: Comfort Layer
- full TUI
- history views
- recent sessions
- better reporting polish

---

## 14. Smallest Worthwhile MVP
The smallest version likely worth building is:

- Python CLI on Linux and Mac
- FastAPI backend
- Neon Postgres
- token auth
- named devices
- single active timer
- start / stop / switch
- status
- ownership transfer
- today/week/client/project/device reports
- notes/tags
- event history
- simple prompt-then-auto-pause flow

The TUI should still be in v1, but it could come immediately after the CLI-first MVP.

---

## 15. Acceptance Summary
The system is acceptable for v1 when:

- a single user can use the app on both Linux and Mac
- both devices can view the same global timer state
- only one active timer exists globally
- switching automatically stops the current timer and starts the next
- ownership is explicit and visible
- ownership transfer works with confirmation
- owner-device inactivity triggers prompt-then-auto-pause
- owner-device suspend pauses the timer
- wake resumes only if sleep lasted 2 minutes or less
- per-entry reminders work and repeat every 10 minutes
- notifications are delivered on the owner device
- reports exist for today, week, client, project, and device
- history shows important timer and ownership events
- CLI and TUI are both usable for everyday workflow

---

## Interesting Findings
- Your updated workflow makes **shared state and ownership** more important than raw idle detection. This is a product-shaping change.
- Moving from local SQLite to **API + Postgres** is a meaningful scope increase, but it matches your real multi-device usage better.
- Textual is a particularly strong fit here because it supports Python TUIs and explicitly documents that apps can run over SSH, which gives you flexibility later even though SSH-specific logic is out of scope for now. ([textual.textualize.io](https://textual.textualize.io/?utm_source=openai))
- FastAPI’s API key/header patterns are a good fit for your “simple token” requirement. ([fastapi.tiangolo.com](https://fastapi.tiangolo.com/de/reference/security/?utm_source=openai))

## Sources
- Python `sqlite3` docs: ([docs.python.org](https://docs.python.org/3/library/sqlite3.html?utm_source=openai))
- FastAPI security / API key header docs: ([fastapi.tiangolo.com](https://fastapi.tiangolo.com/de/reference/security/?utm_source=openai))
- Textual docs and API: ([textual.textualize.io](https://textual.textualize.io/api/app/?utm_source=openai))
- Neon documentation/source reference: ([neon.tech](https://neon.tech/pdf/DPA.pdf?utm_source=openai))

If you want, next I can turn this into:
1. a **technical design document**
2. a **database schema**
3. a **build plan with milestones**
4. a **GitHub issues/task breakdown**
