import { eq, and, desc } from 'drizzle-orm';
import { db, users, elections, votes, votingBlocks } from './db';
import { type User, type InsertUser, type Election, type Vote, type VotingBlock } from "@shared/schema";
import { randomUUID } from "crypto";

import { IStorage } from './storage';

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser = {
      ...insertUser,
      id,
      totpSecret: null,
      totpEnabled: false,
      faceDescriptor: null,
      faceEnabled: false,
      createdAt: new Date(),
    };
    
    await db.insert(users).values(newUser);
    return newUser as User;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    
    return result[0] || undefined;
  }

  // Election operations
  async getElections(): Promise<Election[]> {
    return await db.select().from(elections);
  }

  async getElection(id: string): Promise<Election | undefined> {
    const result = await db.select().from(elections).where(eq(elections.id, id)).limit(1);
    return result[0] || undefined;
  }

  async createElection(election: Omit<Election, 'id' | 'createdAt'>): Promise<Election> {
    const id = randomUUID();
    const newElection = {
      ...election,
      id,
      createdAt: new Date(),
    };
    
    await db.insert(elections).values(newElection);
    return newElection as Election;
  }

  // Vote operations
  async getVotes(electionId: string): Promise<Vote[]> {
    return await db.select().from(votes).where(eq(votes.electionId, electionId));
  }

  async createVote(vote: Omit<Vote, 'id' | 'timestamp'>): Promise<Vote> {
    const id = randomUUID();
    const newVote = {
      ...vote,
      id,
      timestamp: new Date(),
    };
    
    await db.insert(votes).values(newVote);
    return newVote as Vote;
  }

  async getUserVote(userId: string, electionId: string): Promise<Vote | undefined> {
    const result = await db.select().from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.electionId, electionId)))
      .limit(1);
    
    return result[0] || undefined;
  }

  // Blockchain operations
  async getLatestBlock(): Promise<VotingBlock | undefined> {
    const result = await db.select().from(votingBlocks)
      .orderBy(desc(votingBlocks.blockNumber))
      .limit(1);
    
    return result[0] || undefined;
  }

  async createBlock(block: Omit<VotingBlock, 'id' | 'timestamp'>): Promise<VotingBlock> {
    const id = randomUUID();
    const newBlock = {
      ...block,
      id,
      timestamp: new Date(),
    };
    
    await db.insert(votingBlocks).values(newBlock);
    return newBlock as VotingBlock;
  }

  async getBlocks(): Promise<VotingBlock[]> {
    return await db.select().from(votingBlocks).orderBy(votingBlocks.blockNumber);
  }

  // Initialize with sample data if database is empty
  async initializeIfEmpty(): Promise<void> {
    const existingElections = await this.getElections();
    
    if (existingElections.length === 0) {
      const sampleElection: Omit<Election, 'id' | 'createdAt'> = {
        title: "2024 Student Council Election",
        description: "Vote for your student representative",
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true,
        candidates: [
          { id: "candidate-1", name: "Alice Johnson", party: "Progressive Party" },
          { id: "candidate-2", name: "Bob Smith", party: "Conservative Party" },
          { id: "candidate-3", name: "Carol Davis", party: "Independent" }
        ],
      };
      
      await this.createElection(sampleElection);
      console.log("✅ Database initialized with sample election data");
    }
  }
}