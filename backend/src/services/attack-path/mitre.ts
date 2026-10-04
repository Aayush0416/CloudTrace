import type { PathEdge } from "./index";
export interface Mitre {
  id: string;
  name: string;
}
const T = (id: string, name: string): Mitre => ({ id, name });
/** Maps a path step to the closest MITRE ATT&CK technique (enterprise matrix, cloud-relevant). Informational only. */
export function mitreFor(e: PathEdge, targetType: string): Mitre {
  if (e.type === "reaches")
    return T("T1190", "Exploit Public-Facing Application");
  if (e.type === "connects_to") return T("T1021", "Remote Services");
  if (e.type === "can_access") {
    if (targetType === "storage") return T("T1530", "Data from Cloud Storage");
    if (targetType === "secret")
      return T("T1555.006", "Cloud Secrets Management Stores");
    if (targetType === "database")
      return T("T1213", "Data from Information Repositories");
  }
  return T("T1078.004", "Valid Accounts: Cloud Accounts");
}
