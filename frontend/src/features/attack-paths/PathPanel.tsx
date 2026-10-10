import { useState } from "react";
import { Bot, FlaskConical, Sparkles } from "lucide-react";
import { errorInfo } from "../../lib/api";
import { useAi, useWhatIf } from "../../lib/queries";
import type { AttackPath, Change, PathEdge } from "../../lib/types";
import {
  Button,
  SEV,
  SeverityBadge,
  Tabs,
} from "../../components/ui";
import WhatIfResult from "../../components/WhatIfResult";

const FACTORS = [
  ["exposure", "Exposure"],
  ["exploitability", "Exploitability"],
  ["privilege", "Privilege"],
  ["criticality", "Asset criticality"],
  ["confidence", "Confidence"],
] as const;
type Tab = "overview" | "ai" | "simulate";

/** Maps a path step to the single configuration change that would remove it. */
function changeFor(e: PathEdge): Change {
  if (e.source === "internet")
    return { type: "make_private", resourceId: e.target };
  if (e.action)
    return {
      type: "remove_permission",
      resourceId: e.source,
      target: e.target,
      action: e.action as "read" | "write" | "admin",
    };
  return {
    type: "remove_relationship",
    resourceId: e.source,
    relType: e.type,
    target: e.target,
  };
}
const stepText = (e: PathEdge, L: (id: string) => string) =>
  e.source === "internet"
    ? `Make ${L(e.target)} private`
    : e.action
      ? `Remove ${e.action} access: ${L(e.source)} → ${L(e.target)}`
      : `Remove ${e.type.replace("_", " ")} link: ${L(e.source)} → ${L(e.target)}`;

export default function PathPanel({
  path,
  projectId,
  label: L,
}: {
  path: AttackPath;
  projectId: string;
  label: (id: string) => string;
}) {
  const [tab, setTab] = useState<Tab>("overview"),
    ai = useAi(projectId),
    sim = useWhatIf(projectId);
  const [kind, setKind] = useState<"explain" | "remediation">("explain"),
    [picked, setPicked] = useState("");
  const route =
    path.costRank === 1
      ? "Most likely route"
      : path.costRank
        ? `Alternative route ${path.costRank}`
        : null;
  const run = (k: "explain" | "remediation") => {
    setKind(k);
    ai.mutate({ pathId: path.id, kind: k });
  };
  return (
    <div>
      <div className="space-y-1.5 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{path.id}</h2>
          <SeverityBadge s={path.risk.severity} />
        </div>
        <div className="text-muted">
          Score {path.risk.score} · {path.edges.length} steps ·{" "}
          {L(path.entryPoint)} → {L(path.target)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {route && (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
              {route}
            </span>
          )}
          {path.isShortest && (
            <span className="rounded bg-raised px-1.5 py-0.5 text-xs">
              Fewest steps
            </span>
          )}
          <span className="rounded bg-raised px-1.5 py-0.5 text-xs">
            Route likelihood {Math.round(path.likelihood * 100)}%
          </span>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "ai", label: "AI analysis" },
          { id: "simulate", label: "Simulate" },
        ]}
      />
      <div className="space-y-4 p-3">
        {tab === "overview" && (
          <>
            <div>
              <div className="mb-1.5 font-semibold">Steps</div>
              <ol className="space-y-2">
                {path.edges.map((e, i) => (
                  <li
                    key={e.key}
                    className="rounded border border-line bg-bg p-2"
                  >
                    <div>
                      <span className="text-muted">{i + 1}.</span> {L(e.source)}{" "}
                      <span className="text-accent">
                        {e.type.replace("_", " ")}
                        {e.action ? ` (${e.action})` : ""}
                      </span>{" "}
                      {L(e.target)}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {e.evidence.join(", ")} · {Math.round(e.confidence * 100)}
                      % confidence
                      {e.mitre && (
                        <span
                          title={e.mitre.name}
                          className="ml-1.5 rounded bg-raised px-1.5 py-0.5"
                        >
                          ATT&CK {e.mitre.id}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="mb-1.5 font-semibold">Risk factors</div>
              <div className="space-y-2">
                {FACTORS.map(([k, l]) => (
                  <div key={k}>
                    <div className="flex justify-between">
                      <span>{l}</span>
                      <span className="tabular-nums">
                        {path.risk.factors[k]}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded bg-raised">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${path.risk.factors[k] * 100}%`,
                          background: SEV[path.risk.severity].hex,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                Score = 100 × the product of these factors. A CloudTrace model,
                not an industry standard such as CVSS.
              </p>
            </div>
            <div>
              <div className="mb-1.5 font-semibold">Contributing findings</div>
              {path.findings.length ? (
                <ul className="space-y-1.5">
                  {path.findings.map((f) => (
                    <li
                      key={f.ruleId + f.resourceId}
                      className="flex items-start gap-2"
                    >
                      <SeverityBadge s={f.severity} />
                      <span>
                        {f.title}
                        <span className="block text-muted">
                          {L(f.resourceId)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted">None</span>
              )}
            </div>
          </>
        )}

        {tab === "ai" && (
          <>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold">
                <Bot size={14} />
                Assistant
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                busy={ai.isPending && kind === "explain"}
                onClick={() => run("explain")}
              >
                <Sparkles size={14} />
                Explain path
              </Button>
              <Button
                busy={ai.isPending && kind === "remediation"}
                onClick={() => run("remediation")}
              >
                Suggest fixes
              </Button>
            </div>
            {ai.isError && (
              <div role="alert" className="text-crit">
                {errorInfo(ai.error).message}
              </div>
            )}
            {!ai.data && !ai.isPending && (
              <p className="text-muted">
                Generate a plain-language explanation or fix suggestions. The
                text is built from this path's scan data only.
              </p>
            )}
            {ai.data && (
              <div className="space-y-3">
                <p>{ai.data.summary}</p>
                {kind === "explain" ? (
                  <>
                    <ol className="space-y-1.5">
                      {ai.data.step_explanations.map((s) => (
                        <li key={s.step}>
                          <span className="text-muted">{s.step}.</span>{" "}
                          {s.explanation}
                        </li>
                      ))}
                    </ol>
                    {ai.data.uncertainty.length > 0 && (
                      <div>
                        <div className="font-semibold">Uncertainty</div>
                        <ul className="list-disc space-y-1 pl-4 text-muted">
                          {ai.data.uncertainty.map((u) => (
                            <li key={u}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <ul className="list-disc space-y-1.5 pl-4">
                      {ai.data.remediation_steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <div>
                      <div className="font-semibold">Assumptions</div>
                      <ul className="list-disc space-y-1 pl-4 text-muted">
                        {ai.data.assumptions.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {tab === "simulate" && (
          <>
            <div className="flex items-center gap-1.5 font-semibold">
              <FlaskConical size={14} />
              Break a link and compare
            </div>
            <p className="text-muted">
              Pick a step to remove. CloudTrace re-runs the analysis on a copy
              of the environment.
            </p>
            <ul className="space-y-1.5">
              {path.edges.map((e) => (
                <li key={e.key}>
                  <button
                    onClick={() => {
                      setPicked(e.key);
                      sim.mutate(changeFor(e));
                    }}
                    disabled={sim.isPending}
                    className={`w-full rounded border px-2.5 py-2 text-left hover:bg-raised ${picked === e.key ? "border-accent" : "border-line"}`}
                  >
                    {stepText(e, L)}
                  </button>
                </li>
              ))}
            </ul>
            {sim.isError && (
              <div role="alert" className="text-crit">
                {errorInfo(sim.error).message}
              </div>
            )}
            {sim.data && picked && <WhatIfResult data={sim.data} label={L} />}
          </>
        )}
      </div>
    </div>
  );
}
