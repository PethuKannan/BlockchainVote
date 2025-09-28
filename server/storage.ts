import { type User, type InsertUser, type Election, type Vote, type VotingBlock } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Election operations
  getElections(): Promise<Election[]>;
  getElection(id: string): Promise<Election | undefined>;
  createElection(election: Omit<Election, 'id' | 'createdAt'>): Promise<Election>;
  
  // Vote operations
  getVotes(electionId: string): Promise<Vote[]>;
  createVote(vote: Omit<Vote, 'id' | 'timestamp'>): Promise<Vote>;
  getUserVote(userId: string, electionId: string): Promise<Vote | undefined>;
  
  // Blockchain operations
  getLatestBlock(): Promise<VotingBlock | undefined>;
  createBlock(block: Omit<VotingBlock, 'id' | 'timestamp'>): Promise<VotingBlock>;
  getBlocks(): Promise<VotingBlock[]>;
}

// Legacy MemStorage class removed - now using permanent PostgreSQL database

import { DatabaseStorage } from './dbStorage';

// Create and initialize database storage
const databaseStorage = new DatabaseStorage();

// Initialize with sample data if empty
databaseStorage.initializeIfEmpty().catch(console.error);

export const storage: IStorage = databaseStorage;
