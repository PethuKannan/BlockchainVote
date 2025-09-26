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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private elections: Map<string, Election>;
  private votes: Map<string, Vote>;
  private blocks: Map<string, VotingBlock>;

  constructor() {
    this.users = new Map();
    this.elections = new Map();
    this.votes = new Map();
    this.blocks = new Map();
    
    // Initialize with a sample election
    this.initializeData();
  }

  private initializeData() {
    const sampleElection: Election = {
      id: randomUUID(),
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
      createdAt: new Date(),
    };
    
    this.elections.set(sampleElection.id, sampleElection);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      totpSecret: null,
      totpEnabled: false,
      faceDescriptor: null,
      faceEnabled: false,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getElections(): Promise<Election[]> {
    return Array.from(this.elections.values());
  }

  async getElection(id: string): Promise<Election | undefined> {
    return this.elections.get(id);
  }

  async createElection(election: Omit<Election, 'id' | 'createdAt'>): Promise<Election> {
    const id = randomUUID();
    const newElection: Election = {
      ...election,
      id,
      createdAt: new Date(),
    };
    this.elections.set(id, newElection);
    return newElection;
  }

  async getVotes(electionId: string): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(vote => vote.electionId === electionId);
  }

  async createVote(vote: Omit<Vote, 'id' | 'timestamp'>): Promise<Vote> {
    const id = randomUUID();
    const newVote: Vote = {
      ...vote,
      id,
      timestamp: new Date(),
    };
    this.votes.set(id, newVote);
    return newVote;
  }

  async getUserVote(userId: string, electionId: string): Promise<Vote | undefined> {
    return Array.from(this.votes.values()).find(
      vote => vote.userId === userId && vote.electionId === electionId
    );
  }

  async getLatestBlock(): Promise<VotingBlock | undefined> {
    const blocks = Array.from(this.blocks.values());
    return blocks.sort((a, b) => b.blockNumber - a.blockNumber)[0];
  }

  async createBlock(block: Omit<VotingBlock, 'id' | 'timestamp'>): Promise<VotingBlock> {
    const id = randomUUID();
    const newBlock: VotingBlock = {
      ...block,
      id,
      timestamp: new Date(),
    };
    this.blocks.set(id, newBlock);
    return newBlock;
  }

  async getBlocks(): Promise<VotingBlock[]> {
    return Array.from(this.blocks.values()).sort((a, b) => a.blockNumber - b.blockNumber);
  }
}

export const storage = new MemStorage();
