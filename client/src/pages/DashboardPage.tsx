import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { api } from "../api";
import { formatMAD } from "../constants";

type Stats = {
  rdvAujourdhui: number;
  patientsTotal: number;
  consultationsMois: number;
  revenusMois: number;
  facturesEnAttente: number;
  montantEnAttente: number;
  prochainRdv: Array<{
    id: number;
    date: string;
    heure: string;
    motif: string | null;
    patient_nom: string;
    patient_prenom: string;
  }>;
  repartitionMutuelle: Array<{ mutuelle: string; total: number }>;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/dashboard/stats").then(setStats);
  }, []);

  if (!stats) {
    return (
      <>
        <PageHeader title="Tableau de bord" />
        <div className="content">Chargement…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tableau de bord" />
      <div className="content">
        <div className="grid grid-4">
          <div className="stat-card">
            <div className="label">Rendez-vous aujourd'hui</div>
            <div className="value">{stats.rdvAujourdhui}</div>
          </div>
          <div className="stat-card">
            <div className="label">Patients actifs</div>
            <div className="value">{stats.patientsTotal}</div>
          </div>
          <div className="stat-card">
            <div className="label">Consultations ce mois</div>
            <div className="value">{stats.consultationsMois}</div>
          </div>
          <div className="stat-card">
            <div className="label">Revenus du mois</div>
            <div className="value">{formatMAD(stats.revenusMois)}</div>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="section-title">Prochains rendez-vous du jour</div>
            {stats.prochainRdv.length === 0 ? (
              <div className="empty-state">Aucun rendez-vous à venir aujourd'hui.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>Patient</th>
                    <th>Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.prochainRdv.map((r) => (
                    <tr key={r.id}>
                      <td>{r.heure}</td>
                      <td>
                        {r.patient_prenom} {r.patient_nom}
                      </td>
                      <td className="muted">{r.motif || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 14 }}>
              <Link className="btn btn-secondary btn-sm" to="/rendez-vous">
                Voir l'agenda complet →
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Facturation</div>
            <div className="grid grid-2">
              <div>
                <div className="label" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Factures en attente
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.facturesEnAttente}</div>
              </div>
              <div>
                <div className="label" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Montant à recouvrer
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--warning)" }}>
                  {formatMAD(stats.montantEnAttente)}
                </div>
              </div>
            </div>

            <div className="section-title" style={{ marginTop: 20 }}>
              Répartition des patients par couverture
            </div>
            {stats.repartitionMutuelle.map((m) => (
              <div key={m.mutuelle} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 }}>
                <span>{m.mutuelle}</span>
                <span style={{ fontWeight: 600 }}>{m.total}</span>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <Link className="btn btn-secondary btn-sm" to="/facturation">
                Voir la facturation →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
