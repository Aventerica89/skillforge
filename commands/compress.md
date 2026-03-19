---
name: compress
description: Compress plugin skills to lightweight stubs, saving ~88% context tokens per turn
allowed-tools:
  - Bash
---

Compress skills to reduce context overhead. Run with optional plugin name to target a specific plugin.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/compress.js" $ARGUMENTS
```

After compression, restart your Claude Code session for changes to take effect.
