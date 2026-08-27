import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

const NAV_ITEMS = [
  { to: "/", label: "Tableau de bord", icon: "📊", end: true },
  { to: "/patients", label: "Patients", icon: "🧑‍🤝‍🧑" },
  { to: "/rendez-vous", label: "Rendez-vous", icon: "📅" },
  { to: "/consultations", label: "Consultations", icon: "🩺" },
  { to: "/facturation", label: "Facturation", icon: "💰" },
  { to: "/parametres", label: "Paramètres", icon: "⚙️" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Cabinet Médical
          <small>Gestion de cabinet — Maroc</small>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-name">{user?.full_name}</div>
          <div className="user-role">{roleLabel(user?.role)}</div>
          <button onClick={logout}>Se déconnecter</button>
        </div>
      </aside>
      <div className="main-area">
        <Outlet />
      </div>
    </div>
  );
}

function roleLabel(role?: string) {
  switch (role) {
    case "admin":
      return "Administrateur";
    case "medecin":
      return "Médecin";
    case "secretaire":
      return "Secrétaire";
    default:
      return "";
  }
}
