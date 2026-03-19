#!/usr/bin/env node
/**
 * SkillForge Restore — Reverse compression, restore original SKILL.md files
 *
 * Usage: node restore.js [plugin-name]
 *   plugin-name: optional, restore only this plugin (default: all)
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
  const pluginFilter = process.argv[2] || null;
  const skillDirs = findSkillDirs(pluginFilter);

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
