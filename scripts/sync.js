#!/usr/bin/env node
/**
 * SkillForge Sync — Re-compress skills that lost their stubs after plugin updates
 *
 * Usage: node sync.js [plugin-name]
 *   Detects skills with backups in ~/.claude/skills-full/ but no SKILLFORGE_COMPRESSED
 *   marker in the active SKILL.md (meaning a plugin update overwrote the stub).
 *   Re-compresses just those skills.
 */

const fs = require('fs');
const path = require('path');
const { SKILLS_FULL, STUB_MARKER, parseFrontmatter, smartTruncate, findSkillDirs } = require('./shared');

function main() {
  const pluginFilter = process.argv[2] || null;
  const skillDirs = findSkillDirs(pluginFilter);

  if (!fs.existsSync(SKILLS_FULL)) {
    console.log('No SkillForge vault found. Run /skillforge:compress first.');
    process.exit(0);
  }

  let totalSynced = 0;
  let totalUpToDate = 0;

  for (const { plugin, skillsDir } of skillDirs) {
    const backupDir = path.join(SKILLS_FULL, plugin);
    if (!fs.existsSync(backupDir)) continue;

    const backedUpSkills = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));

    let pluginHadChanges = false;

    for (const skillName of backedUpSkills) {
      // Find the skill directory in the active plugin
      const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;

      const content = fs.readFileSync(skillFile, 'utf-8');

      if (content.includes(STUB_MARKER)) {
        totalUpToDate++;
        continue;
      }

      // Skill has a backup but lost its stub — re-compress
      if (!pluginHadChanges) {
        console.log(`\n${plugin}`);
        pluginHadChanges = true;
      }

      // Update the backup with the new content (plugin update may have improved the skill)
      const backupFile = path.join(backupDir, `${skillName}.md`);
      fs.copyFileSync(skillFile, backupFile);

      // Parse and create new stub
      const fm = parseFrontmatter(content);
      const name = fm?.name || skillName;
      const shortDesc = smartTruncate(fm?.description);

      const stub = `---
name: ${name}
description: ${shortDesc}
---
<!-- ${STUB_MARKER} -->

IMPORTANT: Read the full skill before proceeding:
${backupFile}
`;

      fs.writeFileSync(skillFile, stub);
      console.log(`  SYNCED: ${name}`);
      totalSynced++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  if (totalSynced > 0) {
    console.log(`Re-compressed: ${totalSynced} skills (plugin updates detected)`);
    console.log(`Restart Claude Code session to apply.`);
  } else {
    console.log(`All ${totalUpToDate} compressed skills are up to date.`);
  }
}

main();
