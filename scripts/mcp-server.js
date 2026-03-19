#!/usr/bin/env node
/**
 * SkillForge MCP Server — Provides load_skill tool for on-demand skill loading
 *
 * stdio MCP server that reads full skill content from ~/.claude/skills-full/
 * when Claude needs the complete skill instructions.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const SKILLS_FULL = path.join(os.homedir(), '.claude', 'skills-full');

// JSON-RPC helpers
function jsonRpcResponse(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function jsonRpcError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

// Find a skill by name across all plugin backups
function findSkill(name) {
  if (!fs.existsSync(SKILLS_FULL)) return null;

  for (const plugin of fs.readdirSync(SKILLS_FULL)) {
    const pluginDir = path.join(SKILLS_FULL, plugin);
    if (!fs.statSync(pluginDir).isDirectory()) continue;

    const skillFile = path.join(pluginDir, `${name}.md`);
    if (fs.existsSync(skillFile)) {
      return { plugin, path: skillFile, content: fs.readFileSync(skillFile, 'utf-8') };
    }
  }

  return null;
}

// List all available skills
function listSkills() {
  const skills = [];
  if (!fs.existsSync(SKILLS_FULL)) return skills;

  for (const plugin of fs.readdirSync(SKILLS_FULL)) {
    const pluginDir = path.join(SKILLS_FULL, plugin);
    if (!fs.statSync(pluginDir).isDirectory()) continue;

    for (const file of fs.readdirSync(pluginDir)) {
      if (file.endsWith('.md')) {
        skills.push({ name: file.replace('.md', ''), plugin });
      }
    }
  }

  return skills;
}

// Handle MCP protocol messages
function handleMessage(msg) {
  const { method, id, params } = msg;

  switch (method) {
    case 'initialize':
      return jsonRpcResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'skillforge', version: '1.0.0' }
      });

    case 'notifications/initialized':
      return null; // No response needed

    case 'tools/list':
      return jsonRpcResponse(id, {
        tools: [
          {
            name: 'load_skill',
            description: 'Load the full content of a compressed skill by name. Use when a skill stub says to load the full content.',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The skill name (e.g., "investor-outreach", "swift-concurrency-6-2")'
                }
              },
              required: ['name']
            }
          },
          {
            name: 'list_skills',
            description: 'List all skills available in the SkillForge vault with their plugin source.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      });

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName === 'load_skill') {
        const skill = findSkill(args.name);
        if (!skill) {
          return jsonRpcResponse(id, {
            content: [{ type: 'text', text: `Skill "${args.name}" not found in vault. Run /skillforge:status to see available skills.` }],
            isError: true
          });
        }
        return jsonRpcResponse(id, {
          content: [{ type: 'text', text: skill.content }]
        });
      }

      if (toolName === 'list_skills') {
        const skills = listSkills();
        if (skills.length === 0) {
          return jsonRpcResponse(id, {
            content: [{ type: 'text', text: 'No compressed skills in vault. Run /skillforge:compress to get started.' }]
          });
        }
        const table = skills.map(s => `${s.plugin}:${s.name}`).join('\n');
        return jsonRpcResponse(id, {
          content: [{ type: 'text', text: `${skills.length} skills in vault:\n${table}` }]
        });
      }

      return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
    }

    default:
      if (id) return jsonRpcError(id, -32601, `Method not found: ${method}`);
      return null;
  }
}

// stdio transport
const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    const response = handleMessage(msg);
    if (response) {
      process.stdout.write(response + '\n');
    }
  } catch (err) {
    process.stderr.write(`SkillForge MCP error: ${err.message}\n`);
  }
});
