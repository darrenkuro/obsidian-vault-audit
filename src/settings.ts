import { App, PluginSettingTab, Setting } from "obsidian";
import type VaultAuditPlugin from "./main";

export interface VaultAuditSettings {
  rules: {
    pairPrevNext: boolean;
    normalizeArrays: boolean;
    hideTaskAttributes: boolean;
  };
  hiddenAttributes: string[];
}

export const DEFAULT_SETTINGS: VaultAuditSettings = {
  rules: {
    pairPrevNext: true,
    normalizeArrays: true,
    hideTaskAttributes: true,
  },
  hiddenAttributes: ["id", "dependsOn", "created"],
};

export class VaultAuditSettingTab extends PluginSettingTab {
  plugin: VaultAuditPlugin;

  constructor(app: App, plugin: VaultAuditPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Vault audit" });

    // --- Rules ---

    new Setting(containerEl).setName("Audit rules").setHeading();

    new Setting(containerEl)
      .setName("Pair prev/next links")
      .setDesc(
        "If file A has next → B but B lacks prev → A, add the missing link"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rules.pairPrevNext)
          .onChange(async (value) => {
            this.plugin.settings.rules.pairPrevNext = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Normalize multiline arrays")
      .setDesc(
        'Convert YAML "- item" arrays to single-line ["item1", "item2"] format'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rules.normalizeArrays)
          .onChange(async (value) => {
            this.plugin.settings.rules.normalizeArrays = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hide task inline attributes")
      .setDesc("Wrap specified inline fields on task lines with %% comments")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rules.hideTaskAttributes)
          .onChange(async (value) => {
            this.plugin.settings.rules.hideTaskAttributes = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Attribute list (only relevant when hide rule is on) ---

    new Setting(containerEl).setName("Configuration").setHeading();

    new Setting(containerEl)
      .setName("Hidden attributes")
      .setDesc("Inline field names to wrap in %% comments (one per line)")
      .addTextArea((text) =>
        text
          .setPlaceholder("id\ndependsOn\ncreated")
          .setValue(this.plugin.settings.hiddenAttributes.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.hiddenAttributes = value
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          })
      );
  }
}
