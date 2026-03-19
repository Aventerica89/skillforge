/**
 * SkillForge Shared — Common utilities for all scripts
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGINS_CACHE = path.join(os.homedir(), '.claude', 'plugins', 'cache');
const SKILLS_FULL = path.join(os.homedir(), '.claude', 'skills-full');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
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

function smartTruncate(desc) {
  if (!desc) return '';
  // Take first sentence (up to first period followed by space or end)
  const firstSentence = desc.match(/^[^.]+\./)?.[0] || desc;
  // If first sentence > 15 words, truncate
  const words = firstSentence.split(/\s+/);
  if (words.length > 15) {
    return words.slice(0, 15).join(' ');
  }
  return firstSentence;
}

function getEnabledPlugins() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return null;
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    const ep = settings.enabledPlugins || {};
    const enabled = new Set();
    for (const [key, val] of Object.entries(ep)) {
      if (val === true) {
        // Key format: "plugin-name@marketplace" — extract plugin name
        const pluginName = key.split('@')[0];
        enabled.add(pluginName);
      }
    }
    return enabled;
  } catch {
    return null;
  }
}

function getLatestVersion(pluginDir) {
  const versions = fs.readdirSync(pluginDir).filter(v => {
    const vPath = path.join(pluginDir, v);
    return fs.statSync(vPath).isDirectory() && !v.startsWith('.');
  });
  if (versions.length === 0) return null;
  // Sort and take last (lexicographic works for semver and hash-based versions)
  versions.sort();
  return versions[versions.length - 1];
}

function findSkillDirs(pluginFilter, { enabledOnly = true } = {}) {
  const results = [];
  if (!fs.existsSync(PLUGINS_CACHE)) return results;

  const enabledPlugins = enabledOnly ? getEnabledPlugins() : null;

  for (const marketplace of fs.readdirSync(PLUGINS_CACHE)) {
    const marketDir = path.join(PLUGINS_CACHE, marketplace);
    if (!fs.statSync(marketDir).isDirectory()) continue;
    if (marketplace.startsWith('temp_')) continue;

    for (const plugin of fs.readdirSync(marketDir)) {
      if (pluginFilter && plugin !== pluginFilter) continue;
      const pluginDir = path.join(marketDir, plugin);
      if (!fs.statSync(pluginDir).isDirectory()) continue;

      // Filter to enabled plugins only (unless --all or enabledOnly=false)
      if (enabledPlugins && !enabledPlugins.has(plugin)) continue;

      // Only use latest version
      const version = getLatestVersion(pluginDir);
      if (!version) continue;

      const skillsDir = path.join(pluginDir, version, 'skills');
      if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
        results.push({ marketplace, plugin, version, skillsDir });
      }
    }
  }

  return results;
}

function isAlreadyCompressed(content) {
  return content.includes(STUB_MARKER);
}

module.exports = {
  PLUGINS_CACHE,
  SKILLS_FULL,
  STUB_MARKER,
  parseFrontmatter,
  smartTruncate,
  getEnabledPlugins,
  findSkillDirs,
  isAlreadyCompressed,
};
