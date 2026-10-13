import admin from "firebase-admin";
import fs from "fs";

admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
});

const db = admin.firestore();

async function bulkImportTrips() {
  const filePath = "./scripts/trips.json";

  if (!fs.existsSync(filePath)) {
    throw new Error("trips.json not found.");
  }

  console.log("Loading trips.json...");

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = Object.entries(data);

  console.log(`Loaded ${entries.length} trips\n`);

  const batchSize = 500;
  let success = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = db.batch();

    const chunk = entries.slice(i, i + batchSize);

    chunk.forEach(([tripId, trip]) => {
      const ref = db.collection("trips").doc(String(tripId));

      batch.set(ref, {
        ...trip,
        id: String(tripId),
      });
    });

    await batch.commit();

    success += chunk.length;

    console.log(`✓ Imported ${success}/${entries.length}`);
  }

  console.log("\n==========================");
  console.log("Import Complete");
  console.log("==========================");
  console.log(`Trips Imported : ${success}`);
}

bulkImportTrips().catch((err) => {
  console.error("\nImport failed:");
  console.error(err);
  process.exit(1);
});