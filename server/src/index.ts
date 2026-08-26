import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedIfEmpty } from "./seed.js";
import { m01Router } from "./routes/m01.js";
import { m02Router } from "./routes/m02.js";
import { m03Router } from "./routes/m03.js";
import { m04Router } from "./routes/m04.js";
import { m05Router } from "./routes/m05.js";
import { m06Router } from "./routes/m06.js";
import { m07Router } from "./routes/m07.js";
import { m08Router } from "./routes/m08.js";
import { m09Router } from "./routes/m09.js";
import { lovRouter } from "./routes/lov.js";

seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

app.use("/api/lov", lovRouter);
app.use("/api/m01", m01Router);
app.use("/api/m02", m02Router);
app.use("/api/m03", m03Router);
app.use("/api/m04", m04Router);
app.use("/api/m05", m05Router);
app.use("/api/m06", m06Router);
app.use("/api/m07", m07Router);
app.use("/api/m08", m08Router);
app.use("/api/m09", m09Router);

// En production, l'image Docker embarque le build client (client/dist) à côté
// du serveur compilé : on le sert en statique avec un fallback SPA.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`SFD Déshérence API listening on http://localhost:${PORT}`);
});
