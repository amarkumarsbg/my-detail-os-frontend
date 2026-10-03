"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Smile,
  Flower2,
  Coffee,
  Trophy,
  Car,
  Lightbulb,
  Hash,
  Flag,
  Search,
} from "lucide-react";

const RECENT_KEY = "workshop_support_recent_emojis";

const CATEGORIES: {
  id: string;
  label: string;
  icon: typeof Smile;
  emojis: string[];
}[] = [
  {
    id: "smileys",
    label: "Smileys & People",
    icon: Smile,
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😗", "☺️", "😚", "😙", "🥲", "😋", "😛",
      "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑",
      "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴",
      "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳",
      "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "☹️", "😮", "😯", "😲",
      "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣",
      "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "👍", "👎", "👏",
      "🙌", "🤝", "🙏", "💪", "✌️", "🤞", "👋", "👌", "🤌", "🫶",
    ],
  },
  {
    id: "nature",
    label: "Animals & Nature",
    icon: Flower2,
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮",
      "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐔", "🐧", "🐦", "🐤", "🦄", "🐝",
      "🐛", "🦋", "🐌", "🐞", "🐢", "🐍", "🐙", "🐠", "🐟", "🐬", "🐳", "🌸",
      "💮", "🌹", "🌺", "🌻", "🌼", "🌷", "🌱", "🌲", "🌳", "🌴", "🌵", "🍀",
    ],
  },
  {
    id: "food",
    label: "Food & Drink",
    icon: Coffee,
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑", "🥭",
      "🍍", "🥥", "🥝", "🍅", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶️", "🥒", "🥬",
      "🍞", "🥐", "🥖", "🧀", "🥚", "🍳", "🥞", "🥓", "🍔", "🍟", "🍕", "🌭",
      "🥪", "🌮", "🌯", "🥗", "🍝", "🍜", "🍣", "🍱", "🍦", "🍩", "🍪", "🎂",
      "☕", "🍵", "🧃", "🥤", "🧋", "🍺", "🍻", "🥂", "🍷", "🥃",
    ],
  },
  {
    id: "activity",
    label: "Activity",
    icon: Trophy,
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸", "🏒", "🥊",
      "⛳", "🏹", "🎣", "🤿", "🎽", "🛹", "🛼", "🛷", "⛸️", "🎿", "🏆", "🥇",
      "🥈", "🥉", "🎖️", "🏅", "🎯", "🎮", "🎲", "🧩", "♟️", "🎭", "🎨", "🎬",
    ],
  },
  {
    id: "travel",
    label: "Travel & Places",
    icon: Car,
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚",
      "🚛", "🚜", "🛵", "🏍️", "🛺", "🚲", "🛴", "✈️", "🛫", "🛬", "🚀", "🛸",
      "🚁", "🛶", "⛵", "🚢", "🏠", "🏡", "🏢", "🏣", "🏥", "🏦", "🏨", "🏫",
      "🗽", "🗼", "🏰", "🏯", "🏟️", "🌅", "🌄", "🌠", "🌌", "🌉",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icon: Lightbulb,
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "💽", "💾", "💿", "📀", "📷",
      "📸", "📹", "🎥", "📞", "☎️", "📺", "📻", "🧭", "⏱️", "⏰", "⏳", "🔋",
      "🔌", "💡", "🔦", "🕯️", "💵", "💴", "💶", "💷", "💰", "💳", "💎", "⚖️",
      "🛠️", "🔧", "🔨", "⚙️", "🔗", "📎", "📌", "📍", "✂️", "🔑", "🗝️", "🔒",
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    icon: Hash,
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "✅", "❌", "⭕", "❗", "❓", "‼️",
      "⁉️", "💯", "💢", "💥", "💫", "💦", "💨", "🕳️", "💣", "💬", "👁️‍🗨️", "🗨️",
      "🗯️", "💭", "💤", "🔔", "🔕", "🎵", "🎶", "➕", "➖", "➗", "✖️", "♾️",
    ],
  },
  {
    id: "flags",
    label: "Flags",
    icon: Flag,
    emojis: [
      "🏁", "🚩", "🎌", "🏴", "🏳️", "🏳️‍🌈", "🇮🇳", "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇩🇪",
      "🇫🇷", "🇯🇵", "🇨🇳", "🇧🇷", "🇿🇦", "🇦🇪", "🇸🇬", "🇲🇾", "🇳🇵", "🇱🇰", "🇧🇩", "🇵🇰",
    ],
  },
];

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === "string").slice(0, 32);
  } catch {
    return [];
  }
}

function persistRecent(emojis: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(emojis.slice(0, 32)));
  } catch {
    /* ignore */
  }
}

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose?: () => void;
}

export function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  const [tab, setTab] = useState<"emoji" | "gif" | "sticker">("emoji");
  const [category, setCategory] = useState("recent");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const categoryTabs = useMemo(
    () => [{ id: "recent", label: "Recent", icon: Clock }, ...CATEGORIES],
    []
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const all = CATEGORIES.flatMap((c) => c.emojis);
      const matched = all.filter((e) => e.includes(q));
      return [
        {
          id: "search",
          label: matched.length ? "Search results" : "No matches",
          emojis: matched.length ? matched : CATEGORIES[0]!.emojis.slice(0, 24),
        },
      ];
    }
    if (category === "recent") {
      return [
        {
          id: "recent",
          label: "Recent",
          emojis: recent.length ? recent : ["✅", "👍", "🙏", "😊", "🎉", "🔥", "❤️", "👏"],
        },
        {
          id: "smileys",
          label: "Smileys & People",
          emojis: CATEGORIES[0]!.emojis,
        },
      ];
    }
    const cat = CATEGORIES.find((c) => c.id === category);
    return cat ? [{ id: cat.id, label: cat.label, emojis: cat.emojis }] : [];
  }, [category, query, recent]);

  function pick(emoji: string) {
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 32);
    setRecent(next);
    persistRecent(next);
    onPick(emoji);
  }

  return (
    <div
      role="dialog"
      aria-label="Emoji picker"
      className="flex h-[360px] w-[min(360px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
    >
      {tab === "emoji" ? (
        <>
          <div className="flex items-center justify-around border-b border-border px-1.5 pt-2">
            {categoryTabs.map((c) => {
              const Icon = c.icon;
              const active = category === c.id && !query;
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => {
                    setQuery("");
                    setCategory(c.id);
                  }}
                  className={`flex h-8 w-8 items-center justify-center border-b-2 ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          <div className="px-2.5 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search emoji"
                className="h-8 w-full rounded-lg border border-primary bg-background pl-8 pr-2.5 text-sm text-foreground outline-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
            {visible.map((section) => (
              <div key={section.id} className="mb-2.5">
                <div className="px-1 py-1.5 text-[13px] font-semibold text-muted-foreground">
                  {section.label}
                </div>
                <div className="grid grid-cols-8 gap-0.5">
                  {section.emojis.map((emoji, i) => (
                    <button
                      key={`${section.id}-${emoji}-${i}`}
                      type="button"
                      onClick={() => pick(emoji)}
                      className="aspect-square rounded-lg text-[22px] leading-none hover:bg-muted"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {tab === "gif" ? "GIF search coming soon" : "Stickers coming soon"}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-3 font-semibold text-primary"
            >
              Close
            </button>
          ) : null}
        </div>
      )}

      <div className="flex border-t border-border bg-muted/40">
        {(
          [
            { id: "emoji", label: "Emoji", icon: Smile },
            { id: "gif", label: "GIF", icon: Hash },
            { id: "sticker", label: "Sticker", icon: Flower2 },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex h-11 flex-1 items-center justify-center gap-1.5 border-t-2 text-xs font-semibold ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
