#!/usr/bin/env node
/**
 * SkillForge Restore — Reverse compression, restore original SKILL.md files
 *
 * Usage: node restore.js [plugin-name] [--all]
 *   plugin-name: optional, restore only this plugin
 *   --all: include disabled plugins (default: enabled only)
 */

const fs = require('fs');
const path = require('path');
const { SKILLS_FULL, STUB_MARKER, parseFrontmatter, findSkillDirs } = require('./shared');

function restoreSkill(skillFile, plugin, skillName) {
  const content = fs.readFileSync(skillFile, 'utf-8');

  if (!content.includes(STUB_MARKER)) {
    return { status: 'skipped', reason: 'not compressed' };
  }

  const fm = parseFrontmatter(content);
  const name = fm?.name || skillName;

  const backupFile = path.join(SKILLS_FULL, plugin, `${name}.md`);

  if (!fs.existsSync(backupFile)) {
    return { status: 'error', reason: `backup not found: ${backupFile}` };
  }

  fs.copyFileSync(backupFile, skillFile);

  return { status: 'restored', name };
}

function main() {
  const args = process.argv.slice(2);
  const allFlag = args.includes('--all');
  const pluginFilter = args.find(a => !a.startsWith('--')) || null;

  const skillDirs = findSkillDirs(pluginFilter, { enabledOnly: !allFlag });

  if (skillDirs.length === 0) {
    console.log('No plugin skills found.');
    process.exit(0);
  }

  let totalRestored = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const { plugin, skillsDir } of skillDirs) {
    const skills = fs.readdirSync(skillsDir).filter(d => {
      const skillPath = path.join(skillsDir, d, 'SKILL.md');
      return fs.existsSync(skillPath);
    });

    if (skills.length === 0) continue;

    let pluginHadChanges = false;

    for (const skillName of skills) {
      const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
      const result = restoreSkill(skillFile, plugin, skillName);

      if (result.status === 'restored') {
        if (!pluginHadChanges) {
          console.log(`\n${plugin}`);
          pluginHadChanges = true;
        }
        console.log(`  RESTORED: ${result.name}`);
        totalRestored++;
      } else if (result.status === 'error') {
        if (!pluginHadChanges) {
          console.log(`\n${plugin}`);
          pluginHadChanges = true;
        }
        console.log(`  ERROR: ${skillName} — ${result.reason}`);
        totalErrors++;
      } else {
        totalSkipped++;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Restored: ${totalRestored} skills`);
  if (totalErrors > 0) console.log(`Errors: ${totalErrors}`);
  console.log(`Skipped: ${totalSkipped} (not compressed)`);
  if (totalRestored > 0) console.log(`Restart Claude Code session to apply.`);
}

main();
