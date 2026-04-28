# Functional Requirements Document (FRD)

## Personal CLI + TUI Time Tracker for Omarchy

## 1. Overview

This document defines the requirements for a **personal-use time tracking tool** designed for **Omarchy**. The product will be a **CLI + TUI application** built with **Bun**, storing data locally in **SQLite**, and working **fully offline**.

The tool is meant to help track time across multiple **clients and projects**, while making switching between projects fast and safe. It must also react to **system suspend/resume**, and notify the user when time spent on a specific entry crosses a configured threshold.

The desktop notification portion should rely on the Linux desktop notification system, which is commonly exposed over the `org.freedesktop.Notifications` D-Bus interface; `notify-send` is a typical CLI entry point for that behavior on Linux. ([specifications.freedesktop.org](https://specifications.freedesktop.org/notification-spec/latest/index.html?utm_source=openai))

## 2. Goals

- Track time locally for **client + project** combinations.
- Provide a **CLI** for fast commands and a **TUI** for interactive use.
- Ensure only **one active timer** runs at a time.
- Automatically **pause on suspend**.
- Automatically **resume after wake only if sleep duration was short**.
- Repeatedly notify the user after a configured time threshold is reached for a running entry.
- Support useful reporting for:
  - **today**
  - **this week**
  - **by client**
  - **by project**
- Support **notes/tags** on entries.
- Work **fully offline**.
- Persist all data in **SQLite**.
- Support **Omarchy only** for v1.

## 3. Non-Goals

- Team collaboration or multi-user support.
- Cloud sync.
- Manual time entry editing in v1.
- Billing/invoicing workflows in v1.
- Cross-platform support outside Omarchy.
- Multiple simultaneous timers.

## 4. Assumptions and Constraints

- The application is intended for a **single user on a single machine**.
- The app will be developed using **Bun**.
- Data storage will use **SQLite**.
- Notifications should support:
  - desktop notification
  - sound
  - terminal message
- Linux notifications may depend on the active desktop session and notification daemon. The Freedesktop notification spec defines the standard notification service model, and `notify-send` is a common mechanism to trigger notifications in user sessions. ([specifications.freedesktop.org](https://specifications.freedesktop.org/notification-spec/latest/index.html?utm_source=openai))
- Suspend/resume detection will likely rely on Linux session/system interfaces such as systemd/logind or related D-Bus events, which are standard approaches on Linux systems. ([askubuntu.com](https://askubuntu.com/questions/1354167/systemd-dbus-interfaces-for-suspend-and-resume-notification?utm_source=openai))

## 5. Users

### Primary user

- A single freelance developer working across multiple clients/projects during the day.

## 6. Functional Scope

The system must provide the following major capabilities:

1. Manage clients and projects
2. Start/stop/switch timers
3. Detect suspend and resume behavior
4. Notify on elapsed threshold per running entry
5. Show current status
6. Generate time reports
7. Store local persistent history
8. Support entry notes/tags
9. Recover safely after interruption/restart

---

## 7. User Stories

- As a user, I want to **start tracking time** for a client/project quickly from the terminal.
- As a user, I want switching to another project to **automatically stop the current timer and start the new one**.
- As a user, I want the timer to **pause when the laptop suspends** so sleep time is not counted as work.
- As a user, I want the timer to **resume automatically only if the laptop was asleep for a short time**.
- As a user, I want the app to **restore the active timer state after restart/crash**.
- As a user, I want to receive repeated reminders every **5 minutes after crossing a set threshold** like 4 hours.
- As a user, I want thresholds to be configurable **per entry**.
- As a user, I want to see totals for **today**, **this week**, **by client**, and **by project**.
- As a user, I want to attach **notes/tags** to tracked work sessions.
- As a user, I want to use the tool **offline** with local-only storage.

---

## 8. Functional Requirements

### FR-1: Client management

The system shall allow the user to create, view, list, and archive clients.

#### Acceptance criteria

- User can create a client with a unique name.
- User can list all active clients.
- Archived clients are hidden from default lists but preserved in history.
- Existing time entries remain linked to archived clients.

---

### FR-2: Project management

The system shall allow the user to create, view, list, and archive projects under a client.

#### Acceptance criteria

- A project must belong to exactly one client.
- User can list projects by client.
- Archived projects cannot be started for new tracking unless explicitly restored.
- Historical entries remain readable in reports.

---

### FR-3: Time entry model

The system shall track time against a **client + project** pair.

Each tracked session should include:

- entry ID
- client
- project
- start timestamp
- end timestamp
- duration
- status
- optional notes
- optional tags
- threshold configuration for reminders

#### Acceptance criteria

- Each session is associated with one client and one project.
- Notes/tags can be attached when starting or updating a session.
- Session data is persisted in SQLite.

---

### FR-4: Start timer

The system shall allow the user to start a timer for a chosen client/project entry.

#### Acceptance criteria

- Starting a timer creates an active session with a start timestamp.
- If no threshold is specified, the default threshold behavior is applied or left unset based on configuration.
- The system must reject invalid client/project references.

---

### FR-5: Stop timer

The system shall allow the user to stop the currently running timer.

#### Acceptance criteria

- Stopping a timer records the end timestamp.
- Duration is computed from active tracked time only.
- Once stopped, the session is persisted as completed.

---

### FR-6: Switch timer

The system shall allow the user to start a new timer while another timer is active, and it must automatically **stop the current timer and start the new one**.

#### Acceptance criteria

- Only one timer may be active at any time.
- Starting a new timer while another is active automatically ends the previous one first.
- The switch operation should preserve both entries correctly with no overlap.

---

### FR-7: Single active timer rule

The system shall enforce a rule that there can be **only one active timer** at a time.

#### Acceptance criteria

- The database and app logic must prevent multiple concurrent active timers.
- Any attempted violation must fail safely or be auto-resolved using the switch behavior.

---

### FR-8: Suspend handling

The system shall detect when the laptop enters suspend and **pause** the active timer.

#### Acceptance criteria

- If a timer is active during suspend, the session changes to paused state.
- Sleep time must not be included in tracked work duration.
- A pause event must be recorded in persistent state so the app can recover correctly after restart if needed.

Linux suspend/resume observation is typically implemented through systemd/logind or related D-Bus interfaces. ([askubuntu.com](https://askubuntu.com/questions/1354167/systemd-dbus-interfaces-for-suspend-and-resume-notification?utm_source=openai))

---

### FR-9: Resume after wake

The system shall detect wake events and **resume the paused timer only if the sleep duration was short**.

#### Open configuration item

The FRD requires a configurable **short sleep threshold** value, for example:

- 1 minute
- 5 minutes
- 10 minutes
- custom value

#### Acceptance criteria

- On wake, the app calculates sleep duration.
- If sleep duration is less than or equal to the configured short-sleep threshold, the previously paused timer resumes automatically.
- If sleep duration exceeds the threshold, the timer remains paused.
- The user must be able to inspect whether the timer auto-resumed or stayed paused.

---

### FR-10: Crash/restart recovery

The system shall restore the active timer state when the application is relaunched after an interruption.

#### Acceptance criteria

- If the app exits unexpectedly while a timer is active, the state is recoverable from SQLite.
- On next launch, the app restores the active timer state.
- If suspend occurred before interruption, the restored state must remain consistent with pause/resume logic.
- Recovery must avoid duplicate active sessions.

---

### FR-11: Threshold notifications per entry

The system shall support reminder thresholds configured **per entry**.

#### Acceptance criteria

- A user can set a threshold such as 4 hours on a tracked entry.
- Threshold value is stored with the running session or its configuration.
- Different entries may have different thresholds.

---

### FR-12: Repeating notifications after threshold

The system shall repeatedly notify the user every **5 minutes** after the configured threshold has been crossed, until the timer is stopped, switched, or the reminders are dismissed/disabled for that entry.

#### Acceptance criteria

- First alert is triggered when elapsed tracked time reaches threshold.
- Additional alerts repeat every 5 minutes while the timer remains active.
- Repeated alerts stop immediately when the session stops or switches.
- The system should avoid duplicate notifications for the same reminder window.

Linux desktop notifications are generally delivered through the Freedesktop notification service over D-Bus. ([specifications.freedesktop.org](https://specifications.freedesktop.org/notification-spec/latest/index.html?utm_source=openai))

---

### FR-13: Notification channels

The system shall support all of the following notification channels:

- desktop notification
- sound
- terminal output

#### Acceptance criteria

- A threshold alert produces a desktop notification in the active desktop session.
- A threshold alert produces a terminal-visible message when running interactively.
- A threshold alert can optionally trigger a sound.
- Notification delivery failures should not crash the app.

The Freedesktop desktop notification spec defines a session-scoped notification service, and `notify-send` is a common Linux utility for posting such notifications. ([specifications.freedesktop.org](https://specifications.freedesktop.org/notification-spec/latest/index.html?utm_source=openai))

---

### FR-14: CLI interface

The system shall provide a command-line interface for non-interactive and scriptable usage.

#### Minimum commands

- `start`
- `stop`
- `switch`
- `status`
- `report today`
- `report week`
- `report client`
- `report project`
- `clients`
- `projects`

#### Acceptance criteria

- Commands work without the TUI.
- Commands return readable output for terminal use.
- Commands return non-zero exit codes on failure.
- Commands are suitable for shell aliases and scripts.

---

### FR-15: TUI interface

The system shall provide a terminal user interface for interactive management.

#### TUI should support

- viewing current active timer
- starting/stopping/switching timers
- browsing clients/projects
- viewing recent sessions
- viewing reports
- setting or viewing notes/tags
- showing reminder threshold status

#### Acceptance criteria

- The TUI can be launched from a single command.
- The TUI shows the currently active timer prominently.
- The TUI allows switching without needing raw SQL or manual file edits.

---

### FR-16: Status view

The system shall provide a status command/view showing the active timer state.

#### Acceptance criteria

- If a timer is active, status shows:
  - client
  - project
  - start time
  - elapsed active duration
  - threshold/reminder status
  - note/tags if present
- If no timer is active, status states that clearly.

---

### FR-17: Reporting

The system shall provide reports for:

- today
- this week
- by client
- by project

#### Acceptance criteria

- `today` shows total tracked time for the current day.
- `this week` shows total tracked time for the current week.
- `by client` aggregates durations by client.
- `by project` aggregates durations by project.
- Reports exclude sleep time and paused time from totals.

---

### FR-18: Notes and tags

The system shall allow notes and tags on entries.

#### Acceptance criteria

- A note may be attached to a session.
- One or more tags may be attached to a session.
- Notes/tags must be visible in session detail and available for future reporting extensions.

---

### FR-19: Local persistence

The system shall store all application data locally in **SQLite**.

#### Acceptance criteria

- Clients, projects, sessions, pause/resume events, thresholds, and metadata are persisted in SQLite.
- The application can restart without losing saved history.
- Database file location must be deterministic and documented.

Bun supports SQLite through its runtime APIs and ecosystem; exact implementation choice should be validated against the Bun version selected for the project. Since Bun evolves over time, the implementation should be pinned to a specific Bun release during development. ([linuxconfig.org](https://linuxconfig.org/how-to-send-desktop-notifications-using-notify-send?utm_source=openai))

---

### FR-20: Offline operation

The system shall function fully offline.

#### Acceptance criteria

- Starting/stopping/switching/reporting must not require network access.
- No cloud dependency is required for core features.
- The app remains usable when disconnected from the internet.

---

## 9. Non-Functional Requirements

### NFR-1: Performance

- Common CLI commands should feel near-instant for normal personal usage.
- Report generation should be fast for a single-user local dataset.

### NFR-2: Reliability

- The tool must not lose completed session data during normal usage.
- Unexpected shutdowns should not corrupt the active timer state irrecoverably.

### NFR-3: Simplicity

- Commands should be short and memorable.
- TUI navigation should be keyboard-first.

### NFR-4: Maintainability

- Code should be modular enough to separate:
  - tracking logic
  - persistence
  - notification handling
  - suspend/resume integration
  - CLI/TUI presentation

### NFR-5: Omarchy compatibility

- v1 only needs to support Omarchy.
- Omarchy-specific assumptions may be used where needed for notification and suspend/resume integration.

---

## 10. Suggested CLI Commands

These are suggested examples, not final syntax.

```bash
track start --client "Acme" --project "Dashboard"
track start --client "Acme" --project "Dashboard" --note "Bug fixes" --tags bugfix,frontend --threshold 4h
track stop
track switch --client "Beta" --project "API"
track status
track report today
track report week
track report client
track report project
track tui
track clients add "Acme"
track projects add --client "Acme" "Dashboard"
```

---

## 11. Suggested Data Model

### Tables

- `clients`
- `projects`
- `sessions`
- `session_tags`
- `pause_events`
- `app_state`
- `notification_events`

### Key entities

- **clients**: id, name, archived_at
- **projects**: id, client_id, name, archived_at
- **sessions**: id, client_id, project_id, start_at, end_at, status, note, threshold_minutes
- **pause_events**: id, session_id, paused_at, resumed_at, reason
- **notification_events**: id, session_id, threshold_reached_at, notification_sent_at, notification_type

---

## 12. Edge Cases

The system should define behavior for the following cases:

1. **Start command issued for same active client/project**
   - Option: ignore, warn, or restart timer
   - Recommended v1: warn and keep current timer active

2. **Wake occurs but app was not running in foreground**
   - Background monitoring component or startup recovery logic should reconcile state

3. **Notification daemon unavailable**
   - Fall back to terminal output and/or sound failure-safe behavior

4. **Very long sleep**
   - Timer remains paused after wake

5. **Database locked/corrupt**
   - Show clear error; do not silently lose time

6. **Archived project previously active**
   - Historical report remains intact; project cannot be newly started

7. **Threshold changed mid-session**
   - New threshold should apply from time of change or entire session based on implementation decision
   - Recommended v1: apply immediately using total elapsed active time

---

## 13. Open Decisions

These items still need explicit definition before implementation:

1. **What counts as a “short sleep”?**
   - Suggested default: **5 minutes**
2. **Should repeating notifications be dismissible for the current session?**
   - Recommended: yes
3. **Should sound alerts be configurable on/off?**
   - Recommended: yes
4. **Should tags be free-text or from a saved preset list?**
   - Recommended v1: free-text
5. **Should reports show currently running session separately from completed sessions?**
   - Recommended: yes

---

## 14. Acceptance Summary

The product will be considered acceptable for v1 when:

- User can manage clients and projects locally.
- User can start, stop, and switch timers from CLI and TUI.
- Only one timer can run at a time.
- Active timer pauses on suspend.
- Timer resumes on wake only when sleep duration is below a configurable threshold.
- Active timer state is restorable after restart/crash.
- Per-entry threshold reminders work.
- Reminder repeats every 5 minutes after threshold is crossed.
- Alerts are delivered through desktop notification, terminal output, and sound where available.
- Reports exist for today, this week, by client, and by project.
- Notes/tags are supported.
- All data is stored in SQLite.
- Core usage works fully offline on Omarchy.

---

## 15. Recommended v1 Architecture

Since you asked for “everything,” here is a practical implementation direction.

### Core modules

- **CLI layer**: command parsing and scriptable commands
- **TUI layer**: interactive terminal UI
- **Timer engine**: active session management
- **Persistence layer**: SQLite access
- **System integration layer**:
  - suspend detection
  - wake detection
  - notifications
  - sound
- **Reporting layer**: aggregated queries for day/week/client/project

### Process model

Recommended v1:

- one main app
- plus a lightweight background watcher/service for:
  - suspend/wake handling
  - threshold reminders

A session-scoped Linux notification approach is the safest fit because desktop notifications are generally exposed via the user session’s D-Bus notification service. ([specifications.freedesktop.org](https://specifications.freedesktop.org/notification-spec/latest/index.html?utm_source=openai))

---

## Interesting Findings:

- The biggest implementation risk is **not** SQLite or CLI/TUI — it is **Linux session integration**, especially making notifications work reliably from background processes after suspend/resume. Linux notifications are session-scoped and depend on the desktop notification service exposed over D-Bus. ([specifications.freedesktop.org](https://specifications.freedesktop.org/notification-spec/latest/index.html?utm_source=openai))
- Your feature set is very realistic for a personal tool, but **auto pause/resume + repeating reminders + crash recovery** pushes it beyond a simple timer script into a small system-integrated productivity app.
- Supporting **per-entry thresholds** is a very nice choice: it is more flexible than global reminders and fits freelance work well, especially when some projects have “soft caps” like 4h/day.

## Sources:

- Freedesktop Desktop Notifications Specification: ([specifications.freedesktop.org](https://specifications.freedesktop.org/notification-spec/latest/index.html?utm_source=openai))
- Linux `notify-send` usage overview: ([linuxconfig.org](https://linuxconfig.org/how-to-send-desktop-notifications-using-notify-send?utm_source=openai))
- ArchWiki notes on desktop notifications/session behavior: ([wiki.archlinux.org](https://wiki.archlinux.org/title/Desktop_notifications_%28%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9%29?utm_source=openai))
- Linux/systemd D-Bus and suspend/resume references: ([askubuntu.com](https://askubuntu.com/questions/1354167/systemd-dbus-interfaces-for-suspend-and-resume-notification?utm_source=openai))
