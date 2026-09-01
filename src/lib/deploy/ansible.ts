/**
 * Ansible artifact generation for file-based config distribution (requirement 5.1
 * — File sync / Ansible + controlled restart). Pure string builders so they are
 * unit-testable; execution happens on the operator's side with these artifacts.
 */

export type AnsibleFile = { filename: string; dest: string };

/** Build an inventory file targeting the Trino cluster hosts. */
export function generateInventory(hosts: readonly string[]): string {
  const lines = ["[trino]", ...hosts.map((h) => h.trim()).filter(Boolean)];
  return `${lines.join("\n")}\n`;
}

/**
 * Build a playbook that copies each config file to every node and, when
 * `restart` is set, performs a controlled rolling restart; otherwise it relies on
 * Trino's `security.refresh-period` hot-reload (no restart).
 */
export function generatePlaybook(files: readonly AnsibleFile[], opts: { restart: boolean }): string {
  const copyTasks = files
    .map((f) =>
      [
        `    - name: Copy ${f.filename}`,
        `      ansible.builtin.copy:`,
        `        src: files/${f.filename}`,
        `        dest: ${f.dest}`,
        `        mode: "0640"`,
        `      notify: ${opts.restart ? "restart trino" : "reload note"}`,
      ].join("\n"),
    )
    .join("\n");

  const handler = opts.restart
    ? [
        "  handlers:",
        "    - name: restart trino",
        "      ansible.builtin.service:",
        "        name: trino",
        "        state: restarted",
      ].join("\n")
    : [
        "  handlers:",
        "    - name: reload note",
        "      ansible.builtin.debug:",
        '        msg: "Config copied; Trino will hot-reload within security.refresh-period."',
      ].join("\n");

  return [
    "---",
    "- name: Deploy Trino security configuration (NİZAM)",
    "  hosts: trino",
    "  become: true",
    "  serial: 1",
    "  tasks:",
    copyTasks,
    handler,
    "",
  ].join("\n");
}

export type ExpectedFile = { dest: string; sha256: string };

/**
 * Build a playbook that verifies each managed config file is byte-identical on
 * every node (requirement 5.3 — "tüm sunucularda eşit olduğunun kontrolü"). Each
 * node computes the file's SHA-256 and the play fails if it differs from the
 * app's expected hash, surfacing any drifted node.
 */
export function generateVerifyPlaybook(files: readonly ExpectedFile[]): string {
  const checks = files
    .map((f) =>
      [
        `    - name: Hash ${f.dest}`,
        `      ansible.builtin.stat:`,
        `        path: ${f.dest}`,
        `        checksum_algorithm: sha256`,
        `      register: stat_${hashVar(f.dest)}`,
        `    - name: Assert ${f.dest} matches the published version`,
        `      ansible.builtin.assert:`,
        `        that: stat_${hashVar(f.dest)}.stat.exists and stat_${hashVar(f.dest)}.stat.checksum == "${f.sha256}"`,
        `        fail_msg: "${f.dest} bu node'da farklı/eksik — yeniden dağıtım gerekir."`,
        `        success_msg: "${f.dest} eşleşiyor."`,
      ].join("\n"),
    )
    .join("\n");

  return [
    "---",
    "- name: Verify Trino security configuration consistency (NİZAM)",
    "  hosts: trino",
    "  become: true",
    "  tasks:",
    checks,
    "",
  ].join("\n");
}

/** Safe Ansible variable suffix from a file path. */
function hashVar(dest: string): string {
  return dest.replace(/[^a-zA-Z0-9]/g, "_");
}
