export type InstallOsChoice = "windows" | "linux";

export type InstallCommandRequest = {
  facilityId: number | string;
  workGroupId?: number | string | null;
  os: InstallOsChoice;
};

export type InstallCommandResult =
  | { ok: true; command: string; created: boolean; scopeLabel: string }
  | { ok: false; error: string };

export type RevokeInstallCommandResult = { ok: boolean; message: string };

export type InstallCommandAction = (input: InstallCommandRequest) => Promise<InstallCommandResult>;
