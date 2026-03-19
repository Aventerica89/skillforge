# SkillForge

Deferred skill loading for Claude Code. Compress skills to stubs, load full content on demand.

**Problem:** Claude Code injects every skill's description into every system prompt turn. With 60+ skills, that's ~18k tokens of descriptions repeated on every message — context you're paying for but rarely using.

**Solution:** Replace verbose SKILL.md files with lightweight stubs (~35 tokens each). Full content loads only when a skill is actually invoked.

## How It Works

When a compressed skill is invoked, Claude sees just this:

```
<!-- SKILLFORGE_COMPRESSED -->

IMPORTANT: Read the full skill before proceeding:
/Users/you/.claude/skills-full/everything-claude-code/api-design.md
```

That's 3-4 lines instead of the full 524-line skill. Claude reads the stub, follows the redirect, and loads the complete content on demand. One extra Read call per invocation — but since most turns trigger 0-1 skills, the savings are massive.

## Token Economics

| Metric | Before | After |
|--------|--------|-------|
| Per-skill description | ~300 tokens | ~35 tokens |
| 60 skills total | ~18,000 tokens/turn | ~2,100 tokens/turn |
| 30-turn session | ~540,000 tokens wasted | ~63,000 tokens |
| **Savings** | — | **~88% reduction** |

## Install

```
/plugin
# Navigate to Marketplaces > jb-claude-plugins > Browse > skillforge
# Or if you have the marketplace: /plugin install skillforge@jb-claude-plugins
```

## Usage

```bash
# See what's installed and compression status
/skillforge:status

# Compress all plugins
/skillforge:compress

# Compress a specific plugin
/skillforge:compress everything-claude-code

# Restore originals
/skillforge:restore

# Restore a specific plugin
/skillforge:restore everything-claude-code
```

Restart your Claude Code session after compress/restore for changes to take effect.

## MCP Tools

SkillForge also provides an MCP server with two tools:

- **`load_skill(name)`** — Load full content of a compressed skill by name
- **`list_skills()`** — List all skills in the SkillForge vault

## Important Notes

- **Restart required** after compress/restore (skill cache is per-session)
- **Disable auto-update** for compressed plugins — updates overwrite stubs
- **Backups are safe** — stored in `~/.claude/skills-full/`, outside the plugin cache
- **Idempotent** — running compress twice skips already-compressed skills
- **Non-destructive** — restore brings back the original files from backup

## Why This Exists

Claude Code's skill system injects all skill descriptions into the system prompt on every turn. There's no lazy-loading mechanism for skills (unlike deferred tools, which already support this pattern). We filed [anthropics/claude-code#36023](https://github.com/anthropics/claude-code/issues/36023) requesting native deferred skill loading. SkillForge is the workaround until that ships.

## License

MIT
