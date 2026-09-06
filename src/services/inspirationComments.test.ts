import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addComment, listThreads } from "./inspirationComments";

// The file store resolves COMMENTS_STORE_DIR on every call — a fresh temp dir
// per test run keeps the suite hermetic (never touches the project's .data/).
const storeDir = mkdtempSync(join(tmpdir(), "homeino-comments-"));
process.env.COMMENTS_STORE_DIR = storeDir;

describe("inspirationComments (local file store)", () => {
  it("starts empty for an unknown pin", async () => {
    const threads = await listThreads("no-such-pin");
    expect(threads).toEqual([]);
  });

  it("adds a top-level comment and lists it as a thread", async () => {
    const created = await addComment({
      pinId: "i1",
      body: "چیدمان قشنگی است، ممنون",
      authorName: "سارا",
    });
    expect(created.pinId).toBe("i1");
    expect(created.parentId).toBeNull();
    expect(created.authorType).toBe("guest");

    const threads = await listThreads("i1");
    expect(threads).toHaveLength(1);
    expect(threads[0].comment.body).toBe("چیدمان قشنگی است، ممنون");
    expect(threads[0].replies).toHaveLength(0);
  });

  it("nests a reply under its root and flattens reply-to-reply", async () => {
    const threads = await listThreads("i1");
    const root = threads[0].comment;

    const reply = await addComment({
      pinId: "i1",
      body: "موافقم، نورش عالیه",
      authorName: "امیر",
      parentId: root.id,
    });
    const replyToReply = await addComment({
      pinId: "i1",
      body: "منم همین نظرم",
      authorName: "نگار",
      parentId: reply.id, // reply-to-reply must attach to the root thread
    });

    const after = await listThreads("i1");
    expect(after).toHaveLength(1);
    expect(after[0].replies).toHaveLength(2);
    expect(after[0].replies[0].id).toBe(reply.id);
    expect(after[0].replies[1].id).toBe(replyToReply.id);
    expect(after[0].replies[0].parentId).toBe(root.id);
  });

  it("rejects a reply to a missing or cross-pin parent", async () => {
    await expect(
      addComment({ pinId: "i1", body: "سلام", authorName: "تستر", parentId: "c-does-not-exist" })
    ).rejects.toThrow("parent-missing");

    await expect(
      addComment({ pinId: "i2", body: "سلام", authorName: "تستر", parentId: "c-does-not-exist" })
    ).rejects.toThrow("parent-missing");
  });

  it("enforces body and name length", async () => {
    await expect(addComment({ pinId: "i2", body: "  ", authorName: "تستر" })).rejects.toThrow("body-length");
    await expect(addComment({ pinId: "i2", body: "خوبه", authorName: "ا" })).rejects.toThrow("name-length");
    await expect(addComment({ pinId: "i2", body: "خوبه".repeat(500), authorName: "تستر" })).rejects.toThrow("body-length");
  });

  it("keeps pins isolated from each other", async () => {
    const other = await listThreads("i2");
    expect(other).toHaveLength(0);
    await addComment({ pinId: "i2", body: "اتاق خواب دنجی است", authorName: "مهدی" });
    expect(await listThreads("i2")).toHaveLength(1);
    expect(await listThreads("i1")).toHaveLength(1);
  });
});
