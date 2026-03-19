#!/usr/bin/env node
/**
 * SkillForge Status — Report compression state and token savings
 *
 * Usage: node status.js [--all]
 *   --all: include disabled plugins (default: enabled only)
 */

const fs = require('fs');
const path = require('path');
const { SKILLS_FULL, STUB_MARKER, findSkillDirs } = require('./shared');

function main() {
  const allFlag = process.argv.includes('--all');
  const skillDirs = findSkillDirs(null, { enabledOnly: !allFlag });

  if (skillDirs.length === 0) {
    console.log('No plugin skills found.');
    process.exit(0);
  }

  const byPlugin = {};

  for (const { plugin, skillsDir } of skillDirs) {
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

      if (!byPlugin[plugin]) byPlugin[plugin] = [];
      byPlugin[plugin].push({
        skillName,
        compressed,
        currentTokens: tokens,
        originalTokens,
        saved: compressed ? originalTokens - tokens : 0
      });
    }
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

  if (!allFlag) {
    console.log(`(Showing enabled plugins only. Use --all for everything.)`);
  }

  if (grandCompressed === 0) {
    console.log(`\nRun /skillforge:compress to reduce context overhead.`);
  }
}

main();
