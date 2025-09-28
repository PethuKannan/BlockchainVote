import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").default(false),
  faceDescriptor: jsonb("face_descriptor"),
  faceEnabled: boolean("face_enabled").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const elections = pgTable("elections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  candidates: jsonb("candidates").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  electionId: varchar("election_id").notNull().references(() => elections.id),
  candidateId: text("candidate_id").notNull(),
  blockHash: text("block_hash").notNull(),
  previousHash: text("previous_hash").notNull(),
  timestamp: timestamp("timestamp").default(sql`now()`),
  nonce: integer("nonce").notNull(),
});

export const votingBlocks = pgTable("voting_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockNumber: integer("block_number").notNull().unique(),
  hash: text("hash").notNull().unique(),
  previousHash: text("previous_hash").notNull(),
  votes: jsonb("votes").notNull(),
  timestamp: timestamp("timestamp").default(sql`now()`),
  nonce: integer("nonce").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
}).extend({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  fullName: z.string().min(1, "Full name is required"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().optional(),
});

export const totpSetupSchema = z.object({
  token: z.string().length(6, "TOTP code must be 6 digits").regex(/^\d{6}$/, "TOTP code must be numeric"),
});

export const faceEnrollSchema = z.object({
  faceDescriptor: z.array(z.number()).min(128, "Face descriptor must have at least 128 dimensions"),
});

export const faceVerifySchema = z.object({
  faceDescriptor: z.array(z.number()).min(128, "Face descriptor must have at least 128 dimensions"),
});

export const voteSchema = z.object({
  electionId: z.string().min(1, "Election ID is required"),
  candidateId: z.string().min(1, "Candidate ID is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginData = z.infer<typeof loginSchema>;
export type TOTPSetup = z.infer<typeof totpSetupSchema>;
export type FaceEnroll = z.infer<typeof faceEnrollSchema>;
export type FaceVerify = z.infer<typeof faceVerifySchema>;
export type Vote = typeof votes.$inferSelect;
export type Election = typeof elections.$inferSelect;
export type VotingBlock = typeof votingBlocks.$inferSelect;
