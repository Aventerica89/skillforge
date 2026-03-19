---
name: sync
description: Re-compress skills that lost stubs after plugin updates
allowed-tools:
  - Bash
---

Detect and re-compress skills whose stubs were overwritten by plugin updates.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.js" $ARGUMENTS
```

After syncing, restart your Claude Code session for changes to take effect.
