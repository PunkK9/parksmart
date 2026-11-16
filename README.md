# ParkSmart

Smart Vehicle Parking Slot Management System (24CIE554 Full Stack project).
React + Node.js/Express + MongoDB. The AI module is plain JavaScript inside the backend.

## Run it (Windows, project on D:)

1. Extract this folder to `D:\parksmart` and open it in VS Code.
2. **Database (MongoDB Atlas, free)**
   - Create an M0 cluster at mongodb.com/atlas.
   - Database Access: add a user. Network Access: add `0.0.0.0/0`.
   - Connect, Drivers: copy the connection string and put `/parksmart` before the `?`.
3. **Gmail for verification emails**
   - Google Account, Security: turn on 2-Step Verification.
   - Search "App passwords", create one named ParkSmart, copy the 16 characters.
4. **Backend settings**
   ```
   cd backend
   copy .env.example .env
   ```
   Open `backend\.env` and fill in `MONGO_URI`, `JWT_SECRET` (any long random text), `EMAIL_USER` (your Gmail address) and `EMAIL_PASS` (the 16-character app password).
5. **Install everything** (from `D:\parksmart`)
   ```
   npm run install:all
   ```
6. **Add the demo data**
   ```
   npm run seed
   ```
7. **Start both servers**
   ```
   npm run dev
   ```
   Open http://localhost:5173

## Accounts after seeding

| Role | Email | Password |
|---|---|---|
| Admin | admin@parksmart.com | admin123 |
| User | rahul@example.com | password123 |

New sign-ups must verify their email before they can log in.

## Sign-up flow

1. Sign up with name, email, password.
2. The backend creates an unverified account and emails a verification link (valid 24 hours).
3. Clicking the link opens `/verify-email`, which activates the account and sends you to login.
4. Logging in before verifying shows a "Resend verification email" button.

If `EMAIL_USER` / `EMAIL_PASS` are empty, the email is not sent. The link is printed in the backend terminal instead, so you can still test.

## What is in it

- Live slot grid by zone, filters, free/reserved/occupied/closed colours, refreshes every 15 seconds
- Booking with vehicle registration number, one active booking per user
- QR code per booking, scanned to check in and check out
- Directions from the entrance to the slot: walking line, distance, time on foot and compass direction (Leaflet; Esri satellite or Stadia/OpenStreetMap streets, Mapbox if `VITE_MAPBOX_TOKEN` is set)
- AI module: best arrival time and peak hours (3-hour moving average over past bookings), dynamic fee (1.5x at peak, 0.8x when quiet), favourite-slot suggestion (booking frequency count)
- Keyword assistant that answers from the same booking data
- Admin analytics: filters by date, zone, vehicle type; KPIs, revenue by day, bookings and revenue by zone, occupancy heatmap, demand chart
- Admin management: add, close and delete slots, view all bookings, gate scan

## Things to know

- "Real time" means the page refreshes every 15 seconds. There are no sensors, so a car is only known to be in a slot if someone books or scans through the app.
- The "QR scan" button on My bookings sends the same code a gate scanner would send. Admin, Manage, Gate scan accepts a pasted token.
- Directions are a straight line from the gate to the bay. Campus paths are not on public road maps, so a routing service can't give a real route. Map tiles need internet.
- The assistant understands keywords such as "free", "zone B", "fee", "peak". It is not a language model.
- Your campus location: change `ENTRANCE` in `frontend/src/config.js` and `BASE` in `backend/seed.js`, then run `npm run seed` again.
- Running `npm run seed` wipes users, slots, and bookings and recreates the demo data.

## Folders

```
backend/   Express API: models, routes, utils (AI demand, pricing, mailer), seed.js
frontend/  React app (Vite): pages, components, styles
```
