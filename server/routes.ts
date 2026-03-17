import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, totpSetupSchema, voteSchema, faceEnrollSchema, faceVerifySchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import { logger } from "./logger";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
const SALT_ROUNDS = 12;

interface AuthRequest extends Request {
  user?: any;
}

// ✅ Helper — avoids repeating geoip.lookup(req.ip || "") everywhere
function getReqIp(req: any): string {
  return req.ip || req.headers['x-forwarded-for'] || "";
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
      logger.warn("Security Event: Token Used for Invalid User", {
        reqIp: getReqIp(req), // ✅ use reqIp so GeoIP enricher in logger picks it up
        event: { category: "authentication", action: "token_invalid_user" },
        user: { id: decoded.userId },
      });
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn("Security Event: Invalid Token Used", {
      reqIp: getReqIp(req), // ✅ use reqIp
      event: { category: "authentication", action: "token_validate_failed" },
    });
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

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

  // ── REGISTER ──────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        // ✅ Log duplicate registration attempt
        logger.warn("Security Event: Duplicate Registration Attempt", {
          reqIp: getReqIp(req),
          event: { category: "iam", action: "user_create_failed" },
          user: { name: userData.username },
        });
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);
      const user = await storage.createUser({ ...userData, password: hashedPassword });
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

      logger.info("Audit Event: User Registered", {
        reqIp: getReqIp(req),
        event: { category: "iam", action: "user_create" },
        user: { id: user.id, name: user.username },
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

  // ── LOGIN ──────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, totpCode } = loginSchema.parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user) {
        logger.warn("Security Event: Failed Login (User Not Found)", {
          reqIp: getReqIp(req),
          event: { category: "authentication", action: "login_failed" },
          user: { name: username },
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        logger.warn("Security Event: Failed Login (Bad Password)", {
          reqIp: getReqIp(req),
          event: { category: "authentication", action: "login_failed" },
          user: { name: username },
        });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.totpEnabled) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        // ✅ Log that TOTP setup is pending
        logger.info("Audit Event: Login - TOTP Setup Pending", {
          reqIp: getReqIp(req),
          event: { category: "authentication", action: "login_totp_setup_required" },
          user: { id: user.id, name: user.username },
        });
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

      if (user.totpEnabled && user.totpSecret) {
        if (!totpCode) {
          return res.status(401).json({ message: "TOTP code required", requiresTotp: true });
        }

        const verified = speakeasy.totp.verify({
          secret: user.totpSecret,
          encoding: 'base32',
          token: totpCode,
          window: 2,
        });

        if (!verified) {
          logger.warn("Security Event: Failed Login (Invalid TOTP)", {
            reqIp: getReqIp(req),
            event: { category: "authentication", action: "mfa_failed" },
            user: { name: username },
          });
          return res.status(401).json({ message: "Invalid TOTP code" });
        }
      }

      if (!user.faceEnabled) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        // ✅ Log that face setup is pending
        logger.info("Audit Event: Login - Face Setup Pending", {
          reqIp: getReqIp(req),
          event: { category: "authentication", action: "login_face_setup_required" },
          user: { id: user.id, name: user.username },
        });
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

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

      // ✅ Log credentials validated (face verify is still pending)
      logger.info("Audit Event: Credentials Validated - Awaiting Face Verify", {
        reqIp: getReqIp(req),
        event: { category: "authentication", action: "login_credentials_ok" },
        user: { id: user.id, name: user.username },
      });

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

  // ── TOTP SETUP ─────────────────────────────────────────────
  app.get("/api/auth/setup-totp", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;

      if (user.totpEnabled) {
        return res.status(400).json({ message: "TOTP already enabled" });
      }

      const secret = speakeasy.generateSecret({
        name: `VoteChain (${user.username})`,
        issuer: 'VoteChain',
        length: 20,
      });

      await storage.updateUser(user.id, { totpSecret: secret.base32 });

      // ✅ Log TOTP setup initiated
      logger.info("Security Event: TOTP Setup Initiated", {
        reqIp: getReqIp(req),
        event: { category: "iam", action: "mfa_setup_initiated" },
        user: { id: user.id, name: user.username },
      });

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

  // ── TOTP VERIFY ────────────────────────────────────────────
  app.post("/api/auth/verify-totp", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      const { token } = totpSetupSchema.parse(req.body);

      if (!user.totpSecret) {
        return res.status(400).json({ message: "TOTP not initialized. Call setup-totp first." });
      }

      const verified = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: token,
        window: 2,
      });

      if (!verified) {
        // ✅ Log failed TOTP setup verify
        logger.warn("Security Event: TOTP Setup Verification Failed", {
          reqIp: getReqIp(req),
          event: { category: "iam", action: "mfa_setup_failed" },
          user: { id: user.id },
        });
        return res.status(400).json({ message: "Invalid TOTP code" });
      }

      await storage.updateUser(user.id, { totpEnabled: true });

      const backupCodes = Array.from({ length: 8 }, () =>
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );

      logger.info("Security Event: MFA Enabled", {
        reqIp: getReqIp(req),
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

  // ── FACE ENROLL ────────────────────────────────────────────
  app.post("/api/auth/enroll-face", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      const { faceDescriptor } = faceEnrollSchema.parse(req.body);

      if (user.faceEnabled) {
        return res.status(400).json({ message: "Face recognition already enabled for this user" });
      }

      await storage.updateUser(user.id, {
        faceDescriptor: faceDescriptor,
        faceEnabled: true
      });

      logger.info("Security Event: Face ID Enrolled", {
        reqIp: getReqIp(req),
        event: { category: "iam", action: "biometric_enable" },
        user: { id: user.id },
      });

      res.json({ message: "Face enrolled successfully", faceEnabled: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Face enrollment failed" });
    }
  });

  // ── FACE VERIFY ────────────────────────────────────────────
  app.post("/api/auth/verify-face", async (req, res) => {
    try {
      const { username, faceDescriptor } = faceVerifySchema.extend({
        username: loginSchema.shape.username,
      }).parse(req.body);

      const user = await storage.getUserByUsername(username);
      if (!user || !user.faceEnabled || !user.faceDescriptor) {
        return res.status(401).json({ message: "Face recognition not enabled for this user" });
      }

      const storedDescriptor = user.faceDescriptor as number[];
      let distance = 0;

      for (let i = 0; i < faceDescriptor.length; i++) {
        const diff = faceDescriptor[i] - storedDescriptor[i];
        distance += diff * diff;
      }
      distance = Math.sqrt(distance);

      const threshold = 0.6;
      const isMatch = distance < threshold;
      const confidence = Math.max(0, (1 - distance) * 100);

      if (isMatch) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

        logger.info("Security Event: Successful Login (Face Verified)", {
          reqIp: getReqIp(req),
          event: { category: "authentication", action: "login_success" },
          user: { id: user.id, name: user.username },
          auth_method: "biometric",
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
        logger.warn("Security Event: Face Verification Failed", {
          reqIp: getReqIp(req),
          event: { category: "authentication", action: "biometric_failed" },
          user: { name: username },
          face_confidence: Math.round(confidence),  // ✅ log confidence score
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

  // ── USER ME ────────────────────────────────────────────────
  app.get("/api/user/me", authenticateToken, async (req: any, res) => {
    res.json({
      id: req.user.id,
      username: req.user.username,
      fullName: req.user.fullName,
      totpEnabled: req.user.totpEnabled,
      faceEnabled: req.user.faceEnabled,
    });
  });

  // ── ELECTIONS ──────────────────────────────────────────────
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

  // ── VOTE ───────────────────────────────────────────────────
  app.post("/api/vote", authenticateToken, async (req: any, res) => {
    try {
      const user = req.user;
      const { electionId, candidateId } = voteSchema.parse(req.body);

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

      const election = await storage.getElection(electionId);
      if (!election) {
        return res.status(404).json({ message: "Election not found" });
      }

      if (!election.isActive) {
        return res.status(400).json({ message: "Election is not active" });
      }

      const existingVote = await storage.getUserVote(user.id, electionId);
      if (existingVote) {
        logger.warn("Security Event: Duplicate Vote Attempted", {
          reqIp: getReqIp(req),
          event: { category: "fraud", action: "double_voting" },
          user: { id: user.id },
          vote: { electionId },
        });
        return res.status(400).json({ message: "You have already voted in this election" });
      }

      const latestBlock = await storage.getLatestBlock();
      const previousHash = latestBlock?.hash || "0";

      const voteData = {
        userId: user.id,
        electionId,
        candidateId,
        timestamp: new Date(),
      };

      const { hash, nonce } = mineBlock(voteData, previousHash);

      const vote = await storage.createVote({
        userId: user.id,
        electionId,
        candidateId,
        blockHash: hash,
        previousHash,
        nonce,
      });

      const blockNumber = latestBlock ? latestBlock.blockNumber + 1 : 1;
      await storage.createBlock({
        blockNumber,
        hash,
        previousHash,
        votes: [vote],
        nonce,
      });

      logger.info("Audit Event: Vote Cast on Blockchain", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "vote_created" },
        user: { id: user.id },
        blockchain: {
          hash,
          blockNumber,
          previousHash,
        },
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

  // ── RESULTS ────────────────────────────────────────────────
  app.get("/api/results/:electionId", authenticateToken, async (req: any, res) => {
    try {
      const { electionId } = req.params;

      const election = await storage.getElection(electionId);
      if (!election) {
        return res.status(404).json({ message: "Election not found" });
      }

      const votes = await storage.getVotes(electionId);

      const results = votes.reduce((acc: any, vote) => {
        acc[vote.candidateId] = (acc[vote.candidateId] || 0) + 1;
        return acc;
      }, {});

      const blocks = await storage.getBlocks();
      const totalVotes = votes.length;

      // ✅ Log results access for audit trail
      logger.info("Audit Event: Election Results Accessed", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "results_viewed" },
        user: { id: req.user.id },
        election: { id: electionId, totalVotes },
      });

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

