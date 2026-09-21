import express from "express";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import { createServer as createViteServer } from "vite";
import {
  getFixedDataset,
  getDatasetStatus,
  saveFixedDataset,
  deleteFixedDataset,
  deleteSlotDataset,
  getSlotGzPath,
  getSlotJsonPath,
  getSlotCompactGzPath,
  getSlotCompactJsonPath,
  parseRawCsvToRecords,
  startChunkedUpload,
  appendChunk,
  finishChunkedUpload,
  ingestCsvFileToSlot,
  queryProcedureRecords,
  queryHospitalsComparison,
  computeHospitalComparison,
  ensureSqliteSync,
} from "./server/datasetService.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Auto-verify and sync SQLite index with all persisted slots
  ensureSqliteSync().catch((err) => {
    console.warn("Background SQLite sync notice:", err);
  });

  // Health check endpoint (checked by platform & control plane)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Middleware with reasonable body limit for chunked JSON payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Status check endpoint (instantaneous, returns file size and record counts)
  app.get("/api/dataset/status", (_req, res) => {
    try {
      const status = getDatasetStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao verificar status da base fixa" });
    }
  });

  // Query records for a specific procedure from central SQLite index (sub-millisecond, low memory)
  app.get("/api/dataset/procedure", (req, res) => {
    try {
      const name = req.query.name as string;
      if (!name) {
        return res.status(400).json({ error: "Parâmetro 'name' é obrigatório" });
      }
      const data = queryProcedureRecords(name);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao consultar procedimento" });
    }
  });

  // Query records for two hospitals in the comparative view from central SQLite index
  app.get("/api/dataset/hospitals-compare", (req, res) => {
    try {
      const hospA = req.query.hospA as string;
      const hospB = req.query.hospB as string;
      if (!hospA || !hospB) {
        return res.status(400).json({ error: "hospA e hospB são obrigatórios" });
      }
      const data = queryHospitalsComparison(hospA, hospB);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao consultar comparativo de hospitais" });
    }
  });

  // Server-side Aggregated Comparison for AdvancedHospitalComparator
  const handleComparisonRequest = (req: express.Request, res: express.Response) => {
    try {
      const hospA = (req.query.hospA || req.query.hospitalA) as string;
      const hospB = (req.query.hospB || req.query.hospitalB) as string;
      const year = (req.query.year || req.query.ano || "Todos") as string;
      if (!hospA || !hospB) {
        return res.status(400).json({ error: "hospA e hospB são parâmetros obrigatórios" });
      }
      const comparisonData = computeHospitalComparison(hospA, hospB, year);
      res.json(comparisonData);
    } catch (error: any) {
      console.error("Erro no processamento comparativo server-side:", error);
      res.status(500).json({ error: error.message || "Erro interno ao processar comparativo" });
    }
  };

  app.get("/api/compare", handleComparisonRequest);
  app.get("/api/dataset/compare", handleComparisonRequest);

  // Chunked upload: Step 1 - Start session
  app.post("/api/dataset/start", (req, res) => {
    try {
      const { uploadId, fileName, slotIndex } = req.body;
      if (!uploadId) {
        return res.status(400).json({ error: "uploadId é obrigatório" });
      }
      startChunkedUpload(uploadId, fileName || "base_hucm_fixa.csv", slotIndex);
      res.json({ success: true, uploadId });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao iniciar envio em lotes" });
    }
  });

  // Chunked upload: Step 2 - Append chunk (e.g. 25,000 records)
  app.post("/api/dataset/chunk", (req, res) => {
    try {
      const { uploadId, chunk } = req.body;
      if (!uploadId || !chunk) {
        return res.status(400).json({ error: "uploadId e chunk são obrigatórios" });
      }
      const totalAccumulated = appendChunk(uploadId, chunk);
      res.json({ success: true, totalAccumulated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao processar lote" });
    }
  });

  // Chunked upload: Step 3 - Finalize session, index and compress
  app.post("/api/dataset/finish", async (req, res) => {
    try {
      const { uploadId } = req.body;
      if (!uploadId) {
        return res.status(400).json({ error: "uploadId é obrigatório" });
      }
      const metadata = await finishChunkedUpload(uploadId);
      res.json({ success: true, metadata });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao finalizar envio" });
    }
  });

  // Raw binary chunked upload for large CSV files (bypasses reverse proxy 413 limits completely)
  app.post("/api/dataset/upload-raw-chunk", (req, res) => {
    try {
      const uploadId = req.query.uploadId as string;
      const chunkIndex = parseInt(req.query.chunkIndex as string, 10);
      if (!uploadId || isNaN(chunkIndex)) {
        return res.status(400).json({ error: "uploadId e chunkIndex são obrigatórios" });
      }

      const tempDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, "");
      const tempPath = path.join(tempDir, `temp_upload_${safeUploadId}.csv`);

      const fileStream = fs.createWriteStream(tempPath, {
        flags: chunkIndex === 0 ? "w" : "a",
      });

      req.pipe(fileStream);

      fileStream.on("finish", () => {
        res.json({ success: true, chunkIndex });
      });

      fileStream.on("error", (err) => {
        console.error("Error writing raw chunk:", err);
        res.status(500).json({ error: "Erro ao gravar bloco: " + err.message });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro no upload do bloco" });
    }
  });

  app.post("/api/dataset/upload-raw-finish", async (req, res) => {
    try {
      const { uploadId, fileName, slotIndex } = req.body;
      if (!uploadId) {
        return res.status(400).json({ error: "uploadId é obrigatório" });
      }

      const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_-]/g, "");
      const tempDir = path.join(process.cwd(), "data");
      const tempPath = path.join(tempDir, `temp_upload_${safeUploadId}.csv`);

      if (!fs.existsSync(tempPath)) {
        return res.status(404).json({ error: "Arquivo temporário não encontrado no servidor" });
      }

      const sIdx = slotIndex !== undefined ? parseInt(String(slotIndex), 10) : 0;
      const cleanFileName = fileName || `base_${sIdx + 1}.csv`;

      try {
        const metadata = await ingestCsvFileToSlot(tempPath, cleanFileName, sIdx);
        res.json({ success: true, metadata, slotIndex: sIdx });
      } finally {
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
        }
      }
    } catch (error: any) {
      console.error("Error finalizing raw upload:", error);
      res.status(500).json({ error: error.message || "Erro ao processar e indexar CSV no Banco Central" });
    }
  });

  // Direct streaming CSV upload to a specific slot (fallback for smaller files)
  app.post("/api/dataset/upload-file", (req, res) => {
    try {
      const slotIndex = req.query.slotIndex !== undefined ? parseInt(req.query.slotIndex as string, 10) : 0;
      const rawFileName = (req.query.fileName as string) || (slotIndex !== undefined ? `base_${slotIndex + 1}.csv` : "base_hucm_fixa.csv");
      const fileName = decodeURIComponent(rawFileName);

      const tempDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempPath = path.join(tempDir, `temp_upload_${Date.now()}_${Math.random().toString(36).substring(7)}.csv`);
      const fileStream = fs.createWriteStream(tempPath);

      req.pipe(fileStream);

      fileStream.on("finish", async () => {
        try {
          const metadata = await ingestCsvFileToSlot(tempPath, fileName, slotIndex);
          res.json({ success: true, metadata, slotIndex });
        } catch (procErr: any) {
          console.error("Error processing streamed CSV:", procErr);
          res.status(500).json({ error: procErr.message || "Erro ao processar e indexar CSV no Banco Central" });
        } finally {
          if (fs.existsSync(tempPath)) {
            try {
              fs.unlinkSync(tempPath);
            } catch {}
          }
        }
      });

      fileStream.on("error", (streamErr) => {
        console.error("Stream write error:", streamErr);
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
        }
        res.status(500).json({ error: "Falha na transmissão do arquivo: " + streamErr.message });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao iniciar recepção do arquivo" });
    }
  });

  // API Routes - Get specific slot stream (e.g. slot 0 = Base 1)
  app.get("/api/dataset/slot/:slotIndex", (req, res) => {
    try {
      const slotIndex = parseInt(req.params.slotIndex, 10);
      const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");

      const compactGz = getSlotCompactGzPath(slotIndex);
      const compactJson = getSlotCompactJsonPath(slotIndex);

      if (fs.existsSync(compactGz)) {
        res.setHeader("Content-Type", "application/json");
        if (acceptsGzip) {
          res.setHeader("Content-Encoding", "gzip");
          return fs.createReadStream(compactGz).pipe(res);
        }
        return fs.createReadStream(compactGz).pipe(zlib.createGunzip()).pipe(res);
      }

      if (fs.existsSync(compactJson)) {
        res.setHeader("Content-Type", "application/json");
        return fs.createReadStream(compactJson).pipe(res);
      }

      let gzPath = getSlotGzPath(slotIndex);
      let jsonPath = getSlotJsonPath(slotIndex);

      if (!fs.existsSync(gzPath) && !fs.existsSync(jsonPath) && slotIndex === 0) {
        const legacyGz = path.join(process.cwd(), "data", "fixed_database.json.gz");
        const legacyJson = path.join(process.cwd(), "data", "fixed_database.json");
        if (fs.existsSync(legacyGz)) gzPath = legacyGz;
        if (fs.existsSync(legacyJson)) jsonPath = legacyJson;
      }

      if (fs.existsSync(gzPath) && acceptsGzip) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Encoding", "gzip");
        return fs.createReadStream(gzPath).pipe(res);
      }

      if (fs.existsSync(jsonPath)) {
        res.setHeader("Content-Type", "application/json");
        return fs.createReadStream(jsonPath).pipe(res);
      }

      if (fs.existsSync(gzPath)) {
        res.setHeader("Content-Type", "application/json");
        return fs.createReadStream(gzPath).pipe(zlib.createGunzip()).pipe(res);
      }

      res.status(404).json({ error: `Slot ${slotIndex + 1} não encontrado no servidor.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao ler slot da base fixa" });
    }
  });

  app.delete("/api/dataset/slot/:slotIndex", (req, res) => {
    try {
      const slotIndex = parseInt(req.params.slotIndex, 10);
      const deleted = deleteSlotDataset(slotIndex);
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao excluir slot da base fixa" });
    }
  });

  // API Routes - Get dataset (supporting compressed stream when available)
  app.get("/api/dataset", (req, res) => {
    try {
      const compactGz = path.join(process.cwd(), "data", "fixed_database.compact.json.gz");
      const compactJson = path.join(process.cwd(), "data", "fixed_database.compact.json");
      const slot0CompactGz = getSlotCompactGzPath(0);
      const slot0CompactJson = getSlotCompactJsonPath(0);
      const gzPath = path.join(process.cwd(), "data", "fixed_database.json.gz");
      const jsonPath = path.join(process.cwd(), "data", "fixed_database.json");
      const slot0Gz = getSlotGzPath(0);
      const slot0Json = getSlotJsonPath(0);

      // Check if client accepts gzip and we have the gzipped file
      const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");

      // Prioritize compact format for fastest transmission and lowest memory
      const targetCompactGz = fs.existsSync(compactGz) ? compactGz : (fs.existsSync(slot0CompactGz) ? slot0CompactGz : null);
      const targetCompactJson = fs.existsSync(compactJson) ? compactJson : (fs.existsSync(slot0CompactJson) ? slot0CompactJson : null);

      if (targetCompactGz && acceptsGzip) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Encoding", "gzip");
        return fs.createReadStream(targetCompactGz).pipe(res);
      }

      if (targetCompactJson) {
        res.setHeader("Content-Type", "application/json");
        return fs.createReadStream(targetCompactJson).pipe(res);
      }

      if (targetCompactGz) {
        res.setHeader("Content-Type", "application/json");
        return fs.createReadStream(targetCompactGz).pipe(zlib.createGunzip()).pipe(res);
      }

      const targetGz = fs.existsSync(gzPath) ? gzPath : (fs.existsSync(slot0Gz) ? slot0Gz : null);
      const targetJson = fs.existsSync(jsonPath) ? jsonPath : (fs.existsSync(slot0Json) ? slot0Json : null);

      if (targetGz && acceptsGzip) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Encoding", "gzip");
        return fs.createReadStream(targetGz).pipe(res);
      }

      if (targetJson) {
        res.setHeader("Content-Type", "application/json");
        return fs.createReadStream(targetJson).pipe(res);
      }

      if (targetGz) {
        res.setHeader("Content-Type", "application/json");
        return fs.createReadStream(targetGz).pipe(zlib.createGunzip()).pipe(res);
      }

      const result = getFixedDataset();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao ler base fixa" });
    }
  });

  app.post("/api/dataset", (req, res) => {
    try {
      const { records, csvContent, fileName } = req.body;
      let finalRecords = records;

      if (!finalRecords && csvContent) {
        finalRecords = parseRawCsvToRecords(csvContent);
      }

      if (!finalRecords || !Array.isArray(finalRecords) || finalRecords.length === 0) {
        return res.status(400).json({ error: "Nenhum registro válido fornecido." });
      }

      const metadata = saveFixedDataset(finalRecords, fileName || "base_hucm_fixa.csv");
      res.json({ success: true, metadata, count: finalRecords.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao salvar base fixa" });
    }
  });

  app.delete("/api/dataset", (_req, res) => {
    try {
      const deleted = deleteFixedDataset();
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao excluir base fixa" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer();
