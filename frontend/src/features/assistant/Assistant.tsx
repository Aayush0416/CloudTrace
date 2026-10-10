import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bot, Send, User } from "lucide-react";
import { errorInfo } from "../../lib/api";
import { useAssistant, useProject } from "../../lib/queries";
import type { ChatReply } from "../../lib/types";
import {
  Button,
  EmptyState,
  inputCls,
  Loading,
  PageHeader,
} from "../../components/ui";

interface Msg {
  role: "user" | "assistant";
  text: string;
  refs?: ChatReply["references"];
}
const PROMPTS = [
  "Summarize this scan",
  "What are my most critical paths?",
  "What should I fix first?",
  "What is exposed to the internet?",
];

export default function Assistant() {
  const id = useParams().projectId!,
    nav = useNavigate(),
    project = useProject(id),
    ask = useAssistant(id);
  const [msgs, setMsgs] = useState<Msg[]>([]),
    [text, setText] = useState(""),
    end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, ask.isPending]);
  const [sp] = useSearchParams(),
    auto = useRef(false);
  useEffect(() => {
    const q = sp.get("q");
    if (q && !auto.current && project.data?.summary) {
      auto.current = true;
      send(q);
    }
  }, [project.data]); // eslint-disable-line
  if (project.isLoading) return <Loading />;
  if (!project.data?.summary)
    return (
      <div className="p-5">
        <PageHeader title="Security Advisor" />
        <EmptyState
          title="Run a scan first"
          body="The advisor answers from your scan results. Import an environment and run a scan from the Overview page."
        />
      </div>
    );
  const send = async (q: string) => {
    if (!q.trim() || ask.isPending) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setText("");
    try {
      const r = await ask.mutateAsync(q);
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: r.answer, refs: r.references },
      ]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: errorInfo(e).message }]);
    }
  };
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-6">
      <PageHeader
        title="Security Advisor"
        sub="Ask about this project's attack paths, exposure and fixes."
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-auto rounded border border-line bg-panel p-3">
        {!msgs.length && (
          <div className="space-y-2">
            <p className="text-muted">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded border border-line bg-raised px-2.5 py-1.5 hover:border-accent"
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-muted">
              You can also ask about a path by ID, for example “Explain AP-001”.
            </p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}
          >
            {m.role === "assistant" && (
              <Bot size={16} className="mt-1 shrink-0 text-accent" />
            )}
            <div
              className={`max-w-[85%] rounded px-3 py-2 ${m.role === "user" ? "bg-accent/15" : "bg-raised"}`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              {m.refs && m.refs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.refs
                    .filter((r) => r.type === "path")
                    .map((r) => (
                      <Button
                        key={r.id}
                        onClick={() =>
                          nav(`/p/${id}/attack-paths?path=${r.id}`)
                        }
                      >
                        Open {r.id}
                      </Button>
                    ))}
                </div>
              )}
            </div>
            {m.role === "user" && (
              <User size={16} className="mt-1 shrink-0 text-muted" />
            )}
          </div>
        ))}
        {ask.isPending && <div className="text-muted">Thinking…</div>}
        <div ref={end} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          className={inputCls}
          placeholder="Ask about this scan"
          aria-label="Question"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <Button
          variant="primary"
          type="submit"
          disabled={!text.trim()}
          busy={ask.isPending}
        >
          <Send size={14} />
          Send
        </Button>
      </form>
    </div>
  );
}
