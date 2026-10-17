import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  parseSocialSnapshot,
  type SocialContent,
  type SocialPlatform,
} from "../../data/schemas/social.schema";
import { verifiedMediaAccounts } from "../data/social";
type View = {
  items: SocialContent[];
  status: "idle" | "loading" | "ready" | "error";
};
type State = {
  views: Record<SocialPlatform, View>;
  load: (platform: SocialPlatform) => void;
};
const empty: View = { items: [], status: "idle" };
const Context = createContext<State | null>(null);
export function SocialProvider({ children }: { children: ReactNode }) {
  const [views, setViews] = useState<Record<SocialPlatform, View>>({
    instagram: empty,
    tiktok: empty,
  });
  const busy = useRef(new Set<SocialPlatform>());
  const load = useCallback((platform: SocialPlatform) => {
    if (busy.current.has(platform)) return;
    busy.current.add(platform);
    setViews((v) => ({
      ...v,
      [platform]: { ...v[platform], status: "loading" },
    }));
    fetch(`${import.meta.env.BASE_URL}data/social/${platform}/items.json`, {
      cache: "no-cache",
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const snapshot = parseSocialSnapshot(
          await r.json(),
          platform,
          verifiedMediaAccounts,
        );
        if (!snapshot) throw Error();
        return snapshot;
      })
      .then((s) =>
        setViews((v) => ({
          ...v,
          [platform]: { items: s.items, status: "ready" },
        })),
      )
      .catch(() =>
        setViews((v) => ({ ...v, [platform]: { items: [], status: "error" } })),
      )
      .finally(() => busy.current.delete(platform));
  }, []);
  return (
    <Context.Provider value={{ views, load }}>{children}</Context.Provider>
  );
}
export function useSocial() {
  const state = useContext(Context);
  if (!state) throw Error("Missing SocialProvider");
  return state;
}
