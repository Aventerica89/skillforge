#!/usr/bin/env node
/**
 * SkillForge Compress — Replace SKILL.md files with lightweight stubs
 *
 * Usage: node compress.js [plugin-name] [--all]
 *   plugin-name: optional, compress only this plugin
 *   --all: compress all plugins including disabled (default: enabled only)
 */

const fs = require('fs');
const path = require('path');
const { SKILLS_FULL, STUB_MARKER, parseFrontmatter, smartTruncate, findSkillDirs, isAlreadyCompressed } = require('./shared');

function compressSkill(skillFile, plugin, skillName) {
  const content = fs.readFileSync(skillFile, 'utf-8');

  if (isAlreadyCompressed(content)) {
    return { status: 'skipped', reason: 'already compressed' };
  }

  const fm = parseFrontmatter(content);
  if (!fm) {
    return { status: 'skipped', reason: 'no frontmatter' };
  }

  const name = fm.name || skillName;
  const shortDesc = smartTruncate(fm.description);

  const backupDir = path.join(SKILLS_FULL, plugin);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `${name}.md`);
  fs.copyFileSync(skillFile, backupFile);

  const stub = `---
name: ${name}
description: ${shortDesc}
---
<!-- ${STUB_MARKER} -->

IMPORTANT: Read the full skill before proceeding:
${backupFile}
`;

  fs.writeFileSync(skillFile, stub);

  const originalTokens = Math.ceil(content.length / 4);
  const stubTokens = Math.ceil(stub.length / 4);

  return {
    status: 'compressed',
    name,
    originalTokens,
    stubTokens,
    saved: originalTokens - stubTokens
  };
}

function main() {
  const args = process.argv.slice(2);
  const allFlag = args.includes('--all');
  const pluginFilter = args.find(a => !a.startsWith('--')) || null;

  const skillDirs = findSkillDirs(pluginFilter, { enabledOnly: !allFlag });

  if (skillDirs.length === 0) {
    console.log(pluginFilter
      ? `No skills found for plugin "${pluginFilter}".`
      : 'No plugin skills found. (Use --all to include disabled plugins)');
    process.exit(0);
  }

  let totalCompressed = 0;
  let totalSkipped = 0;
  let totalTokensSaved = 0;

  for (const { plugin, skillsDir } of skillDirs) {
    const skills = fs.readdirSync(skillsDir).filter(d => {
      const skillPath = path.join(skillsDir, d, 'SKILL.md');
      return fs.existsSync(skillPath);
    });

    if (skills.length === 0) continue;

    console.log(`\n${plugin} (${skills.length} skills)`);

    for (const skillName of skills) {
      const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
      const result = compressSkill(skillFile, plugin, skillName);

      if (result.status === 'compressed') {
        console.log(`  OK: ${result.name} (saved ~${result.saved} tokens)`);
        totalCompressed++;
        totalTokensSaved += result.saved;
      } else {
        console.log(`  SKIP: ${skillName} (${result.reason})`);
        totalSkipped++;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Compressed: ${totalCompressed} skills`);
  console.log(`Skipped: ${totalSkipped} skills`);
  console.log(`Estimated savings: ~${totalTokensSaved.toLocaleString()} tokens/turn`);
  console.log(`Restart Claude Code session to apply.`);
}

main();
