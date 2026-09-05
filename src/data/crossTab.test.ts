import { describe, expect, it, vi } from "vitest";
import { createDataSyncHub, DATA_SYNC_PREFIX } from "./crossTab";

/** Fake BroadcastChannel-shaped transport for deterministic tests. */
function fakeChannelFactory() {
  const routes: ((key: string) => void)[] = [];
  const sent: { key: string }[] = [];
  return {
    createChannel: (onMessage: (key: string) => void) => {
      routes.push(onMessage);
      return {
        postMessage: (msg: { key: string }) => sent.push(msg),
        close: () => {},
      };
    },
    deliver: (key: string) => routes.forEach((route) => route(key)),
    sent,
  };
}

describe("createDataSyncHub", () => {
  it("notifies subscribers only for homeino-* keys from storage events", () => {
    const storageFns: ((key: string | null) => void)[] = [];
    const hub = createDataSyncHub({
      addStorageListener: (fn) => storageFns.push(fn),
      createChannel: () => null,
    });
    const seen: string[] = [];
    hub.subscribe((key) => seen.push(key));

    expect(storageFns).toHaveLength(1);
    storageFns[0]("homeino-orders");
    storageFns[0]("unrelated-key");
    storageFns[0](null);

    expect(seen).toEqual(["homeino-orders"]);
    hub.stop();
  });

  it("routes BroadcastChannel messages and filters foreign keys", () => {
    const channel = fakeChannelFactory();
    const hub = createDataSyncHub({ createChannel: channel.createChannel });
    const seen: string[] = [];
    hub.subscribe((key) => seen.push(key));

    channel.deliver("homeino-cart");
    channel.deliver("other-app-key");

    expect(seen).toEqual(["homeino-cart"]);
    hub.stop();
  });

  it("notify() emits locally and posts to the channel", () => {
    const channel = fakeChannelFactory();
    const hub = createDataSyncHub({ createChannel: channel.createChannel });
    const seen: string[] = [];
    hub.subscribe((key) => seen.push(key));

    hub.notify(DATA_SYNC_PREFIX + "addresses");

    expect(seen).toEqual(["homeino-addresses"]);
    expect(channel.sent).toEqual([{ key: "homeino-addresses" }]);
    hub.stop();
  });

  it("unsubscribe stops delivery", () => {
    const hub = createDataSyncHub({
      addStorageListener: () => {},
      createChannel: () => null,
    });
    const seen: string[] = [];
    const unsub = hub.subscribe((key) => seen.push(key));
    hub.notify("homeino-orders");
    unsub();
    hub.notify("homeino-orders");
    expect(seen).toEqual(["homeino-orders"]);
    hub.stop();
  });

  it("multiple subscribers all receive the same event", () => {
    const hub = createDataSyncHub({
      addStorageListener: () => {},
      createChannel: () => null,
    });
    const a: string[] = [];
    const b: string[] = [];
    hub.subscribe((key) => a.push(key));
    hub.subscribe((key) => b.push(key));
    hub.notify("homeino-wishlist");
    expect(a).toEqual(["homeino-wishlist"]);
    expect(b).toEqual(["homeino-wishlist"]);
    hub.stop();
  });

  it("is inert without any transport (SSR-safe default deps)", () => {
    const hub = createDataSyncHub();
    const fn = vi.fn();
    hub.subscribe(fn);
    hub.notify("homeino-settings");
    expect(fn).toHaveBeenCalledWith("homeino-settings");
    hub.stop();
  });
});
