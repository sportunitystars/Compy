import { pgTable, text, integer, timestamp, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const habitLogsTable = pgTable(
  "habit_logs",
  {
    id: serial("id").primaryKey(),
    habitId: integer("habit_id").notNull(),
    userId: integer("user_id").notNull(),
    date: text("date").notNull(),
    optionIndex: integer("option_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("habit_logs_habit_date_unique").on(table.habitId, table.date)]
);

export const insertHabitLogSchema = createInsertSchema(habitLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertHabitLog = z.infer<typeof insertHabitLogSchema>;
export type HabitLog = typeof habitLogsTable.$inferSelect;
