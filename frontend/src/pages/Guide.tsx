import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LocateFixed, RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiStream } from "@/lib/api";
import { pandalById } from "@/lib/pandals";
import { useGeoLocation } from "@/lib/useGeo";
import { cn } from "@/lib/utils";

// Mirror of backend/models/guide.py GuideMessage.
interface GuideMessage {
  session_id: string;
  role: "user" | "assistant";
  content: string;
  pandal_ids: string[];
  created_at: string;
}

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; pandal_ids: string[] }
  | { type: "error"; message: string };

const SESSION_KEY = "pujopath_guide_session";
function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "guide-session-fallback";
  }
}

const SUGGESTIONS = [
  "Which Salt Lake block pujas are an easy walk from a metro?",
  "Plan 4 pandals near Gariahat for Ashtami evening",
  "Kumartuli-side pujas I can visit on Shashthi",
  "Which big pujas are near Kalighat metro?",
];

/** Render a reply: [[pandal-id]] → link chip, "* " lines → list items, **bold** stripped to <strong>. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const inline = (s: string, k: string) =>
    s.split(/(\[\[[a-z0-9-]+\]\]|\*\*[^*]+\*\*)/g).map((part, i) => {
      const m = part.match(/^\[\[([a-z0-9-]+)\]\]$/);
      if (m) {
        const p = pandalById(m[1]);
        return p ? (
          <Link
            key={`${k}-${i}`}
            to={`/pandal/${p.id}`}
            data-testid={`guide-pandal-link-${p.id}`}
            className="mx-0.5 inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-1.5 py-px text-[11px] font-medium text-primary align-middle hover:bg-primary/10"
          >
            view
          </Link>
        ) : null;
      }
      const b = part.match(/^\*\*([^*]+)\*\*$/);
      return b ? <strong key={`${k}-${i}`}>{b[1]}</strong> : <Fragment key={`${k}-${i}`}>{part}</Fragment>;
    });
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-relaxed">
      {lines.map((l, i) => {
        const li = l.match(/^\s*[*-]\s+(.*)$/);
        if (li) {
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
              <span>{inline(li[1], String(i))}</span>
            </p>
          );
        }
        return l.trim() ? <p key={i}>{inline(l, String(i))}</p> : null;
      })}
    </div>
  );
}

export default function Guide() {
  const sid = useRef(sessionId()).current;
  const qc = useQueryClient();
  const geo = useGeoLocation();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<{ q: string; a: string } | null>(null);
  const [useLoc, setUseLoc] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const historyKey = ["guide", "history", sid];

  const { data: history = [], isLoading } = useQuery({
    queryKey: historyKey,
    queryFn: () => apiGet<GuideMessage[]>(`/guide/sessions/${sid}/messages`),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history.length, pending?.a]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || pending) return;
    setInput("");
    setPending({ q: question, a: "" });
    try {
      await apiStream<StreamEvent>(
        "/guide/chat",
        {
          session_id: sid,
          message: question,
          user_lat: useLoc && geo.coords ? geo.coords.lat : null,
          user_lon: useLoc && geo.coords ? geo.coords.lon : null,
        },
        (ev) => {
          if (ev.type === "delta") setPending((p) => (p ? { ...p, a: p.a + ev.text } : p));
          if (ev.type === "error") toast(ev.message);
        },
      );
    } catch {
      toast("The guide is unavailable right now. Please try again.");
    } finally {
      await qc.invalidateQueries({ queryKey: historyKey });
      setPending(null);
    }
  }

  async function reset() {
    await apiDelete(`/guide/sessions/${sid}`).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: historyKey });
    toast("Conversation cleared");
  }

  const empty = !isLoading && history.length === 0 && !pending;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-3xl font-bold tracking-tight">
            <Sparkles className="size-6 text-gold" aria-hidden /> Puja Guide
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask in English or Bengali. Answers come only from PujoPath's pandal records, with live crowd reports —
            powered by Gemini 3 Flash.
          </p>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            data-testid="guide-reset-button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden /> New chat
          </button>
        )}
      </header>

      <div className="flex min-h-[40vh] flex-col gap-4 rounded-xl border border-border/70 bg-card p-4" data-testid="guide-thread">
        {empty && (
          <div className="flex flex-col gap-3" data-testid="guide-empty-state">
            <p className="text-sm text-muted-foreground">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`guide-suggestion-${i}`}
                  onClick={() => ask(s)}
                  className="rounded-full border border-gold/40 bg-gold/5 px-3 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-gold/15"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={`${m.created_at}-${i}`}
            data-testid={`guide-message-${m.role}`}
            className={cn(
              "max-w-[90%] rounded-xl px-3.5 py-2.5",
              m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-secondary/70",
            )}
          >
            {m.role === "user" ? <p className="text-sm">{m.content}</p> : <RichText text={m.content} />}
          </div>
        ))}
        {pending && (
          <>
            <div className="max-w-[90%] self-end rounded-xl bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">{pending.q}</div>
            <div className="max-w-[90%] self-start rounded-xl bg-secondary/70 px-3.5 py-2.5" data-testid="guide-streaming-reply">
              {pending.a ? <RichText text={pending.a} /> : <p className="animate-pulse text-sm text-muted-foreground">Thinking about pandals…</p>}
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <div className="flex gap-2">
          <label htmlFor="guide-input" className="sr-only">
            Ask the Puja Guide
          </label>
          <input
            id="guide-input"
            data-testid="guide-input"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Quiet pujas near Shyambazar for Saptami morning"
            className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
          />
          <button
            type="submit"
            data-testid="guide-send-button"
            disabled={!input.trim() || !!pending}
            aria-label="Send"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform duration-100 active:scale-[0.98] disabled:opacity-50"
          >
            <SendHorizontal className="size-4" aria-hidden />
          </button>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            data-testid="guide-use-location-checkbox"
            checked={useLoc}
            onChange={(e) => {
              setUseLoc(e.target.checked);
              if (e.target.checked && !geo.coords) geo.request();
            }}
            className="size-3.5 accent-[#C8281E]"
          />
          <LocateFixed className="size-3.5" aria-hidden />
          Use my location for "near me" questions (sent only with your question, never stored)
        </label>
        {useLoc && geo.message && <p className="text-xs text-destructive" role="alert">{geo.message}</p>}
        <p className="text-xs text-muted-foreground">
          The guide can be wrong. Check each pandal's page and confirm the route in Google Maps.
        </p>
      </form>
    </div>
  );
}
