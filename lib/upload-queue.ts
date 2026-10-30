export type QueueStatus =
  "pending" | "uploading" | "parsing" | "done" | "error";

export interface UploadResult {
  matchId: string;
  map: string;
  rounds: number;
  players: number;
  score?: { A: number; B: number };
}

export interface QueueItem {
  id: string;
  name: string;
  size: number;
  status: QueueStatus;
  progress: number;
  message?: string;
  result?: UploadResult;
  duplicate?: boolean;
}

export class UploadFailure extends Error {
  readonly info?: { matchId?: string; duplicate?: boolean };
  constructor(
    message: string,
    info?: { matchId?: string; duplicate?: boolean },
  ) {
    super(message);
    this.name = "UploadFailure";
    this.info = info;
  }
}

export interface SendHooks {
  onProgress: (ratio: number) => void;
  onParsing: () => void;
}

export type Sender = (
  file: File,
  hooks: SendHooks,
  by: string,
) => Promise<UploadResult>;

export interface Queue {
  add: (files: ArrayLike<File>, by?: string) => void;
  clearFinished: () => void;
  items: () => QueueItem[];
}

const isDemo = (name: string) => /\.dem(\.zst|\.bz2)?$/i.test(name);

export function createUploadQueue({
  send,
  onChange,
  newId = () => crypto.randomUUID(),
}: {
  send: Sender;
  onChange: (items: QueueItem[]) => void;
  newId?: () => string;
}): Queue {
  let entries: { item: QueueItem; file: File; by: string }[] = [];
  let working = false;

  const publish = () => onChange(entries.map((entry) => entry.item));

  const patch = (id: string, next: Partial<QueueItem>) => {
    entries = entries.map((entry) =>
      entry.item.id === id
        ? { ...entry, item: { ...entry.item, ...next } }
        : entry,
    );
    publish();
  };

  async function processOne(entry: {
    item: QueueItem;
    file: File;
    by: string;
  }) {
    const { id } = entry.item;
    patch(id, { status: "uploading", progress: 0, message: undefined });
    try {
      const result = await send(
        entry.file,
        {
          onProgress: (ratio) =>
            patch(id, { progress: Math.min(Math.max(ratio, 0), 1) }),
          onParsing: () => patch(id, { status: "parsing", progress: 1 }),
        },
        entry.by,
      );
      patch(id, { status: "done", progress: 1, result });
    } catch (error) {
      const failure = error instanceof UploadFailure ? error : null;
      patch(id, {
        status: "error",
        message: error instanceof Error ? error.message : "Falha no envio",
        duplicate: failure?.info?.duplicate === true,
        result: failure?.info?.matchId
          ? ({
              matchId: failure.info.matchId,
              map: "",
              rounds: 0,
              players: 0,
            } as UploadResult)
          : undefined,
      });
    }
  }

  async function drain() {
    if (working) return;
    working = true;
    try {
      for (;;) {
        const next = entries.find((entry) => entry.item.status === "pending");
        if (!next) break;

        await processOne(next);
      }
    } finally {
      working = false;
    }
  }

  return {
    add(files, by = "") {
      const all = Array.from(files as ArrayLike<File>);
      const accepted = all
        .filter((file) => isDemo(file.name))
        .sort((a, b) => a.name.localeCompare(b.name));

      const rejected = all.length - accepted.length;

      entries = [
        ...entries,
        ...accepted.map((file) => ({
          file,
          by,
          item: {
            id: newId(),
            name: file.name,
            size: file.size,
            status: "pending" as QueueStatus,
            progress: 0,
          },
        })),
      ];

      if (rejected > 0) {
        entries = [
          ...entries,
          {
            file: new File([], "ignorados"),
            by,
            item: {
              id: newId(),
              name: `${rejected} arquivo${rejected === 1 ? "" : "s"} ignorado${rejected === 1 ? "" : "s"}`,
              size: 0,
              status: "error" as QueueStatus,
              progress: 0,
              message: "Só arquivos .dem, .dem.zst ou .dem.bz2 são aceitos",
            },
          },
        ];
      }

      publish();
      void drain();
    },

    clearFinished() {
      entries = entries.filter(
        (entry) =>
          entry.item.status !== "done" && entry.item.status !== "error",
      );
      publish();
    },

    items: () => entries.map((entry) => entry.item),
  };
}
