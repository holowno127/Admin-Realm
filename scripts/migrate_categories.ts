import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("Adding categories array column to events table...");
  try {
    // 1. Add new array column defaulting to empty array
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}'`);
    
    // 2. Migrate existing category data into the new array column
    await db.execute(sql`UPDATE events SET categories = ARRAY[category]::text[] WHERE category IS NOT NULL`);
    
    // 3. Drop the old category column
    await db.execute(sql`ALTER TABLE events DROP COLUMN IF EXISTS category`);
    
    console.log("Migration successful!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
