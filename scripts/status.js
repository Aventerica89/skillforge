#!/usr/bin/env node
/**
 * SkillForge Status — Report compression state and token savings
 *
 * Usage: node status.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGINS_CACHE = path.join(os.homedir(), '.claude', 'plugins', 'cache');
const SKILLS_FULL = path.join(os.homedir(), '.claude', 'skills-full');
const STUB_MARKER = 'SKILLFORGE_COMPRESSED';

function findAllSkills() {
  const results = [];

  if (!fs.existsSync(PLUGINS_CACHE)) return results;

  for (const marketplace of fs.readdirSync(PLUGINS_CACHE)) {
    const marketDir = path.join(PLUGINS_CACHE, marketplace);
    if (!fs.statSync(marketDir).isDirectory()) continue;
    if (marketplace.startsWith('temp_')) continue;

    for (const plugin of fs.readdirSync(marketDir)) {
      const pluginDir = path.join(marketDir, plugin);
      if (!fs.statSync(pluginDir).isDirectory()) continue;

      for (const version of fs.readdirSync(pluginDir)) {
        const skillsDir = path.join(pluginDir, version, 'skills');
        if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) continue;

        for (const skillName of fs.readdirSync(skillsDir)) {
          const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
          if (!fs.existsSync(skillFile)) continue;

          const content = fs.readFileSync(skillFile, 'utf-8');
          const compressed = content.includes(STUB_MARKER);
          const tokens = Math.ceil(content.length / 4);

          let originalTokens = tokens;
          if (compressed) {
            const backupFile = path.join(SKILLS_FULL, plugin, `${skillName}.md`);
            if (fs.existsSync(backupFile)) {
              originalTokens = Math.ceil(fs.readFileSync(backupFile, 'utf-8').length / 4);
            }
          }

          results.push({
            marketplace,
            plugin,
            skillName,
            compressed,
            currentTokens: tokens,
            originalTokens,
            saved: compressed ? originalTokens - tokens : 0
          });
        }
      }
    }
  }

  return results;
}

function main() {
  const skills = findAllSkills();

  if (skills.length === 0) {
    console.log('No skills found.');
    process.exit(0);
  }

  // Group by plugin
  const byPlugin = {};
  for (const s of skills) {
    if (!byPlugin[s.plugin]) byPlugin[s.plugin] = [];
    byPlugin[s.plugin].push(s);
  }

  console.log('SkillForge Status');
  console.log('='.repeat(60));

  let grandTotal = 0;
  let grandCompressed = 0;
  let grandSaved = 0;
  let grandCurrentTokens = 0;

  for (const [plugin, pluginSkills] of Object.entries(byPlugin).sort()) {
    const compressed = pluginSkills.filter(s => s.compressed).length;
    const total = pluginSkills.length;
    const saved = pluginSkills.reduce((sum, s) => sum + s.saved, 0);
    const currentTokens = pluginSkills.reduce((sum, s) => sum + s.currentTokens, 0);

    const indicator = compressed === total ? '[FULL]'
      : compressed === 0 ? '[    ]'
      : `[${Math.round(compressed / total * 100)}%]`;

    console.log(`${indicator} ${plugin}: ${compressed}/${total} compressed, ~${saved.toLocaleString()}t saved, ~${currentTokens.toLocaleString()}t current`);

    grandTotal += total;
    grandCompressed += compressed;
    grandSaved += saved;
    grandCurrentTokens += currentTokens;
  }

  console.log('='.repeat(60));
  console.log(`Total: ${grandCompressed}/${grandTotal} skills compressed`);
  console.log(`Current injection: ~${grandCurrentTokens.toLocaleString()} tokens/turn`);
  console.log(`Savings: ~${grandSaved.toLocaleString()} tokens/turn`);

  if (grandCompressed === 0) {
    console.log(`\nRun /skillforge:compress to reduce context overhead.`);
  }
}

main();
