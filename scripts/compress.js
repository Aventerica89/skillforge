#!/usr/bin/env node
/**
 * SkillForge Compress — Replace SKILL.md files with lightweight stubs
 *
 * Usage: node compress.js [plugin-name]
 *   plugin-name: optional, compress only this plugin (default: all)
 *
 * Backs up full SKILL.md to ~/.claude/skills-full/{plugin}/{skill}.md
 * Replaces with stub: short description + redirect to backup
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGINS_CACHE = path.join(os.homedir(), '.claude', 'plugins', 'cache');
const SKILLS_FULL = path.join(os.homedir(), '.claude', 'skills-full');
const STUB_MARKER = 'SKILLFORGE_COMPRESSED';

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const fm = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  }
  return fm;
}

function truncateDescription(desc, maxWords = 10) {
  if (!desc) return '';
  return desc.split(/\s+/).slice(0, maxWords).join(' ');
}

function isAlreadyCompressed(content) {
  return content.includes(STUB_MARKER);
}

function findSkillDirs(pluginFilter) {
  const results = [];

  if (!fs.existsSync(PLUGINS_CACHE)) return results;

  for (const marketplace of fs.readdirSync(PLUGINS_CACHE)) {
    const marketDir = path.join(PLUGINS_CACHE, marketplace);
    if (!fs.statSync(marketDir).isDirectory()) continue;
    if (marketplace.startsWith('temp_')) continue;

    for (const plugin of fs.readdirSync(marketDir)) {
      if (pluginFilter && plugin !== pluginFilter) continue;
      const pluginDir = path.join(marketDir, plugin);
      if (!fs.statSync(pluginDir).isDirectory()) continue;

      for (const version of fs.readdirSync(pluginDir)) {
        const skillsDir = path.join(pluginDir, version, 'skills');
        if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
          results.push({ marketplace, plugin, version, skillsDir });
        }
      }
    }
  }

  return results;
}

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
  const shortDesc = truncateDescription(fm.description);

  // Backup full content
  const backupDir = path.join(SKILLS_FULL, plugin);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `${name}.md`);
  fs.copyFileSync(skillFile, backupFile);

  // Write stub
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
  const pluginFilter = process.argv[2] || null;
  const skillDirs = findSkillDirs(pluginFilter);

  if (skillDirs.length === 0) {
    console.log(pluginFilter
      ? `No skills found for plugin "${pluginFilter}".`
      : 'No plugin skills found.');
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
