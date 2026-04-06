# Election Management System 🗳️

A full-stack Election Management System built using the **PERN stack** (PostgreSQL, Express, React, Node.js). The application utilizes the `Refine` framework for the frontend alongside `shadcn/ui` and `Material UI` for components, and uses custom JWT-based authentication for secure role-based access.

## Project Structure

- `EMS_backend/`: Express server and backend configuration.
- `EMS_frontend/`: React frontend built with Vite and Refine.
- `EMSschema.sql`: PostgreSQL database dump file.

## Prerequisites

- **Node.js** (v18+)
- **PostgreSQL** (Local installation)

## Setup & Run Instructions

### 1. Database Setup

1. Open your terminal or `psql` command line tool and create a fresh local database. For example:
   ```bash
   createdb -U your_postgres_user ems_db
   ```
2. Restore the database structure and initial data from the provided SQL dump file:
   ```bash
   psql -U your_postgres_user -d ems_db -f EMSschema.sql
   ```

### 2. Backend Initialization

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd EMS_backend
   ```
2. Install backend dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `EMS_backend/` directory and configure it to point to the local database you just created:
   ```env
   DB_USER=your_postgres_user
   DB_HOST=localhost
   DB_NAME=ems_db
   DB_PASSWORD=your_postgres_password
   DB_PORT=5432
   DB_SSLMODE=disable # Use 'disable' for local Postgres installations
   
   JWT_SECRET=wElEcS3cr3t!V0t1ngSyst3mJWT2026xYz$Abc#
   JWT_EXPIRES_IN=8h
   FRONTEND_URL=http://localhost:5173
   ```
4. Start the backend server:
   ```bash
   node index.js
   ```
   *(The backend server will run on `http://localhost:3001`)*

### 3. Frontend Setup

1. Open a new terminal block and navigate to the frontend folder:
   ```bash
   cd EMS_frontend
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *(The frontend application will be accessible at `http://localhost:5173`)*

## Default Login Credentials

Because the database was restored from the `EMSschema.sql` dump, the test accounts are already populated. You can test the platform using:

- **Admin Account**:
  - Email: `admin@election.dev`
  - Password: `password123`
- **Returning Officer (Worker)**:
  - Email: `ro@election.dev`
  - Password: `password123`
- **Polling Officer (Worker)**:
  - Email: `po@election.dev`
  - Password: `password123`

---
*Note: Make sure both the backend (`node index.js`) and frontend (`npm run dev`) terminal servers are running concurrently while viewing the application in your browser.*
