import { App, PluginSettingTab, Setting } from "obsidian";
import type VaultAuditPlugin from "./main";

export interface VaultAuditSettings {
  hiddenAttributes: string[];
}

export const DEFAULT_SETTINGS: VaultAuditSettings = {
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

    new Setting(containerEl)
      .setName("Hidden task attributes")
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
