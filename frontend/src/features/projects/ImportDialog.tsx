import { useRef, useState } from "react";
import { FileJson, Upload } from "lucide-react";
import { errorInfo } from "../../lib/api";
import { useImport, useRunScan } from "../../lib/queries";
import { Button, Modal } from "../../components/ui";

const SAMPLES = [
  [
    "enterprise",
    "Enterprise: multi-tier environment with many branching paths",
  ],
  ["safe", "Safe: private resources, no exposed paths"],
  ["medium", "Medium: public server to storage"],
  ["critical", "Critical: public server to production database"],
  [
    "ssrf-over-privileged-role",
    "SSRF: public proxy with an admin role on customer data",
  ],
  [
    "ssrf-over-privileged-role-fixed",
    "SSRF (fixed): same environment after remediation",
  ],
  [
    "public-storage-and-leaked-key",
    "Public bucket and database plus a leaked access key",
  ],
  ["cicd-supply-chain", "CI/CD: stolen pipeline credential and role chaining"],
  [
    "serverless-saas",
    "Serverless SaaS: public API and broad Lambda roles",
  ],
] as const;

export default function ImportDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const importEnv = useImport(projectId),
    scan = useRunScan(projectId);
  const [env, setEnv] = useState<{ name: string; data: unknown } | null>(null);
  const [problem, setProblem] = useState<{
    message: string;
    details: string[];
  } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const load = async (name: string, text: string) => {
    try {
      setEnv({ name, data: JSON.parse(text) });
      setProblem(null);
    } catch {
      setEnv(null);
      setProblem({ message: `${name} is not valid JSON`, details: [] });
    }
  };
  const run = async () => {
    if (!env) return;
    try {
      await importEnv.mutateAsync(env.data);
      await scan.mutateAsync();
      onClose();
    } catch (e) {
      setProblem(errorInfo(e));
    }
  };
  return (
    <Modal title="Import environment" onClose={onClose} wide>
      <p className="mb-3 text-muted">
        Upload a normalized cloud environment as JSON. CloudTrace validates it,
        then runs a scan. Importing replaces the project's current environment.
      </p>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await load(f.name, await f.text());
        }}
      />
      <Button onClick={() => file.current?.click()}>
        <Upload size={14} />
        Choose JSON file
      </Button>
      <div className="mt-4 text-muted">Or start from a sample</div>
      <div className="mt-1.5 space-y-1.5">
        {SAMPLES.map(([k, label]) => (
          <button
            key={k}
            onClick={async () =>
              load(
                `${k}.json`,
                await (await fetch(`/samples/${k}.json`)).text(),
              )
            }
            className="flex w-full items-center gap-2 rounded border border-line px-3 py-2 text-left hover:bg-raised"
          >
            <FileJson size={14} className="text-accent" />
            {label}
          </button>
        ))}
      </div>
      {env && (
        <div className="mt-3 rounded border border-line bg-bg px-3 py-2">
          Ready to import: <span className="font-medium">{env.name}</span>
        </div>
      )}
      {problem && (
        <div
          role="alert"
          className="mt-3 rounded border border-crit/40 bg-crit/10 p-3 text-crit"
        >
          <div className="font-medium">{problem.message}</div>
          {problem.details.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {problem.details.slice(0, 8).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!env}
          busy={importEnv.isPending || scan.isPending}
          onClick={run}
        >
          Import and scan
        </Button>
      </div>
    </Modal>
  );
}
