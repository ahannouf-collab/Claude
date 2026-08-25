import cors from "cors";
import express from "express";
import { seedIfEmpty } from "./seed.js";
import { m1Router } from "./routes/m1.js";
import { m2Router } from "./routes/m2.js";
import { m3Router } from "./routes/m3.js";
import { m4Router } from "./routes/m4.js";
import { m5Router } from "./routes/m5.js";
import { m6Router } from "./routes/m6.js";
import { m7Router } from "./routes/m7.js";
import { m8Router } from "./routes/m8.js";
import { m9Router } from "./routes/m9.js";
import { lovRouter } from "./routes/lov.js";

seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

app.use("/api/lov", lovRouter);
app.use("/api/m1", m1Router);
app.use("/api/m2", m2Router);
app.use("/api/m3", m3Router);
app.use("/api/m4", m4Router);
app.use("/api/m5", m5Router);
app.use("/api/m6", m6Router);
app.use("/api/m7", m7Router);
app.use("/api/m8", m8Router);
app.use("/api/m9", m9Router);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`SFD FCUBS API listening on http://localhost:${PORT}`);
});
