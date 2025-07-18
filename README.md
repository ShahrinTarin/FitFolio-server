# 🏋️‍♂️ FitFolio – Your Ultimate Fitness Companion 💪

## 🎯 Purpose

**FitFolio** is a full-featured fitness platform where users can explore trainers, book personalized sessions, subscribe to training packages, and track their fitness journey. Trainers can manage their availability and classes, while admins oversee platform activities. With secure authentication, payment integration, and responsive UI, FitFolio brings the fitness ecosystem online for both professionals and fitness enthusiasts.

## 🌐 Live Site

[https://fitfolio-by-tarin.web.app](https://fitfolio-by-tarin.web.app)

---

## 🚀 Key Features

### 👥 User Roles
- **Admin**: Manage users, trainers, payments, and balance.
- **Trainer**: Apply to become a trainer, add slots & classes, view bookings.
- **User**: Browse trainers & classes, book sessions, make payments.

### 🧑‍🏫 Trainer Booking System
- View trainer details, available slots, and book sessions.
- Package selection: Basic, Standard, Premium.
- Real-time availability updates after booking.

### ⌚ Slot & Class Management
- **Trainers** can:
  - Create available time slots.
  - Create classes with image, name, details, and extra info.
  - Track how many users have booked their classes.
- **Users** can:
  - View available slots visually.
  - Select slots and proceed to booking/payment.

### 💳 Stripe Payment Integration
- Secure and smooth Stripe checkout flow.
- After successful payment:
  - Save booking data to DB.
  - Update slot status (`isBooked`).
  - Increment class `bookingCount`.

### 📊 Admin Dashboard
- View total earnings and recent booking transactions.
- Compare newsletter subscribers vs paid members using a chart.
- Manage roles, trainer applications, and monitor platform activity.

### 💬 Newsletter Subscription
- Capture users' emails for marketing and updates.
- Display subscriber count in the admin dashboard.

---

## 🛠 Tech Stack

| Technology      | Usage                        |
|------------------|------------------------------|
| React.js         | Frontend framework            |
| Tailwind CSS     | Styling                       |
| ShadCN/UI        | UI Components                 |
| React Query      | Server state management       |
| Axios            | HTTP requests                 |
| Node.js + Express| Backend API                   |
| MongoDB          | Database                      |
| Firebase Auth    | JWT-based authentication      |
| Stripe           | Payment gateway               |

---

## 🔐 Authentication & Authorization

- **Firebase Authentication** for login/signup.
- **JWT with cookies** for securing protected routes.
- **Role-based access control**:
  - Admin-only and Trainer-only routes secured in both frontend & backend.

---

## 📁 API Endpoints Overview

| Method | Route                        | Description                             |
|--------|------------------------------|-----------------------------------------|
| POST   | `/users`                     | Add new user                            |
| GET    | `/users/:email`              | Get user by email                       |
| PATCH  | `/users/role/:id`            | Update user role                        |
| POST   | `/apply-trainer`             | Apply to become a trainer               |
| GET    | `/trainers`                  | Get approved trainers                   |
| PATCH  | `/trainer-status/:id`        | Approve or reject trainer application   |
| POST   | `/slots`                     | Create slot (trainer only)              |
| GET    | `/slots/:email`              | Get slots by trainer email              |
| DELETE | `/slot/:id`                  | Delete slot                             |
| POST   | `/classes`                   | Create class                            |
| GET    | `/classes`                   | Get all classes                         |
| GET    | `/classes/:id`               | Get class by ID                         |
| POST   | `/payment`                   | Save payment info after Stripe success  |
| GET    | `/admin/booking-summary`     | Admin dashboard data                    |
| GET    | `/newsletter/count`          | Get newsletter subscriber count         |
| POST   | `/newsletter`                | Add email to newsletter list            |

---

## 🧪 Environment Variables (.env)

