import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, totpSetupSchema, voteSchema, faceEnrollSchema, faceVerifySchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
// 1. IMPORT THE LOGGER
import { logger } from "./logger";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
const SALT_ROUNDS = 12;

interface AuthRequest extends Request {
  user?: any;
}

// JWT middleware
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    // SIEM LOG: Suspicious Token Usage
    logger.warn("Security Event: Invalid Token Used", {
      event: { category: "authentication", action: "token_validate_failed" },
      source: { ip: req.ip }
    });
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Blockchain simulation functions
function calculateHash(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function mineBlock(data: any, previousHash: string, difficulty: number = 2): { hash: string, nonce: number } {
  let nonce = 0;
  let hash: string;
  const target = Array(difficulty + 1).join("0");
  
  do {
    nonce++;
    hash = calculateHash({ ...data, previousHash, nonce });
  } while (hash.substring(0, difficulty) !== target);
  
  return { hash, nonce };
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });
      
      // Generate JWT
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      // SIEM LOG: New User Registered
      logger.info("Audit Event: User Registered", {
        event: { category: "iam", action: "user_create" },
        user: { id: user.id, name: user.username },
        source: { ip: req.ip }
      });

      res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          totpEnabled: user.totpEnabled,
        }
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, totpCode } = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        // SIEM LOG: Failed Login (Bad Username)
        logger.warn("Security Event: Failed Login (User Not Found)", {
           event: { category: "authentication", action: "login_failed" },
           user: { name: username },
           source: { ip: req.ip }
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        // SIEM LOG: Failed Login (Bad Password)
        logger.warn("Security Event: Failed Login (Bad Password)", {
           event: { category: "authentication", action: "login_failed" },
           user: { name: username },
           source: { ip: req.ip }
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Check if TOTP needs to be set up (first time login)
      if (!user.totpEnabled) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({
          message: "TOTP setup required",
          token,
          requiresTotpSetup: true,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            totpEnabled: false,
            faceEnabled: user.faceEnabled,
          }
        });
      }
      
      // Check TOTP if enabled
      if (user.totpEnabled && user.totpSecret) {
        if (!totpCode) {
          return res.status(401).json({ message: "TOTP code required", requiresTotp: true });
        }
        
        const verified = speakeasy.totp.verify({
          secret: user.totpSecret,
          encoding: 'base32',
          token: totpCode,
          window: 2, // Allow some time drift
        });
        
        if (!verified) {
          // SIEM LOG: Failed Login (Bad 2FA)
          logger.warn("Security Event: Failed Login (Invalid TOTP)", {
             event: { category: "authentication", action: "mfa_failed" },
             user: { name: username },
             source: { ip: req.ip }
          });
          return res.status(401).json({ message: "Invalid TOTP code" });
        }
      }
      
      // TOTP validated - check if face needs to be set up
      if (!user.faceEnabled) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({
          message: "Face recognition setup required",
          token,
          requiresFaceSetup: true,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            totpEnabled: user.totpEnabled,
            faceEnabled: false,
          }
        });
      }
      
      // All authentication methods enabled - return token and user info for face verification
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      res.json({
        message: "Credentials validated - face verification required",
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          totpEnabled: user.totpEnabled,
          faceEnabled: user.faceEnabled,
          faceDescriptor: user.faceDescriptor,
        }
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  app.get("/api/auth/setup-totp", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (user.totpEnabled) {
        return res.status(400).json({ message: "TOTP already enabled" });
      }
      
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `VoteChain (${user.username})`,
        issuer: 'VoteChain',
        length: 20,
      });
      
      // Store temporary secret (not yet enabled)
      await storage.updateUser(user.id, { totpSecret: secret.base32 });
      
      // Generate QR code
      const otpauthUrl = speakeasy.otpauthURL({
        secret: secret.base32,
        label: `VoteChain:${user.username}`,
        issuer: 'VoteChain',
        encoding: 'base32',
      });
      
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      
      res.json({
        secret: secret.base32,
        qrCode: qrCodeDataUrl,
        manualEntryKey: secret.base32,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to setup TOTP" });
    }
  });

  app.post("/api/auth/verify-totp", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      const { token } = totpSetupSchema.parse(req.body);
      
      if (!user.totpSecret) {
        return res.status(400).json({ message: "TOTP not initialized. Call setup-totp first." });
      }
      
      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: token,
        window: 2,
      });
      
      if (!verified) {
        return res.status(400).json({ message: "Invalid TOTP code" });
      }
      
      // Enable TOTP for user
      await storage.updateUser(user.id, { totpEnabled: true });
      
      // Generate backup codes (simple implementation)
      const backupCodes = Array.from({ length: 8 }, () => 
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );

      // SIEM LOG: MFA Enabled
      logger.info("Security Event: MFA Enabled", {
        event: { category: "iam", action: "mfa_enable" },
        user: { id: user.id },
      });
      
      res.json({
        message: "TOTP verified and enabled successfully",
        backupCodes,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "TOTP verification failed" });
    }
  });

  // Face enrollment route
  app.post("/api/auth/enroll-face", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      const { faceDescriptor } = faceEnrollSchema.parse(req.body);
      
      if (user.faceEnabled) {
        return res.status(400).json({ message: "Face recognition already enabled for this user" });
      }
      
      // Store the face descriptor
      await storage.updateUser(user.id, { 
        faceDescriptor: faceDescriptor,
        faceEnabled: true 
      });

      // SIEM LOG: Biometrics Enabled
      logger.info("Security Event: Face ID Enrolled", {
        event: { category: "iam", action: "biometric_enable" },
        user: { id: user.id },
      });
      
      res.json({
        message: "Face enrolled successfully",
        faceEnabled: true,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Face enrollment failed" });
    }
  });

  // Face verification route
  app.post("/api/auth/verify-face", async (req, res) => {
    try {
      const { username, faceDescriptor } = faceVerifySchema.extend({
        username: loginSchema.shape.username,
      }).parse(req.body);
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user || !user.faceEnabled || !user.faceDescriptor) {
        return res.status(401).json({ message: "Face recognition not enabled for this user" });
      }
      
      // Calculate Euclidean distance between descriptors
      const storedDescriptor = user.faceDescriptor as number[];
      let distance = 0;
      
      for (let i = 0; i < faceDescriptor.length; i++) {
        const diff = faceDescriptor[i] - storedDescriptor[i];
        distance += diff * diff;
      }
      distance = Math.sqrt(distance);
      
      // Threshold for face match (typical range 0.4-0.6)
      const threshold = 0.6;
      const isMatch = distance < threshold;
      const confidence = Math.max(0, (1 - distance) * 100);
      
      if (isMatch) {
        // Generate JWT token for successful face verification
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        
        // SIEM LOG: Successful Login (Full Chain)
        logger.info("Security Event: Successful Login (Face Verified)", {
          event: { category: "authentication", action: "login_success" },
          user: { id: user.id, name: user.username },
          source: { ip: req.ip },
          auth_method: "biometric"
        });

        res.json({
          message: "Face verification successful",
          isMatch: true,
          confidence: Math.round(confidence),
          token,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            totpEnabled: user.totpEnabled,
            faceEnabled: user.faceEnabled,
          }
        });
      } else {
        // SIEM LOG: Failed Face Match
        logger.warn("Security Event: Face Verification Failed", {
           event: { category: "authentication", action: "biometric_failed" },
           user: { name: username },
           source: { ip: req.ip }
        });

        res.status(401).json({ 
          message: "Face verification failed",
          isMatch: false,
          confidence: Math.round(confidence)
        });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Face verification failed" });
    }
  });

  app.get("/api/user/me", authenticateToken, async (req: any, res) => {
    res.json({
      id: req.user.id,
      username: req.user.username,
      fullName: req.user.fullName,
      totpEnabled: req.user.totpEnabled,
      faceEnabled: req.user.faceEnabled,
    });
  });

  // Election routes
  app.get("/api/elections", authenticateToken, async (req, res) => {
    try {
      const elections = await storage.getElections();
      res.json(elections);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch elections" });
    }
  });

  app.get("/api/elections/:id", authenticateToken, async (req, res) => {
    try {
      const election = await storage.getElection(req.params.id);
      if (!election) {
        return res.status(404).json({ message: "Election not found" });
      }
      res.json(election);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch election" });
    }
  });

  // Voting routes
  app.post("/api/vote", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      const { electionId, candidateId } = voteSchema.parse(req.body);
      
      // Check if user has completed all required authentication setup
      if (!user.totpEnabled) {
        return res.status(403).json({ 
          message: "TOTP authentication must be enabled before voting. Please complete 2FA setup." 
        });
      }
      
      if (!user.faceEnabled) {
        return res.status(403).json({ 
          message: "Face recognition must be enabled before voting. Please complete face authentication setup." 
        });
      }
      
      // Check if election exists and is active
      const election = await storage.getElection(electionId);
      if (!election) {
        return res.status(404).json({ message: "Election not found" });
      }
      
      if (!election.isActive) {
        return res.status(400).json({ message: "Election is not active" });
      }
      
      // Check if user has already voted
      const existingVote = await storage.getUserVote(user.id, electionId);
      if (existingVote) {
        // SIEM LOG: Duplicate Vote Attempt
        logger.warn("Security Event: Duplicate Vote Attempted", {
           event: { category: "fraud", action: "double_voting" },
           user: { id: user.id },
           vote: { electionId }
        });
        return res.status(400).json({ message: "You have already voted in this election" });
      }
      
      // Get latest block for blockchain
      const latestBlock = await storage.getLatestBlock();
      const previousHash = latestBlock?.hash || "0";
      
      // Mine the vote (simple proof of work)
      const voteData = {
        userId: user.id,
        electionId,
        candidateId,
        timestamp: new Date(),
      };
      
      const { hash, nonce } = mineBlock(voteData, previousHash);
      
      // Create vote record
      const vote = await storage.createVote({
        userId: user.id,
        electionId,
        candidateId,
        blockHash: hash,
        previousHash,
        nonce,
      });
      
      // Create blockchain block
      const blockNumber = latestBlock ? latestBlock.blockNumber + 1 : 1;
      await storage.createBlock({
        blockNumber,
        hash,
        previousHash,
        votes: [vote],
        nonce,
      });

      // SIEM LOG: Vote Cast (AUDIT TRAIL)
      logger.info("Audit Event: Vote Cast on Blockchain", {
         event: { category: "database", action: "vote_created" },
         user: { id: user.id },
         blockchain: { 
           hash: hash, 
           blockNumber: blockNumber,
           previousHash: previousHash
         }
      });
      
      res.json({
        message: "Vote recorded successfully",
        blockHash: hash,
        blockNumber,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Voting failed" });
    }
  });

  app.get("/api/results/:electionId", authenticateToken, async (req, res) => {
    try {
      const { electionId } = req.params;
      
      const election = await storage.getElection(electionId);
      if (!election) {
        return res.status(404).json({ message: "Election not found" });
      }
      
      const votes = await storage.getVotes(electionId);
      
      // Count votes by candidate
      const results = votes.reduce((acc: any, vote) => {
        acc[vote.candidateId] = (acc[vote.candidateId] || 0) + 1;
        return acc;
      }, {});
      
      // Get blockchain stats
      const blocks = await storage.getBlocks();
      const totalVotes = votes.length;
      
      res.json({
        election,
        results,
        totalVotes,
        blockchainStats: {
          totalBlocks: blocks.length,
          lastBlockHash: blocks[blocks.length - 1]?.hash || null,
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch results" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}