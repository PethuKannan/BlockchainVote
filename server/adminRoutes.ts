import type { Express } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { logger } from "./logger";
import { z } from "zod";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env variable is required");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.warn("⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set — admin panel disabled");
}

// ── Schemas ────────────────────────────────────────────────
const adminLoginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

const createElectionSchema = z.object({
  title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  candidates: z.array(z.object({
    name: z.string().min(1, "Candidate name required"),
    party: z.string().min(1, "Party required"),
  })).min(2, "At least 2 candidates required"),
});

const addCandidateSchema = z.object({
  name: z.string().min(1, "Name required"),
  party: z.string().min(1, "Party required"),
});

// ── Admin JWT Middleware ───────────────────────────────────
const authenticateAdmin = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Admin token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    if (decoded.role !== "admin") {
      logger.warn("Security Event: Non-Admin Token Used on Admin Route", {
        reqIp: req.ip || "",
        event: { category: "authentication", action: "admin_unauthorized" },
        user: { id: decoded.userId },
      });
      return res.status(403).json({ message: "Admin access required" });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    logger.warn("Security Event: Invalid Admin Token", {
      reqIp: req.ip || "",
      event: { category: "authentication", action: "admin_token_invalid" },
    });
    return res.status(403).json({ message: "Invalid or expired admin token" });
  }
};

function getReqIp(req: any): string {
  return req.ip || req.headers["x-forwarded-for"] || "";
}

// ── Register Admin Routes ──────────────────────────────────
export function registerAdminRoutes(app: Express): void {

  // ── ADMIN LOGIN ───────────────────────────────────────────
  app.post("/api/admin/login", async (req, res) => {
    try {
      if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return res.status(503).json({ message: "Admin panel not configured" });
      }

      const { email, password } = adminLoginSchema.parse(req.body);

      if (email !== ADMIN_EMAIL) {
        logger.warn("Security Event: Admin Login Failed (Wrong Email)", {
          reqIp: getReqIp(req),
          event: { category: "authentication", action: "admin_login_failed" },
          attempted_email: email,
        });
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const validPassword = await bcrypt.compare(password, ADMIN_PASSWORD);
      if (!validPassword) {
        logger.warn("Security Event: Admin Login Failed (Wrong Password)", {
          reqIp: getReqIp(req),
          event: { category: "authentication", action: "admin_login_failed" },
          attempted_email: email,
        });
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const token = jwt.sign(
        { role: "admin", email: ADMIN_EMAIL },
        JWT_SECRET!,
        { expiresIn: "8h" }
      );

      logger.info("Security Event: Admin Login Successful", {
        reqIp: getReqIp(req),
        event: { category: "authentication", action: "admin_login_success" },
        admin: { email: ADMIN_EMAIL },
      });

      res.json({ token, message: "Admin login successful" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Admin login failed" });
    }
  });

  // ── GET ALL ELECTIONS (with vote counts) ──────────────────
  app.get("/api/admin/elections", authenticateAdmin, async (req, res) => {
    try {
      const elections = await storage.getElections();

      const electionsWithStats = await Promise.all(
        elections.map(async (election) => {
          const votes = await storage.getVotes(election.id);
          const results = votes.reduce((acc: any, vote) => {
            acc[vote.candidateId] = (acc[vote.candidateId] || 0) + 1;
            return acc;
          }, {});
          return { ...election, totalVotes: votes.length, results };
        })
      );

      logger.info("Audit Event: Admin Viewed All Elections", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "admin_elections_viewed" },
        count: elections.length,
      });

      res.json(electionsWithStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch elections" });
    }
  });

  // ── CREATE ELECTION ───────────────────────────────────────
  app.post("/api/admin/elections", authenticateAdmin, async (req, res) => {
    try {
      const data = createElectionSchema.parse(req.body);

      const candidates = data.candidates.map((c, idx) => ({
        id: `candidate-${Date.now()}-${idx}`,
        name: c.name,
        party: c.party,
      }));

      const election = await storage.createElection({
        title: data.title,
        description: data.description || "",
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: true,
        candidates,
      });

      logger.info("Audit Event: Admin Created Election", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "admin_election_created" },
        election: {
          id: election.id,
          title: election.title,
          candidateCount: candidates.length,
          startDate: election.startDate,
          endDate: election.endDate,
        },
      });

      res.status(201).json(election);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create election" });
    }
  });

  // ── UPDATE ELECTION (title, description, dates) ───────────
  app.patch("/api/admin/elections/:id", authenticateAdmin, async (req, res) => {
    try {
      const election = await storage.getElection(req.params.id);
      if (!election) return res.status(404).json({ message: "Election not found" });

      const { title, description, startDate, endDate } = req.body;

      const updated = await storage.updateElection(election.id, {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      });

      logger.info("Audit Event: Admin Updated Election", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "admin_election_updated" },
        election: {
          id: election.id,
          title: updated?.title,
          startDate: updated?.startDate,
          endDate: updated?.endDate,
        },
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update election" });
    }
  });

  // ── TOGGLE ELECTION ACTIVE STATUS ─────────────────────────
  app.patch("/api/admin/elections/:id/toggle", authenticateAdmin, async (req, res) => {
    try {
      const election = await storage.getElection(req.params.id);
      if (!election) return res.status(404).json({ message: "Election not found" });

      const updated = await storage.updateElection(election.id, {
        isActive: !election.isActive,
      });

      logger.info(
        `Audit Event: Admin ${updated?.isActive ? "Activated" : "Deactivated"} Election`,
        {
          reqIp: getReqIp(req),
          event: {
            category: "database",
            action: updated?.isActive
              ? "admin_election_activated"
              : "admin_election_deactivated",
          },
          election: { id: election.id, title: election.title },
        }
      );

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to toggle election" });
    }
  });

  // ── DELETE ELECTION ───────────────────────────────────────
  app.delete("/api/admin/elections/:id", authenticateAdmin, async (req, res) => {
    try {
      const election = await storage.getElection(req.params.id);
      if (!election) return res.status(404).json({ message: "Election not found" });

      await storage.deleteElection(election.id);

      logger.warn("Audit Event: Admin Deleted Election", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "admin_election_deleted" },
        election: { id: election.id, title: election.title },
      });

      res.json({ message: "Election deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete election" });
    }
  });

  // ── ADD CANDIDATE ─────────────────────────────────────────
  app.post("/api/admin/elections/:id/candidates", authenticateAdmin, async (req, res) => {
    try {
      const election = await storage.getElection(req.params.id);
      if (!election) return res.status(404).json({ message: "Election not found" });

      const { name, party } = addCandidateSchema.parse(req.body);

      const newCandidate = {
        id: `candidate-${Date.now()}`,
        name,
        party,
      };

      const updatedCandidates = [...(election.candidates as any[]), newCandidate];
      const updated = await storage.updateElection(election.id, {
        candidates: updatedCandidates,
      });

      logger.info("Audit Event: Admin Added Candidate", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "admin_candidate_added" },
        election: { id: election.id },
        candidate: { name, party },
      });

      res.status(201).json({ election: updated, candidate: newCandidate });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to add candidate" });
    }
  });

  // ── REMOVE CANDIDATE ──────────────────────────────────────
  app.delete(
    "/api/admin/elections/:id/candidates/:candidateId",
    authenticateAdmin,
    async (req, res) => {
      try {
        const election = await storage.getElection(req.params.id);
        if (!election) return res.status(404).json({ message: "Election not found" });

        const candidates = election.candidates as any[];
        const candidate = candidates.find((c) => c.id === req.params.candidateId);
        if (!candidate) return res.status(404).json({ message: "Candidate not found" });

        const updatedCandidates = candidates.filter(
          (c) => c.id !== req.params.candidateId
        );

        if (updatedCandidates.length < 2) {
          return res
            .status(400)
            .json({ message: "Election must have at least 2 candidates" });
        }

        await storage.updateElection(election.id, { candidates: updatedCandidates });

        logger.warn("Audit Event: Admin Removed Candidate", {
          reqIp: getReqIp(req),
          event: { category: "database", action: "admin_candidate_removed" },
          election: { id: election.id },
          candidate: { id: req.params.candidateId, name: candidate.name },
        });

        res.json({ message: "Candidate removed successfully" });
      } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to remove candidate" });
      }
    }
  );

  // ── GET ELECTION RESULTS ──────────────────────────────────
  app.get("/api/admin/elections/:id/results", authenticateAdmin, async (req, res) => {
    try {
      const election = await storage.getElection(req.params.id);
      if (!election) return res.status(404).json({ message: "Election not found" });

      const votes = await storage.getVotes(election.id);
      const blocks = await storage.getBlocks();

      const results = votes.reduce((acc: any, vote) => {
        acc[vote.candidateId] = (acc[vote.candidateId] || 0) + 1;
        return acc;
      }, {});

      logger.info("Audit Event: Admin Viewed Election Results", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "admin_results_viewed" },
        election: { id: election.id, totalVotes: votes.length },
      });

      res.json({
        election,
        results,
        totalVotes: votes.length,
        votes,
        blockchainStats: {
          totalBlocks: blocks.length,
          lastBlockHash: blocks[blocks.length - 1]?.hash || null,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch results" });
    }
  });

  // ── GET ALL USERS ─────────────────────────────────────────
  app.get("/api/admin/users", authenticateAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();

      logger.info("Audit Event: Admin Viewed All Users", {
        reqIp: getReqIp(req),
        event: { category: "database", action: "admin_users_viewed" },
        count: users.length,
      });

      const safeUsers = users.map(
        ({ password, faceDescriptor, totpSecret, ...u }: any) => u
      );
      res.json(safeUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch users" });
    }
  });

  // ── DASHBOARD STATS ───────────────────────────────────────
  app.get("/api/admin/stats", authenticateAdmin, async (req, res) => {
    try {
      const elections = await storage.getElections();
      const users = await storage.getAllUsers();
      const blocks = await storage.getBlocks();

      let totalVotes = 0;
      for (const election of elections) {
        const votes = await storage.getVotes(election.id);
        totalVotes += votes.length;
      }

      res.json({
        totalElections: elections.length,
        activeElections: elections.filter((e) => e.isActive).length,
        totalUsers: users.length,
        totalVotes,
        totalBlocks: blocks.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch stats" });
    }
  });
}