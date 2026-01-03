# Movie Translator

A full-stack application for translating movies, built with Next.js, Express.js, MongoDB, React Native, and Python.

## Features

- User authentication (login, register, forget password, Google login)
- Responsive UI with dark mode
- Mobile app-like interface
- Movie file upload and SRT subtitle extraction
- Download extracted SRT files

## Setup

### Prerequisites

- Node.js
- MongoDB (running locally or provide connection string)
- Python (optional)

### Backend

1. cd backend
2. npm install
3. Set up environment variables in .env (see .env.example)
4. npm start (runs on port 5001)

### Frontend

1. cd frontend
2. npm install
3. npm run dev

### Mobile

1. cd mobile/MovieTranslator
2. npm install
3. npx react-native run-android (or run-ios)

### Python

1. cd python
2. python -m venv venv
3. pip install -r requirements.txt

## Usage

- Start both servers: `npm run dev`
- Or separately:
  - Backend: `cd backend && node server.js` (port 5001)
  - Frontend: `cd frontend && npm run dev` (port 3000)
- Access at http://localhost:3000
- Login and upload a movie file to extract SRT subtitles

### Email Setup (for password reset)

1. Enable 2-factor authentication on your Gmail account.
2. Generate an App Password: Go to Google Account > Security > App passwords.
3. Create a new app password for "Mail".
4. Use the app password in `backend/.env`:
   - EMAIL_USER=your_email@gmail.com
   - EMAIL_PASS=your_app_password