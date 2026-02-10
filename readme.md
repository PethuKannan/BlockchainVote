# Overview

VoteChain is a secure blockchain voting platform that combines modern web technologies with cryptographic security and two-factor authentication. The application allows users to participate in elections through a decentralized voting system that records votes immutably on a simulated blockchain. Built as a full-stack web application, it provides comprehensive user authentication, election management, and real-time vote tracking capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with React and TypeScript, utilizing a modern component-based architecture. The application uses Wouter for client-side routing and TanStack Query for server state management. The UI is constructed with shadcn/ui components built on top of Radix UI primitives, providing a consistent and accessible design system. Tailwind CSS handles styling with a comprehensive design token system for theming and responsive design.

## Backend Architecture
The server implements a RESTful API using Express.js with TypeScript. The architecture follows a layered approach with clear separation between routing, business logic, and data persistence. Authentication is handled through JWT tokens with bcrypt for password hashing and Speakeasy for TOTP (Time-based One-Time Password) generation and verification.

## Database Design
The application uses Drizzle ORM with PostgreSQL as the primary database. The schema defines four main entities:
- **Users**: Stores user credentials, TOTP secrets, and authentication status
- **Elections**: Contains election metadata, candidates, and scheduling information
- **Votes**: Records individual votes with blockchain hash references
- **VotingBlocks**: Implements the blockchain structure with block numbers, hashes, and vote batches

The database design ensures data integrity through foreign key relationships and prevents double voting through unique constraints.

## Blockchain Simulation
The voting system implements a simplified blockchain architecture within the Node.js backend. Each vote is recorded in a block containing the vote data, a hash of the previous block, and a proof-of-work nonce. The system uses SHA-256 hashing to create immutable records and implements a basic mining algorithm with adjustable difficulty.

## Authentication System
Security is implemented through a multi-layered approach:
- **Primary Authentication**: Username/password with bcrypt hashing (12 salt rounds)
- **Two-Factor Authentication**: TOTP using Speakeasy with QR code generation via the qrcode library
- **Session Management**: JWT tokens with configurable expiration and secure HTTP-only cookie options
- **Route Protection**: Middleware-based authentication verification for protected endpoints

## Data Storage Strategy
The application currently uses an in-memory storage implementation for development and testing, with a clean interface designed for easy migration to persistent database solutions. The storage layer abstracts CRUD operations for all entities and provides methods for blockchain operations including block creation and chain validation.

## API Design
The REST API follows conventional HTTP methods and status codes:
- **Authentication Routes**: `/api/auth/*` for registration, login, and TOTP setup
- **Election Routes**: `/api/elections` for election data retrieval
- **Voting Routes**: `/api/vote` for vote submission with blockchain integration
- **Results Routes**: `/api/results` for real-time vote tallying

All API responses follow a consistent JSON structure with appropriate error handling and validation.

# External Dependencies

## Core Framework Dependencies
- **React 18+**: Frontend framework with hooks and concurrent features
- **Express.js**: Backend web framework for API development
- **TypeScript**: Type safety across both client and server code

## Database and ORM
- **Drizzle ORM**: Type-safe database operations and schema management
- **Drizzle Kit**: Database migration and schema generation tools
- **@neondatabase/serverless**: PostgreSQL driver optimized for serverless environments

## Authentication Libraries
- **jsonwebtoken**: JWT token creation and verification
- **bcrypt**: Password hashing with configurable salt rounds
- **speakeasy**: TOTP generation and verification for 2FA
- **qrcode**: QR code generation for TOTP setup

## Frontend UI Libraries
- **@radix-ui/***: Comprehensive collection of accessible UI primitives
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight client-side routing
- **react-hook-form**: Form handling with validation
- **@hookform/resolvers**: Form validation resolvers including Zod integration

## Utility Libraries
- **zod**: Runtime type validation and schema definition
- **drizzle-zod**: Integration between Drizzle ORM and Zod schemas
- **clsx & tailwind-merge**: Conditional CSS class handling
- **class-variance-authority**: Component variant management
- **date-fns**: Date manipulation and formatting

## Development Tools
- **Vite**: Build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: CSS processing with Autoprefixer
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production builds

## Styling and Design
- **Tailwind CSS**: Complete styling solution with design tokens
- **Lucide React**: Icon library with consistent design
- **CSS Variables**: Dynamic theming support for light/dark modes
- **Font Awesome**: Additional icon resources for enhanced UI elements