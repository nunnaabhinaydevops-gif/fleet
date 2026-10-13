import admin from "firebase-admin";
import fs from "fs";

admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
});

const db = admin.firestore();

async function bulkImportAuditLogs() {
  const filePath = "./scripts/auditLogs.json";

  if (!fs.existsSync(filePath)) {
    throw new Error("auditLogs.json not found.");
  }

  console.log("Loading auditLogs.json...");

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = Object.entries(data);

  console.log(`Loaded ${entries.length} audit logs\n`);

  const batchSize = 500;
  let success = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = db.batch();

    const chunk = entries.slice(i, i + batchSize);

    chunk.forEach(([auditLogId, auditLog]) => {
      const ref = db
        .collection("auditLogs")
        .doc(String(auditLogId));

      batch.set(ref, {
        ...auditLog,
        id: String(auditLogId),
      });
    });

    await batch.commit();

    success += chunk.length;

    console.log(`✓ Imported ${success}/${entries.length}`);
  }

  console.log("\n==========================");
  console.log("Audit Log Import Complete");
  console.log("==========================");
  console.log(`Audit Logs Imported : ${success}`);
}

bulkImportAuditLogs().catch((err) => {
  console.error("\nImport failed:");
  console.error(err);
  process.exit(1);
});