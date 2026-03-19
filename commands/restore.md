---
name: restore
description: Restore compressed skills to their original full content
allowed-tools:
  - Bash
---

Restore skills from the SkillForge vault back to their original full SKILL.md content.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/restore.js" $ARGUMENTS
```

After restoration, restart your Claude Code session for changes to take effect.
