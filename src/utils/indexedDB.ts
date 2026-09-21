const DB_NAME = "neossus_audit_db_v2";
const DB_VERSION = 1;
const STORE_NAME = "faturamento_store";

export const CHUNK_SIZE = 25000;

export interface SlotMeta {
  name: string;
  totalRecords: number;
  numChunks: number;
  slotId: number;
}

export interface StorageManifest {
  version: number;
  slotNames: (string | null)[];
  selectedProcedure?: string | null;
  updatedAt: number;
}

function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a single slot's records in chunked form directly to IndexedDB.
 * This guarantees instantaneous persistence as soon as a CSV finishes parsing,
 * without needing to clone or re-serialize the other slots.
 */
export async function saveSlotToIndexedDB(
  slotIndex: number,
  records: any[],
  fileName: string,
  selectedProcedure?: string | null
): Promise<void> {
  const db = await getIndexedDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Read previous meta to remove leftover chunks if previous file had more chunks
    const reqPrevMeta = store.get(`slot_${slotIndex}_meta`);
    reqPrevMeta.onsuccess = () => {
      const prevMeta = reqPrevMeta.result as SlotMeta | undefined;
      const prevNumChunks = prevMeta?.numChunks || 0;

      const numChunks = Math.ceil(records.length / CHUNK_SIZE);

      // Clean up previous extra chunks
      for (let c = numChunks; c < prevNumChunks; c++) {
        store.delete(`slot_${slotIndex}_chunk_${c}`);
      }

      // Write each chunk
      for (let c = 0; c < numChunks; c++) {
        const start = c * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, records.length);
        const chunk = records.slice(start, end);
        store.put(chunk, `slot_${slotIndex}_chunk_${c}`);
      }

      // Write slot metadata
      const meta: SlotMeta = {
        name: fileName,
        totalRecords: records.length,
        numChunks,
        slotId: slotIndex + 1,
      };
      store.put(meta, `slot_${slotIndex}_meta`);

      // Read current manifest to update slotNames
      const reqManifest = store.get("manifest");
      reqManifest.onsuccess = () => {
        const currentManifest = (reqManifest.result as StorageManifest) || {
          version: 2,
          slotNames: [null, null, null],
          updatedAt: Date.now(),
        };

        const updatedSlots = [...(currentManifest.slotNames || [null, null, null])];
        while (updatedSlots.length <= slotIndex) {
          updatedSlots.push(null);
        }
        updatedSlots[slotIndex] = fileName;

        const newManifest: StorageManifest = {
          version: 2,
          slotNames: updatedSlots,
          selectedProcedure: selectedProcedure !== undefined ? selectedProcedure : currentManifest.selectedProcedure,
          updatedAt: Date.now(),
        };
        store.put(newManifest, "manifest");
      };
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("IndexedDB transaction aborted during saveSlotToIndexedDB"));
  });
}

/**
 * Deletes a single slot and all its chunked records from IndexedDB.
 */
export async function deleteSlotFromIndexedDB(
  slotIndex: number,
  remainingSlotNames?: (string | null)[]
): Promise<void> {
  const db = await getIndexedDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const reqMeta = store.get(`slot_${slotIndex}_meta`);
    reqMeta.onsuccess = () => {
      const meta = reqMeta.result as SlotMeta | undefined;
      if (meta && meta.numChunks > 0) {
        for (let c = 0; c < meta.numChunks; c++) {
          store.delete(`slot_${slotIndex}_chunk_${c}`);
        }
      }
      store.delete(`slot_${slotIndex}_meta`);

      const reqManifest = store.get("manifest");
      reqManifest.onsuccess = () => {
        const currentManifest = (reqManifest.result as StorageManifest) || {
          version: 2,
          slotNames: [null, null, null],
          updatedAt: Date.now(),
        };

        let updatedSlots = remainingSlotNames
          ? [...remainingSlotNames]
          : [...(currentManifest.slotNames || [null, null, null])];
        if (updatedSlots[slotIndex] !== undefined) {
          updatedSlots[slotIndex] = null;
        }

        const newManifest: StorageManifest = {
          version: 2,
          slotNames: updatedSlots,
          selectedProcedure: currentManifest.selectedProcedure,
          updatedAt: Date.now(),
        };
        store.put(newManifest, "manifest");
      };
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Saves all database records chunked by slot.
 * Safe for millions of rows by splitting each slot into max 25,000-record chunks.
 */
export async function saveToIndexedDB(
  dbData: any[],
  slotNamesOrFileName: (string | null)[] | string | null,
  selectedProcedure: string
): Promise<void> {
  const db = await getIndexedDB();

  let slotNames: (string | null)[] = [null, null, null];
  if (Array.isArray(slotNamesOrFileName)) {
    slotNames = [...slotNamesOrFileName];
  } else if (typeof slotNamesOrFileName === "string" && slotNamesOrFileName.trim() !== "") {
    if (slotNamesOrFileName.includes(" + ")) {
      const parts = slotNamesOrFileName.split(" + ");
      slotNames = [parts[0] || null, parts[1] || null, parts[2] || null];
    } else {
      slotNames = [slotNamesOrFileName, null, null];
    }
  }

  // Partition dbData by _slotId
  const slotGroups: any[][] = [[], [], []];
  for (let i = 0; i < dbData.length; i++) {
    const record = dbData[i];
    const sId = (record._slotId && record._slotId >= 1 && record._slotId <= 3) ? (record._slotId - 1) : 0;
    slotGroups[sId].push(record);
  }

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Save each slot
    for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
      const records = slotGroups[slotIndex];
      const slotName = slotNames[slotIndex];

      if (records.length > 0) {
        const numChunks = Math.ceil(records.length / CHUNK_SIZE);
        for (let c = 0; c < numChunks; c++) {
          const start = c * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, records.length);
          const chunk = records.slice(start, end);
          store.put(chunk, `slot_${slotIndex}_chunk_${c}`);
        }

        const meta: SlotMeta = {
          name: slotName || `Base ${slotIndex + 1}`,
          totalRecords: records.length,
          numChunks,
          slotId: slotIndex + 1,
        };
        store.put(meta, `slot_${slotIndex}_meta`);
      } else if (!slotName) {
        // If slot is empty and has no name, clear its chunks
        store.delete(`slot_${slotIndex}_meta`);
      }
    }

    // Save manifest
    const manifest: StorageManifest = {
      version: 2,
      slotNames,
      selectedProcedure,
      updatedAt: Date.now(),
    };
    store.put(manifest, "manifest");

    // Clear any obsolete single-blob legacy entry to free quota
    store.delete("db");

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Transaction aborted during saveToIndexedDB"));
  });
}

/**
 * Loads all slots from IndexedDB, reconstructing the consolidated dataset
 * and preserving each slot's metadata, record count, and filenames.
 */
export async function loadFromIndexedDB(): Promise<{
  db: any[];
  slotNames: (string | null)[];
  fileName: string | null;
  selectedProcedure: string | null;
} | null> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const reqManifest = store.get("manifest");
    const reqMeta0 = store.get("slot_0_meta");
    const reqMeta1 = store.get("slot_1_meta");
    const reqMeta2 = store.get("slot_2_meta");
    const reqLegacyDb = store.get("db");
    const reqLegacyFile = store.get("fileName");
    const reqLegacyProc = store.get("selectedProcedure");

    tx.oncomplete = async () => {
      const manifest = reqManifest.result as StorageManifest | undefined;
      const meta0 = reqMeta0.result as SlotMeta | undefined;
      const meta1 = reqMeta1.result as SlotMeta | undefined;
      const meta2 = reqMeta2.result as SlotMeta | undefined;

      const metas = [meta0, meta1, meta2];
      const hasChunkedData = metas.some((m) => m && m.numChunks > 0);

      if (hasChunkedData) {
        try {
          // Read all chunks in a second fast transaction
          const readTx = db.transaction(STORE_NAME, "readonly");
          const readStore = readTx.objectStore(STORE_NAME);

          const slotRecords: any[][] = [[], [], []];
          const promises: Promise<void>[] = [];

          for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
            const m = metas[slotIndex];
            if (m && m.numChunks > 0) {
              for (let c = 0; c < m.numChunks; c++) {
                const chunkIndex = c;
                const p = new Promise<void>((resChunk, rejChunk) => {
                  const reqChunk = readStore.get(`slot_${slotIndex}_chunk_${chunkIndex}`);
                  reqChunk.onsuccess = () => {
                    if (Array.isArray(reqChunk.result)) {
                      slotRecords[slotIndex].push(...reqChunk.result);
                    }
                    resChunk();
                  };
                  reqChunk.onerror = () => rejChunk(reqChunk.error);
                });
                promises.push(p);
              }
            }
          }

          await Promise.all(promises);

          // Flatten and ensure _slotId is properly assigned
          const allRecords: any[] = [];
          const slotNames: (string | null)[] = [
            manifest?.slotNames?.[0] || meta0?.name || null,
            manifest?.slotNames?.[1] || meta1?.name || null,
            manifest?.slotNames?.[2] || meta2?.name || null,
          ];

          for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
            const records = slotRecords[slotIndex];
            for (let r = 0; r < records.length; r++) {
              const rec = records[r];
              if (!rec._slotId) {
                rec._slotId = slotIndex + 1;
              }
              allRecords.push(rec);
            }
          }

          const activeNames = slotNames.filter(Boolean) as string[];
          resolve({
            db: allRecords,
            slotNames,
            fileName: activeNames.length > 0 ? activeNames.join(" + ") : null,
            selectedProcedure: manifest?.selectedProcedure || null,
          });
          return;
        } catch (err) {
          console.warn("Failed to load chunked records:", err);
        }
      }

      // Fallback to legacy unchunked entry if present
      if (reqLegacyDb.result && Array.isArray(reqLegacyDb.result) && reqLegacyDb.result.length > 0) {
        const legacyFile = reqLegacyFile.result || null;
        let slotNames: (string | null)[] = [null, null, null];
        if (legacyFile) {
          if (legacyFile.includes(" + ")) {
            const parts = legacyFile.split(" + ");
            slotNames = [parts[0] || null, parts[1] || null, parts[2] || null];
          } else {
            slotNames = [legacyFile, null, null];
          }
        }
        resolve({
          db: reqLegacyDb.result,
          slotNames,
          fileName: legacyFile,
          selectedProcedure: reqLegacyProc.result || null,
        });
        return;
      }

      resolve(null);
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clears all data from IndexedDB completely.
 */
export async function clearIndexedDB(): Promise<void> {
  const db = await getIndexedDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
