<h1 align="center">vault-audit</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://obsidian.md"><img src="https://img.shields.io/badge/Obsidian-plugin-7c3aed.svg" alt="Obsidian"></a>
</p>

> Batch-audit and fix vault metadata in a single command.

> **Note:** This plugin is built for personal use.

---

## Overview

Vault Audit is an Obsidian plugin that scans your entire vault and applies a set of configurable cleanup rules to frontmatter and task lines. Run the "Audit vault metadata" command to fix inconsistencies across all your notes at once.

## Features

- **Prev/next link pairing** -- If note A links `next` to B but B is missing the reciprocal `prev` back to A (or vice versa), the missing field is automatically added.
- **YAML array normalization** -- Converts multiline YAML arrays (`- item` per line) into single-line format (`[item1, item2]`). Single-item arrays are collapsed to a bare scalar.
- **Task attribute hiding** -- Wraps specified Dataview inline fields on task lines (e.g. `[id:: ...]`) with `%%` comment markers so they remain parseable but invisible in reading view.

Each rule can be individually toggled on or off in settings. The list of hidden attributes is configurable.

## Usage

### Installation

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Open BRAT settings and select **Add Beta plugin**.
2. Enter `darrenkuro/obsidian-vault-audit` as the repository.

### Running

Open the command palette and run **Vault Audit: Audit vault metadata**. A notice will report how many changes were made.

---

## License

[MIT](LICENSE) - Darren Kuro
