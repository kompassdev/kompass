import type * as Rift from "rift-snapshot";

export type RiftBackend = Pick<typeof Rift, "init" | "create" | "list" | "ancestors"> & {
  remove(options?: Rift.RemoveOptions & { all?: false }): void;
};

export function loadRift(): Promise<RiftBackend> {
  return import("rift-snapshot");
}

export function createRiftSnapshot(
  rift: Pick<RiftBackend, "init" | "create">,
  options: Rift.CreateOptions,
) {
  rift.init({ at: options.from });
  // Keep dependencies and working-tree state. On APFS this uses the full clone path.
  return rift.create({ ...options, copyAll: true });
}
