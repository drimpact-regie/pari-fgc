import { describe, expect, it, vi } from "vitest";

const { revalidateTagMock } = vi.hoisted(() => ({ revalidateTagMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: revalidateTagMock }));

import { invalidateStartggCache } from "./startggCache";

describe("invalidateStartggCache", () => {
  it("expires the tag matching this eventSlug immediately (not stale-while-revalidate)", () => {
    invalidateStartggCache("tournament/x/event/y");

    expect(revalidateTagMock).toHaveBeenCalledWith("startgg:tournament/x/event/y", { expire: 0 });
  });
});
