import * as vscode from "vscode";

export async function runConsumerWizard(
  stream: string,
): Promise<
  | {
      name: string;
      filterSubject?: string;
      ackPolicy: string;
      deliverPolicy: string;
    }
  | undefined
> {
  // Step 1: Consumer name
  const name = await vscode.window.showInputBox({
    title: `Create Consumer on "${stream}" (1/4)`,
    prompt: "Consumer name (durable)",
    placeHolder: "e.g. my-consumer",
    validateInput: (v) => (v.trim() ? undefined : "Name is required"),
  });
  if (!name) return undefined;

  // Step 2: Filter subject (optional)
  const filterSubject = await vscode.window.showInputBox({
    title: `Create Consumer on "${stream}" (2/4)`,
    prompt: "Filter subject (optional, press Enter to skip)",
    placeHolder: "e.g. ORDERS.>",
  });
  if (filterSubject === undefined) return undefined;

  // Step 3: Ack policy
  const ackPick = await vscode.window.showQuickPick(
    [
      { label: "explicit", description: "Each message must be explicitly acknowledged" },
      { label: "none", description: "No acknowledgment required" },
      { label: "all", description: "Acknowledging a message acknowledges all below it" },
    ],
    {
      title: `Create Consumer on "${stream}" (3/4)`,
      placeHolder: "Ack policy",
    },
  );
  if (!ackPick) return undefined;

  // Step 4: Deliver policy
  const deliverPick = await vscode.window.showQuickPick(
    [
      { label: "all", description: "Deliver all available messages" },
      { label: "last", description: "Deliver starting with the last message" },
      { label: "new", description: "Deliver only new messages" },
      { label: "last_per_subject", description: "Deliver the last message for each subject" },
    ],
    {
      title: `Create Consumer on "${stream}" (4/4)`,
      placeHolder: "Deliver policy",
    },
  );
  if (!deliverPick) return undefined;

  return {
    name: name.trim(),
    filterSubject: filterSubject.trim() || undefined,
    ackPolicy: ackPick.label,
    deliverPolicy: deliverPick.label,
  };
}
