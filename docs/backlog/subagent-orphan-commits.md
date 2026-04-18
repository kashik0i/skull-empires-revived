# Subagent commits landing as orphans

**Symptom:** During subagent-driven execution, a subagent's `git commit` sometimes lands on a detached HEAD instead of advancing the working branch. The commit object exists (reachable by SHA) but is not in the branch's linear history.

**Observed:**
- Phase 1E session: T2/T3/T4 created commits but `feat/phase-1e` branch ref stayed at T1's commit. Discovered when sub-worktrees branched from the stale ref.
- Phase 1E session: T10 + T11 commits orphaned. The next subagent (T12) saw uncommitted "reverts" of those tasks' files in the working tree and tried to ignore them, claiming pre-existing failures.

**Root cause hypothesis:** When multiple background subagents touch the same git repo, one of them (the controller's view) may end up at a detached HEAD after a checkout. The next subagent commits without re-attaching to the branch.

**Mitigations attempted:**
- Recovered both incidents via `git checkout -B feat/phase-1e HEAD` and `git cherry-pick <orphan-sha>`.
- Tests catch the broken state quickly because the working tree's file content doesn't match what the linear-history commits claim.

**Possible fixes:**
- Each subagent prompt should start with a `git checkout feat/<branch>` to ensure HEAD is attached.
- Or: orchestrator verifies branch ref advanced after each subagent reports DONE; if not, force-advances.
- Or: avoid concurrent subagent dispatches that touch the same git index (already mostly enforced via worktrees, but parallel worktree creation has race conditions).

**Surfaced:** Phase 1E session, 2026-04-18.
