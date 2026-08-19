import type { BrowserApiHandler } from "./types.js";
import { completed, toJson } from "./json.js";
import { paramsOf } from "./parameters.js";

type ReadingListApi = {
  query: (query: Record<string, unknown>) => Promise<unknown>;
  addEntry: (entry: Record<string, unknown>) => Promise<void>;
  updateEntry: (entry: Record<string, unknown>) => Promise<void>;
  removeEntry: (entry: { url: string }) => Promise<void>;
};

const readingListApi = () => (chrome as unknown as { readingList: ReadingListApi }).readingList;

export const handleReadingListAction: BrowserApiHandler = async (request) => {
  const params = paramsOf(request);
  switch (request.action) {
    case "listReadingList":
      return toJson(await readingListApi().query((params.query || params) as Record<string, unknown>));
    case "addReadingListEntry":
      await readingListApi().addEntry((params.entry || params) as Record<string, unknown>);
      return completed();
    case "updateReadingListEntry":
      await readingListApi().updateEntry((params.entry || params) as Record<string, unknown>);
      return completed();
    case "removeReadingListEntry":
      await readingListApi().removeEntry({ url: params.url as string });
      return completed();
    default:
      return undefined;
  }
};
