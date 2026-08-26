import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { Callout, Field, FieldRow } from "../components/Field";
import { EnterpriseShell } from "../components/EnterpriseShell";
import { canAuthorize, canMaintain, type UserProfile } from "../roles";

interface Rule {
  id: number;
  category_code: string;
  bank_transaction: string;
  currency: string;
  threshold: number;
  version: number;
  status: "U" | "A";
  maker: string | null;
  checker: string | null;
  last_action: string;
}

interface Unavail {
  id: number;
  account_no: string;
  reason: string;
  version: number;
  status: "U" | "A";
  maker: string | null;
  checker: string | null;
  last_action: string;
}

const EMPTY_RULE: Partial<Rule> = { category_code: "", bank_transaction: "DESH.TRANSFER", currency: "MAD", threshold: 500 };
const EMPTY_UNAVAIL: Partial<Unavail> = { account_no: "", reason: "" };

export function M02Eligibility({ user }: { user: UserProfile }) {
  const [tab, setTab] = useState<"rules" | "unavailable" | "audit">("rules");
  const maintain = canMaintain(user.role);
  const authorizeAllowed = canAuthorize(user.role);

  // ----- Rules -----
  const [rules, setRules] = useState<Rule[]>([]);
  const [ruleForm, setRuleForm] = useState<Partial<Rule>>(EMPTY_RULE);
  const [ruleMode, setRuleMode] = useState<"query" | "view" | "new">("query");
  const [expectedRuleVersion, setExpectedRuleVersion] = useState<number | undefined>();

  // ----- Unavailable accounts -----
  const [unavails, setUnavails] = useState<Unavail[]>([]);
  const [unavailForm, setUnavailForm] = useState<Partial<Unavail>>(EMPTY_UNAVAIL);
  const [unavailMode, setUnavailMode] = useState<"query" | "view" | "new">("query");
  const [expectedUnavailVersion, setExpectedUnavailVersion] = useState<number | undefined>();

  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadRules() {
    setRules(await api.get<Rule[]>("/m02/rules"));
  }
  async function loadUnavails() {
    setUnavails(await api.get<Unavail[]>("/m02/unavailable"));
  }
  useEffect(() => {
    loadRules().catch(() => {});
    loadUnavails().catch(() => {});
  }, []);

  function selectRule(r: Rule) {
    setRuleForm(r);
    setExpectedRuleVersion(r.version);
    setRuleMode("view");
    api.get<any[]>(`/m02/rules/${r.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }
  function selectUnavail(r: Unavail) {
    setUnavailForm(r);
    setExpectedUnavailVersion(r.version);
    setUnavailMode("view");
    api.get<any[]>(`/m02/unavailable/${r.id}/audit`).then(setAudit).catch(() => setAudit([]));
  }

  async function saveRule() {
    setError(null);
    try {
      const row = await api.post<Rule>("/m02/rules", { ...ruleForm, expectedVersion: expectedRuleVersion, actorLogin: user.login, actorRole: user.role });
      setRuleForm(row);
      setExpectedRuleVersion(row.version);
      setRuleMode("view");
      loadRules();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'enregistrement.");
    }
  }
  async function authorizeRule() {
    if (!ruleForm.id) return;
    setError(null);
    try {
      const row = await api.post<Rule>(`/m02/rules/${ruleForm.id}/authorize`, { actorLogin: user.login, actorRole: user.role });
      setRuleForm(row);
      loadRules();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'autorisation.");
    }
  }
  async function deleteRule() {
    if (!ruleForm.id) return;
    setError(null);
    try {
      await api.del(`/m02/rules/${ruleForm.id}?actorLogin=${user.login}&actorRole=${user.role}`);
      setRuleForm(EMPTY_RULE);
      setRuleMode("query");
      loadRules();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de suppression.");
    }
  }

  async function saveUnavail() {
    setError(null);
    try {
      const row = await api.post<Unavail>("/m02/unavailable", {
        ...unavailForm,
        expectedVersion: expectedUnavailVersion,
        actorLogin: user.login,
        actorRole: user.role,
      });
      setUnavailForm(row);
      setExpectedUnavailVersion(row.version);
      setUnavailMode("view");
      loadUnavails();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'enregistrement.");
    }
  }
  async function authorizeUnavail() {
    if (!unavailForm.id) return;
    setError(null);
    try {
      const row = await api.post<Unavail>(`/m02/unavailable/${unavailForm.id}/authorize`, { actorLogin: user.login, actorRole: user.role });
      setUnavailForm(row);
      loadUnavails();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur d'autorisation.");
    }
  }
  async function deleteUnavail() {
    if (!unavailForm.id) return;
    setError(null);
    try {
      await api.del(`/m02/unavailable/${unavailForm.id}?actorLogin=${user.login}&actorRole=${user.role}`);
      setUnavailForm(EMPTY_UNAVAIL);
      setUnavailMode("query");
      loadUnavails();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur de suppression.");
    }
  }

  const ruleEditable = ruleMode === "new" || (ruleMode === "view" && ruleForm.status === "U" && maintain);
  const unavailEditable = unavailMode === "new" || (unavailMode === "view" && unavailForm.status === "U" && maintain);

  return (
    <EnterpriseShell
      functionId="BOA.DESH.ELIG"
      screenTitle="M02 - Catégories, transactions BANK et comptes indisponibles"
      user={user.login}
      toolbar={[
        {
          key: "new",
          label: "New",
          disabled: !maintain || tab === "audit",
          onClick: () => (tab === "rules" ? (setRuleForm(EMPTY_RULE), setRuleMode("new")) : (setUnavailForm(EMPTY_UNAVAIL), setUnavailMode("new"))),
        },
        {
          key: "save",
          label: "Save",
          variant: "primary",
          disabled: !maintain || tab === "audit",
          onClick: () => (tab === "rules" ? saveRule() : saveUnavail()),
        },
        {
          key: "auth",
          label: "Authorize",
          disabled:
            !authorizeAllowed ||
            tab === "audit" ||
            (tab === "rules" ? ruleForm.status !== "U" || !ruleForm.id : unavailForm.status !== "U" || !unavailForm.id),
          onClick: () => (tab === "rules" ? authorizeRule() : authorizeUnavail()),
        },
        {
          key: "delete",
          label: "Delete",
          variant: "danger",
          disabled:
            !maintain ||
            tab === "audit" ||
            (tab === "rules" ? ruleForm.status !== "U" || !ruleForm.id : unavailForm.status !== "U" || !unavailForm.id),
          onClick: () => (tab === "rules" ? deleteRule() : deleteUnavail()),
        },
        { key: "close", label: "Close", onClick: () => { setRuleForm(EMPTY_RULE); setRuleMode("query"); setUnavailForm(EMPTY_UNAVAIL); setUnavailMode("query"); } },
      ]}
      tabs={[
        { key: "rules", label: "Catégories / BANK Transaction" },
        { key: "unavailable", label: "Comptes indisponibles" },
        { key: "audit", label: "Audit" },
      ]}
      activeTab={tab}
      onTabChange={(k) => setTab(k as typeof tab)}
      footer={{
        recordStatus:
          tab === "rules" ? (ruleForm.id ? (ruleForm.status === "A" ? "Authorized" : "Unauthorized") : undefined) : unavailForm.id ? (unavailForm.status === "A" ? "Authorized" : "Unauthorized") : undefined,
        statusVariant: (tab === "rules" ? ruleForm.status : unavailForm.status) === "A" ? "AUTHORIZED" : "SUBMITTED",
        maker: tab === "rules" ? ruleForm.maker ?? undefined : unavailForm.maker ?? undefined,
        checker: tab === "rules" ? ruleForm.checker ?? undefined : unavailForm.checker ?? undefined,
        version: tab === "rules" ? ruleForm.version : unavailForm.version,
        lastAction: tab === "rules" ? ruleForm.last_action : unavailForm.last_action,
      }}
    >
      {error && <Callout variant="error">{error}</Callout>}

      {tab === "rules" && (
        <>
          <div className="section-title">Catégories / Product éligibles et transaction BANK associée</div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Product / Category</th>
                <th>BANK Transaction</th>
                <th>Threshold</th>
                <th>Version</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className={ruleForm.id === r.id ? "selected" : ""} onClick={() => selectRule(r)}>
                  <td>{r.category_code}</td>
                  <td>{r.bank_transaction}</td>
                  <td>
                    {r.threshold.toFixed(2)} {r.currency}
                  </td>
                  <td>{r.version}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(ruleMode === "new" || ruleMode === "view") && (
            <div className="detail-panel">
              <FieldRow>
                <Field label="Product / Category" required readOnly={ruleMode !== "new"}>
                  <input value={ruleForm.category_code ?? ""} disabled={ruleMode !== "new"} onChange={(e) => setRuleForm({ ...ruleForm, category_code: e.target.value })} />
                </Field>
                <Field label="BANK Transaction" required readOnly={ruleMode !== "new"}>
                  <input value={ruleForm.bank_transaction ?? ""} disabled={ruleMode !== "new"} onChange={(e) => setRuleForm({ ...ruleForm, bank_transaction: e.target.value })} />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Currency" readOnly={!ruleEditable}>
                  <select value={ruleForm.currency ?? "MAD"} disabled={!ruleEditable} onChange={(e) => setRuleForm({ ...ruleForm, currency: e.target.value })}>
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </Field>
                <Field label="Threshold" required readOnly={!ruleEditable}>
                  <input type="number" step="0.01" value={ruleForm.threshold ?? ""} disabled={!ruleEditable} onChange={(e) => setRuleForm({ ...ruleForm, threshold: Number(e.target.value) })} />
                </Field>
              </FieldRow>
            </div>
          )}
        </>
      )}

      {tab === "unavailable" && (
        <>
          <div className="section-title">Comptes déclarés indisponibles (exclus du traitement automatique)</div>
          <table className="eb-grid">
            <thead>
              <tr>
                <th>Account</th>
                <th>Reason</th>
                <th>Version</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {unavails.map((r) => (
                <tr key={r.id} className={unavailForm.id === r.id ? "selected" : ""} onClick={() => selectUnavail(r)}>
                  <td>{r.account_no}</td>
                  <td>{r.reason}</td>
                  <td>{r.version}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(unavailMode === "new" || unavailMode === "view") && (
            <div className="detail-panel">
              <FieldRow>
                <Field label="Account" required readOnly={unavailMode !== "new"}>
                  <input value={unavailForm.account_no ?? ""} disabled={unavailMode !== "new"} onChange={(e) => setUnavailForm({ ...unavailForm, account_no: e.target.value })} />
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Reason (justification)" required readOnly={!unavailEditable}>
                  <textarea rows={2} value={unavailForm.reason ?? ""} disabled={!unavailEditable} onChange={(e) => setUnavailForm({ ...unavailForm, reason: e.target.value })} />
                </Field>
              </FieldRow>
            </div>
          )}
        </>
      )}

      {tab === "audit" && (
        <>
          <div className="section-title">Journal d'audit (append-only) — sélection courante</div>
          {audit.length === 0 && <p className="hint">Sélectionner un enregistrement dans un des onglets pour afficher son historique.</p>}
          {audit.map((a) => (
            <div className="audit-entry" key={a.id}>
              <div className="row1">
                <span>
                  {a.action} — {a.result}
                </span>
                <span>{a.ts}</span>
              </div>
              <div>
                Acteur: {a.actor} ({a.role}) | correlationId: {a.correlation_id}
              </div>
              {a.motif && <div>Motif: {a.motif}</div>}
            </div>
          ))}
        </>
      )}
    </EnterpriseShell>
  );
}
