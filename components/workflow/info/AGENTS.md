# components/workflow/info Guide

Info components should use shared hooks and data helpers.
Keep dialogs accessible and actions explicit.

## Modal styling

- Center the modal header, selection toolbar, and pagination so the layout stays consistent across info panels.
- Use `InfoCallout` for errors, loading states, and deletion failures so feedback is visible without scrolling.
- Keep destructive controls grouped together with clear confirmation flows (e.g. the purge dialog language and delete confirmation inputs).

## Role cleanup

- When deleting admin roles, unassign every role assignment first (even for soft-deleted users) before calling the Google Roles API to avoid failure.
