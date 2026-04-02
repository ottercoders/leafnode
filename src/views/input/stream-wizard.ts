import * as vscode from "vscode";

export async function runStreamWizard(
  existingConfig?: {
    name: string;
    subjects: string[];
    storage: string;
    retention: string;
    replicas: number;
  },
): Promise<
  | {
      name: string;
      subjects: string[];
      storage: string;
      retention: string;
      replicas: number;
    }
  | undefined
> {
  const isEdit = !!existingConfig;
  const titlePrefix = isEdit ? "Edit Stream" : "Create Stream";

  // Step 1: Stream name
  const name = await vscode.window.showInputBox({
    title: `${titlePrefix} (1/5)`,
    prompt: "Stream name",
    placeHolder: "e.g. ORDERS",
    value: existingConfig?.name ?? "",
    validateInput: (v) => (v.trim() ? undefined : "Name is required"),
    enabled: !isEdit,
  } as vscode.InputBoxOptions);
  if (!name) return undefined;

  // Step 2: Subjects
  const subjectsInput = await vscode.window.showInputBox({
    title: `${titlePrefix} (2/5)`,
    prompt: "Subjects (comma-separated)",
    placeHolder: "e.g. ORDERS.>",
    value: existingConfig?.subjects.join(", ") ?? "",
    validateInput: (v) =>
      v.trim() ? undefined : "At least one subject is required",
  });
  if (!subjectsInput) return undefined;
  const subjects = subjectsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Step 3: Storage
  const storageOptions = [
    { label: "file", description: "Persist to disk" },
    { label: "memory", description: "In-memory only" },
  ];
  const defaultStorage = existingConfig?.storage ?? "file";
  const sortedStorage = storageOptions.sort((a, b) => {
    if (a.label === defaultStorage) return -1;
    if (b.label === defaultStorage) return 1;
    return 0;
  });
  const storagePick = await vscode.window.showQuickPick(sortedStorage, {
    title: `${titlePrefix} (3/5)`,
    placeHolder: `Storage type${isEdit ? ` (current: ${defaultStorage})` : ""}`,
  });
  if (!storagePick) return undefined;

  // Step 4: Retention
  const retentionOptions = [
    { label: "limits", description: "Retain until limits are reached" },
    { label: "interest", description: "Retain while consumers are interested" },
    { label: "workqueue", description: "Retain until acknowledged" },
  ];
  const defaultRetention = existingConfig?.retention ?? "limits";
  const sortedRetention = retentionOptions.sort((a, b) => {
    if (a.label === defaultRetention) return -1;
    if (b.label === defaultRetention) return 1;
    return 0;
  });
  const retentionPick = await vscode.window.showQuickPick(sortedRetention, {
    title: `${titlePrefix} (4/5)`,
    placeHolder: `Retention policy${isEdit ? ` (current: ${defaultRetention})` : ""}`,
  });
  if (!retentionPick) return undefined;

  // Step 5: Replicas
  const replicasInput = await vscode.window.showInputBox({
    title: `${titlePrefix} (5/5)`,
    prompt: "Number of replicas",
    placeHolder: "1",
    value: String(existingConfig?.replicas ?? 1),
    validateInput: (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1) return "Must be a positive integer";
      return undefined;
    },
  });
  if (!replicasInput) return undefined;

  return {
    name: name.trim(),
    subjects,
    storage: storagePick.label,
    retention: retentionPick.label,
    replicas: parseInt(replicasInput, 10),
  };
}
