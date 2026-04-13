import { pgTable, text } from "drizzle-orm/pg-core";

export const userPins = pgTable("user_pins", {
  supabaseUserId: text("supabase_user_id").primaryKey(),
  pinHash: text("pin_hash").notNull(),
});
