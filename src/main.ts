import { Notice, Plugin } from "obsidian";
import {
  DEFAULT_SETTINGS,
  VaultAuditSettings,
  VaultAuditSettingTab,
} from "./settings";

// --- Pure helpers ---

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractLinkTarget = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const match = value.match(/\[\[(.*?)\]\]/);
  return match ? match[1] : undefined;
};

/**
 * Convert multiline YAML arrays to single-line format inside frontmatter.
 *
 * ```yaml
 * field:
 *   - "[[A]]"
 *   - "[[B]]"
 * ```
 * becomes `field: ["[[A]]", "[[B]]"]`
 *
 * Single-item arrays become scalars: `field: "[[A]]"`
 * Empty arrays stay as `field:`
 */
const normalizeArraysInFrontmatter = (
  content: string
): { content: string; changed: boolean; count: number } => {
  const fmMatch = content.match(/^(---\n)([\s\S]*?)(\n---)/);
  if (!fmMatch) return { content, changed: false, count: 0 };

  const prefix = fmMatch[1];
  const fm = fmMatch[2];
  const suffix = fmMatch[3];

  const lines = fm.split("\n");
  const result: string[] = [];
  let changed = false;
  let count = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Field key with no inline value → potential multiline array
    const fieldMatch = line.match(/^([\w][\w-]*):\s*$/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      const items: string[] = [];
      let j = i + 1;

      while (j < lines.length && /^\s+-/.test(lines[j])) {
        const itemMatch = lines[j].match(/^\s+-\s*(.*)/);
        if (itemMatch) {
          const value = itemMatch[1].trim();
          if (value && value !== '"[[]]"' && value !== "[[]]") {
            items.push(value);
          }
        }
        j++;
      }

      if (j > i + 1) {
        // Consumed array items → was a multiline array
        changed = true;
        count++;
        if (items.length === 0) {
          result.push(`${fieldName}:`);
        } else if (items.length === 1) {
          result.push(`${fieldName}: ${items[0]}`);
        } else {
          result.push(`${fieldName}: [${items.join(", ")}]`);
        }
        i = j;
      } else {
        result.push(line);
        i++;
      }
    } else {
      result.push(line);
      i++;
    }
  }

  if (!changed) return { content, changed: false, count: 0 };

  const newFm = result.join("\n");
  return { content: prefix + newFm + suffix, changed: true, count };
};

/** Add a YAML field to frontmatter if it doesn't already exist. */
const addFrontmatterField = (
  content: string,
  field: string,
  value: string
): string => {
  const fmMatch = content.match(/^(---\n)([\s\S]*?)(\n---)/);
  if (!fmMatch) return content;

  const fm = fmMatch[2];
  const fieldRegex = new RegExp(`^${escapeRegex(field)}:`, "m");
  if (fieldRegex.test(fm)) return content;

  return fmMatch[1] + fm + `\n${field}: ${value}` + fmMatch[3];
};

/**
 * Wrap specified inline fields on a task line with %% comments.
 * Skips fields that are already inside %% blocks.
 */
const hideTaskAttributes = (line: string, hiddenAttrs: string[]): string => {
  let result = line;
  for (const attr of hiddenAttrs) {
    if (result.includes(`%%[${attr}::`)) continue;

    const regex = new RegExp(`\\[${escapeRegex(attr)}::[^\\]]*\\]`, "g");
    result = result.replace(regex, (match) => `%%${match}%%`);
  }
  return result;
};

// --- Plugin ---

export default class VaultAuditPlugin extends Plugin {
  settings: VaultAuditSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VaultAuditSettingTab(this.app, this));

    this.addCommand({
      id: "audit-vault-metadata",
      name: "Audit vault metadata",
      callback: () => this.runAudit(),
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async runAudit() {
    const files = this.app.vault.getMarkdownFiles();
    const stats = { prevNext: 0, arrays: 0, fields: 0, attrs: 0 };

    // --- Phase 1: build prev/next map from metadata cache ---
    const prevNextMap = new Map<
      string,
      { prev?: string; next?: string }
    >();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (!fm) continue;

      const prev = extractLinkTarget(fm.prev);
      const next = extractLinkTarget(fm.next);
      if (prev || next) {
        prevNextMap.set(file.basename, { prev, next });
      }
    }

    // --- Phase 2: determine missing prev/next links ---
    const fixes = new Map<string, { addPrev?: string; addNext?: string }>();

    for (const [basename, links] of prevNextMap) {
      if (links.next) {
        const target = prevNextMap.get(links.next);
        if (!target || target.prev !== basename) {
          // Target file exists but doesn't point back
          const targetFile = files.find((f) => f.basename === links.next);
          if (targetFile) {
            const existing = fixes.get(links.next) ?? {};
            existing.addPrev = basename;
            fixes.set(links.next, existing);
          }
        }
      }
      if (links.prev) {
        const target = prevNextMap.get(links.prev);
        if (!target || target.next !== basename) {
          const targetFile = files.find((f) => f.basename === links.prev);
          if (targetFile) {
            const existing = fixes.get(links.prev) ?? {};
            existing.addNext = basename;
            fixes.set(links.prev, existing);
          }
        }
      }
    }

    // --- Phase 3: process every file in one vault.process() each ---
    const hiddenAttrs = this.settings.hiddenAttributes;

    for (const file of files) {
      const fileFixes = fixes.get(file.basename);

      await this.app.vault.process(file, (content) => {
        let modified = content;

        // 1. Normalize multiline arrays
        const arrayResult = normalizeArraysInFrontmatter(modified);
        if (arrayResult.changed) {
          modified = arrayResult.content;
          stats.arrays++;
          stats.fields += arrayResult.count;
        }

        // 2. Add missing prev/next
        if (fileFixes) {
          if (fileFixes.addPrev) {
            modified = addFrontmatterField(
              modified,
              "prev",
              `"[[${fileFixes.addPrev}]]"`
            );
            stats.prevNext++;
          }
          if (fileFixes.addNext) {
            modified = addFrontmatterField(
              modified,
              "next",
              `"[[${fileFixes.addNext}]]"`
            );
            stats.prevNext++;
          }
        }

        // 3. Hide task inline attributes
        if (hiddenAttrs.length > 0) {
          const lines = modified.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (/^\s*- \[.\]/.test(lines[i])) {
              const newLine = hideTaskAttributes(lines[i], hiddenAttrs);
              if (newLine !== lines[i]) {
                lines[i] = newLine;
                stats.attrs++;
              }
            }
          }
          modified = lines.join("\n");
        }

        return modified;
      });
    }

    new Notice(
      `Audit done: ${stats.prevNext} prev/next, ${stats.arrays} files (${stats.fields} fields) normalized, ${stats.attrs} attrs hidden`
    );
  }
}
