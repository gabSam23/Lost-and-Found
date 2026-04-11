<img src="https://lacite.uregina.ca/sites/default/files/ur_logo-w-1-line-tagline_horiz_full-colour_rgb.png" width="500" alt="University of Regina logo">

# ENSE 281 – Team F: UR Lost & Found

## Project Overview

**UR Lost & Found** is a centralized digital system designed to modernize how lost items are reported, tracked, and returned at the University of Regina. The platform provides Protective Services staff with an organized and efficient tool to log, manage, and search for found items, while allowing students and staff to submit and monitor lost item reports online.

The system aims to improve service efficiency, reduce in-person inquiries, and enhance transparency in the lost and found process across campus.

---
## 🎥 UR Lost & Found Product Commercial  

Click below to watch our early prototype demo video:

[![Watch the demo](https://img.youtube.com/vi/XFXS6lTApFU/0.jpg)](https://www.youtube.com/watch?v=XFXS6lTApFU)
---

## Project Purpose (The “Why”)

Currently, lost and found operations rely heavily on in-person visits, phone calls, and manual tracking methods. This leads to inefficiencies, delays, and frustration for both Protective Services staff and campus users.

Our team is creating UR Lost & Found to:

- Streamline the reporting and tracking of lost items  
- Reduce administrative workload on Protective Services  
- Improve accessibility and service experience for students and staff  

---

## Intended Impact

When we are done, **a manual and fragmented lost-and-found process** will become **a centralized, efficient, and accessible digital service**.

To achieve this, we will design and prototype a web-based system that:

- Allows users to submit lost item reports online  
- Enables staff to log, update, and manage found items in one place  
- Improves response time and communication between staff and users  

---

## Target Users (Who We Are Designing For)

### Primary Users
- University of Regina Protective Services staff (system administrators and item managers)

### Secondary Users
- Students and staff who report or claim lost items

These users currently rely on physical visits, phone calls, or email inquiries. Our system aims to provide a more efficient and convenient alternative.

---

## Project Scope Summary

### In Scope
- Web-based lost and found reporting interface  
- Administrative interface for Protective Services  
- Search and tracking functionality for item records  

### Out of Scope
- Direct reporting of lost or found items by members of the campus community 
- Integration with existing university enterprise systems  
- Development of a native mobile application (iOS or Android) 

---

## Project Members

| Name | Student ID | Email |
|------|------------|-------|
| **Amr Azouz** | 200506317 | aab116@uregina.ca |
| **Cobie Caburao** | 200436566 | ccg534@uregina.ca |
| **Glen Isaac** | 200499313 | giw533@uregina.ca |
| **Gabriel Sampaga** | 200426525 | ggb676@uregina.ca |

---

## Course Context

This project was developed as part of **ENSE 281 – Software Engineering Project Management** at the University of Regina. It includes:

- Business case development  
- Project charter documentation  
- GitHub-based project management  
- Iterative system design and prototyping  
- Team-based collaboration and peer review
- Stakeholder analysis
- Scope definition
- Project Requirements
- UMLs
- MVP iterations
- GitHub workflow
- Kanban Board
- Acceptance Test-driven Development (ATDD)
- Refactoring

---

## Technology Stack

The prototype system is being developed using the following technologies:

![MVC Architecture](https://github.com/user-attachments/assets/30b7b54c-8d86-4b4d-917d-0887c89d649f)

---

## Project Status

🟢 **Completed all MVPs Successfully**  
At this stage of the project, the team has successfully completed and delivered all Minimum Viable Products (MVPs) for the UR Lost & Found system. The focus shifted toward refining the system and ensuring stability of the web application.

Key activities in this phase include:

- Completing all core MVP features
- Testing, debugging, and improving overall system performance
- Finalizing project documentation and compiling the final report
- Organizing GitHub repository (README, Kanban updates)
- Preparing and practicing the final presentation and system demo

These efforts ensure the system is fully functional, polished, and ready for demonstration, marking the successful completion of the project's development phase.

---

## How to Run the Project

### 1. Clone the repository

```bash
git clone https://github.com/gabSam23/Lost-and-Found.git
cd Lost-and-Found/Project-Assets
```

### 2. Install dependencies

```bash
npm i
npm install
```

### 3. Create a `.env` file inside `Project-Assets`

Add the following values:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
SESSION_SECRET=your_custom_session_secret
PORT=3000
```

### 4. Set up Supabase

This project depends on Supabase for authentication, database access, and image storage.

Make sure you already have:

- A Supabase project
- A user in **Supabase Auth** that can log into the app
- A matching row in the `profiles` table for that user
- The required tables used by the app, including:
  - `profiles`
  - `lost_items`
  - `item_reports`
  - `locations`
  - `Categories` or `categories`
- A storage bucket named `item-images` if you want image uploads to work

### 5. Start the server

```bash
node app.js
```

### 6. Open the app

Go to:

```text
http://localhost:3000
```

### 7. Optional: Test the database connection

After starting the server, you can check whether Supabase is connected by visiting:

```text
http://localhost:3000/api/test-db
```

### Notes

- Run the project from inside the `Project-Assets` folder, because that is where `app.js` and `package.json` are located.
- The current `package.json` does **not** include an `npm start` script, so use `node app.js`.
- If login does not work, first verify your Supabase Auth user, `profiles` table entry, and `.env` values.
