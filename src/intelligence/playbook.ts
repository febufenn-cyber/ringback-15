import type { PlaybookNode, PlaybookVersion } from "./types.js";

function targets(node: PlaybookNode): string[] {
  const values: string[] = [];
  if (node.next) values.push(node.next);
  if (node.branches) values.push(...Object.values(node.branches));
  return values;
}

export function validatePlaybook(playbook: PlaybookVersion): void {
  if (playbook.status === "approved" && !playbook.approvedAt) throw new Error("approved_playbook_missing_timestamp");
  const map = new Map(playbook.nodes.map((node) => [node.id, node]));
  if (map.size !== playbook.nodes.length) throw new Error("duplicate_node_id");
  if (!map.has(playbook.startNodeId)) throw new Error("start_node_missing");
  for (const node of playbook.nodes) {
    if ((node.kind === "ask" || node.kind === "classify") && (!node.promptKey || !node.field)) throw new Error(`node_missing_prompt_or_field:${node.id}`);
    if (node.kind === "classify" && (!node.allowedValues || node.allowedValues.length < 2)) throw new Error(`classification_requires_labels:${node.id}`);
    if ((node.kind === "complete" || node.kind === "handoff") && targets(node).length) throw new Error(`terminal_node_has_target:${node.id}`);
    for (const target of targets(node)) if (!map.has(target)) throw new Error(`unknown_target:${node.id}:${target}`);
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  const walk = (id: string): void => {
    if (active.has(id)) throw new Error(`playbook_cycle:${id}`);
    if (visited.has(id)) return;
    active.add(id);
    for (const target of targets(map.get(id)!)) walk(target);
    active.delete(id);
    visited.add(id);
  };
  walk(playbook.startNodeId);
  if (visited.size !== playbook.nodes.length) throw new Error("unreachable_nodes");
  for (const [locale, pack] of Object.entries(playbook.locales)) {
    if (!locale.trim()) throw new Error("empty_locale");
    for (const node of playbook.nodes) if (node.promptKey && !pack[node.promptKey]) throw new Error(`missing_prompt:${locale}:${node.promptKey}`);
  }
}

export function nodeById(playbook: PlaybookVersion, id: string): PlaybookNode {
  const node = playbook.nodes.find((item) => item.id === id);
  if (!node) throw new Error("playbook_node_not_found");
  return node;
}

export function promptFor(playbook: PlaybookVersion, locale: string, key: string): string {
  const pack = playbook.locales[locale] ?? playbook.locales.en;
  const prompt = pack?.[key];
  if (!prompt) throw new Error(`prompt_not_found:${locale}:${key}`);
  return prompt;
}
