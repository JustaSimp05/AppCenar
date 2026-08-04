# AppCenar

<div align="center">

<img src="https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white" alt="Node.js" />
<img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
<img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
<img src="https://img.shields.io/badge/Mongoose-880000?style=for-the-badge&logo=mongodb&logoColor=white" alt="Mongoose" />
<img src="https://img.shields.io/badge/Handlebars-000000?style=for-the-badge&logo=handlebars.js&logoColor=white" alt="Handlebars" />
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
<img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />

<h3>Delivery and commerce management web application</h3>

<p>
AppCenar is a role-based delivery platform built around a simple MVC structure in Node.js. It supports client browsing, cart-based ordering, merchant catalog management, delivery assignment, and admin oversight.
</p>

</div>

## Table of Contents

- [About The Project](#about-the-project)
- [Features](#features)
- [Screenshots / Demo](#screenshots--demo)
- [Built With](#built-with)
- [Architecture](#architecture)
- [Application Flow](#application-flow)
- [Database](#database)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)
- [Contributors](#contributors)
- [License](#license)
- [Contact](#contact)

## About The Project

AppCenar is a delivery and commerce web application that connects four main actors in a single flow: clients, merchants, delivery personnel, and administrators.

The application is organized around server-rendered pages rather than a separate frontend build. Requests are handled by Express route files and rendered with Handlebars templates. The data layer uses MongoDB through Mongoose schemas.

The project solves a straightforward operational need: a merchant can publish categories and products, a client can browse those products, save addresses, keep favorites, and create orders; the merchant can then process and assign an available delivery; the delivery person can take and complete the order; and an administrator can manage users, commerce types, activation status, and basic delivery configuration.

This repository is therefore a full-stack web application centered on the delivery order lifecycle, rather than an API-first system.

## Features

The implemented feature set is visible in the route structure and models:

- User registration and account activation for customers and deliveries.
- Commerce registration with activation through email.
- Session-based login and role-based routing for `cliente`, `delivery`, `comercio`, and `admin`.
- Password reset flow using email and reset tokens.
- Client home with commerce browsing by type.
- Commerce search with a lightweight AJAX endpoint.
- Catalog browsing with categories and products.
- Session cart management for adding, updating, and removing products.
- Address management for clients.
- Favorite commerce saving and removal.
- Order creation with subtotal, ITBIS, and total based on the active configuration.
- Order history and detailed order views for clients.
- Commerce dashboard for managing categories, products, and order status.
- Delivery assignment from commerce to available delivery users.
- Delivery dashboard with available orders, active order handling, and completion flow.
- Admin dashboard with counts for clients, deliveries, commerces, orders, and products.
- Admin maintenance for customers, delivery users, administrators, commerce types, and delivery settings.
- Upload support for profile pictures, logos, and commerce icons through Multer.
- SMTP-based mail notifications for account activation and password reset.

## Screenshots / Demo

This repository does not currently include a dedicated screenshot set or demo assets. The following placeholders indicate the intended locations for future visual documentation:

- `docs/images/landing.png`
- `docs/images/client-flow.png`
- `docs/images/commerce-dashboard.png`
- `docs/images/admin-dashboard.png`

## Built With

<div align="center">

<img src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript" />
<img src="https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white" alt="Node.js" />
<img src="https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white" alt="Express 5" />
<img src="https://img.shields.io/badge/Handlebars-4.x-000000?logo=handlebars.js&logoColor=white" alt="Handlebars" />
<img src="https://img.shields.io/badge/MongoDB-Local%20or%20URI-4EA94B?logo=mongodb&logoColor=white" alt="MongoDB" />
<img src="https://img.shields.io/badge/Mongoose-9.x-880000?logo=mongodb&logoColor=white" alt="Mongoose" />
<img src="https://img.shields.io/badge/Session%20Auth-Express%20Session-6C5CE7" alt="Express Session" />
<img src="https://img.shields.io/badge/Validation-express-validator-FF6B6B" alt="Express Validator" />
<img src="https://img.shields.io/badge/Mail-Nodemailer-1F6FEB" alt="Nodemailer" />
<img src="https://img.shields.io/badge/Uploads-Multer-8B5CF6" alt="Multer" />

</div>

The application is mostly a server-rendered MVC project with direct route handlers and Mongoose models. There is no separate frontend framework, no TypeScript build, and no formal test suite in the repository.

## Architecture

The project uses a small MVC layout with clear separation between the HTTP layer, the view layer, and the MongoDB model layer.

- `app.js` is the application bootstrap. It configures Express, the session middleware, flash messages, the Handlebars view engine, static assets, and the MongoDB connection.
- `routes/` contains the request handlers for each area:
  - `auth.js` for login, registration, account activation, and password reset.
  - `client.js` for the customer-facing journey: home, commerce discovery, favorites, cart, addresses, and orders.
  - `commerce.js` for the merchant dashboard: categories, products, profile, and order processing.
  - `delivery.js` for delivery dashboard and order completion.
  - `admin.js` for admin management and configuration.
- `models/` contains the Mongoose schemas.
- `config/` contains the email transport and upload configuration.
- `views/` contains the Handlebars templates.
- `public/` contains the static assets, CSS, and uploaded images.

The project does not use a service layer or repository abstraction. The business logic is concentrated in the route files themselves, with Mongoose models providing the database access layer.

The communication flow is straightforward:

1. The browser sends a request to an Express route.
2. The route validates input, checks the current session, and reads or writes data through Mongoose models.
3. The response is either a rendered Handlebars page or, for some flows, a JSON object used by the UI.

## Application Flow

The current application flow is organized around the role-specific dashboards:

1. Startup
   - `npm start` runs `node app.js`.
   - `npm run dev` runs the app with `nodemon`.
   - `app.js` connects to MongoDB and registers the application routes.

2. Authentication
   - The user logs in through `/auth/login`.
   - The code checks the submitted identifier against the `User` collection and, for commerce accounts, the `Commerce` collection.
   - The password is verified with `bcryptjs`.
   - A session object is created with the authenticated `id`, `username`, `rol`, and an optional profile photo/logo reference.

3. Client ordering flow
   - The client selects a commerce type and browses merchants.
   - The client can search for merchants, save favorites, and open a product catalog.
   - Products are added to a session-based cart.
   - The client selects a saved address and creates an order.
   - The order is stored with `subtotal`, `itbis`, `total`, and the `estado` value.

4. Commerce flow
   - The merchant opens the commerce dashboard and manages categories and products.
   - New orders appear under the commerce account.
   - The merchant can review the order details and assign an available delivery.
   - The order then moves from `pendiente` to `en proceso`.

5. Delivery flow
   - A delivery user sees available orders and can take one if they are not already carrying another active order.
   - The delivery can complete the order, which updates the status to `completado`.

6. Admin flow
   - The admin can toggle user and commerce activation, inspect counts, manage commerce types, and adjust delivery configuration.

## Database

The repository uses MongoDB as its primary database and Mongoose as the ODM.

Main database entities:

- `User`
  - Stores client, delivery, admin, and login credential data.
  - Includes role, profile information, activity state, activation token, and reset token fields.
- `Commerce`
  - Stores merchant account and profile details, including business hours, logo, type, and activation state.
- `CommerceType`
  - Stores merchant categories such as food, shop, or service types.
- `Category`
  - Groups products under a specific commerce.
- `Product`
  - Stores item name, description, price, image, category, and commerce reference.
- `Order`
  - Links a client, commerce, address, products, delivery, and order totals.
- `Address`
  - Stores client delivery destinations.
- `Favorite`
  - Tracks the commerce entries saved by a client.
- `Config`
  - Stores configuration such as `itbis`, `tiempoEntrega`, and `costoEntrega`.

Relationships are implemented through Mongoose object references: `ObjectId` references are used across the order, product, category, address, and favorite models.

The data access approach is schema-driven and direct. The repository does not include database migrations or a separate data-access repository abstraction.

## API Documentation

This project is not implemented as a formal REST API with an OpenAPI or Swagger specification.

The application exposes a server-rendered MVC interface and a small set of AJAX-style endpoints used by the UI.

Main web areas:

- Authentication areas
  - `/auth/login`
  - `/auth/logout`
  - `/auth/register/client`
  - `/auth/register/commerce`
  - `/auth/forgot-password`
  - `/auth/reset-password/:token`
  - `/auth/activate/:token`
  - `/auth/activate-commerce/:token`

- Client area
  - `/client/home`
  - `/client/commerces/:typeId`
  - `/client/search-commerces`
  - `/client/catalog/:commerceId`
  - `/client/cart`
  - `/client/order/address`
  - `/client/order/create`
  - `/client/orders`
  - `/client/orders/:orderId`
  - `/client/addresses`
  - `/client/favorites`

- Commerce area
  - `/commerce/home`
  - `/commerce/profile`
  - `/commerce/categories`
  - `/commerce/products`
  - `/commerce/orders`
  - `/commerce/orders/:id`
  - `/commerce/orders/:id/assign-delivery`
  - `/commerce/orders/:id/process`
  - `/commerce/orders/:id/complete`

- Delivery area
  - `/delivery/home`
  - `/delivery/orders/:id/take`
  - `/delivery/orders/:id/complete`
  - `/delivery/profile`

- Admin area
  - `/admin/home`
  - `/admin/clients`
  - `/admin/deliveries`
  - `/admin/commerces`
  - `/admin/admins`
  - `/admin/commerce-types`
  - `/admin/config`

Authentication is session-based, not token-based. Protected routes rely on custom middleware that checks the role in `req.session.user` and, in some cases, revalidates the active account in MongoDB.

## Project Structure

```text
AppCenar
├── app.js
├── create_admin.js
├── seed-data.js
├── package.json
├── config/
│   ├── mailer.js
│   └── upload.js
├── models/
│   ├── Address.js
│   ├── Category.js
│   ├── Commerce.js
│   ├── CommerceType.js
│   ├── Config.js
│   ├── Favorite.js
│   ├── Order.js
│   ├── Product.js
│   ├── User.js
│   └── index.js
├── public/
│   ├── css/
│   └── uploads/
├── routes/
│   ├── admin.js
│   ├── auth.js
│   ├── client.js
│   ├── commerce.js
│   └── delivery.js
└── views/
    ├── 404.hbs
    ├── admin/
    ├── auth/
    ├── client/
    ├── commerce/
    ├── delivery/
    └── layouts/
```

## Getting Started

Requirements:

- Node.js
- npm
- MongoDB running locally or reachable through `MONGODB_URI`
- A mail transport configured through the environment variables used by `config/mailer.js`

Installation:

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Configure the environment file for your local environment.
4. Start MongoDB.
5. Start the application:

```bash
npm start
```

For development with automatic restart:

```bash
npm run dev
```

There is also a QA script:

```bash
npm run qa
```

## Configuration

The application expects environment variables for the runtime environment. The repository includes `.env`, `.env.development`, and `.env.qa` files for local configuration.

The important variables referenced by the code are:

- `PORT`
- `MONGODB_URI`
- `SESSION_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`

Do not commit real credentials to the repository. Store the actual values in a local environment file or your deployment system secrets manager.

## Known Limitations

The implementation is functional for the current feature set, but it has a few clear limitations:

- The application uses route handlers for most of the business logic instead of a dedicated service layer.
- The repository does not include automated tests.
- There is no formal API contract or documentation file such as OpenAPI or Swagger.
- Delivery assignment is simple and based on the first available active delivery, without a more advanced queue or realtime dispatch workflow.
- The project relies on session storage and server-rendered views rather than a decoupled frontend and API separation.

## Future Improvements

The most realistic next steps for this codebase, based on the current implementation, are:

- Introduce a service layer to separate order, auth, and catalog logic from the route handlers.
- Add automated testing for auth, order creation, and role-based permissions.
- Add an API documentation layer if the project later becomes API-first.
- Centralize configuration and validation for repeated business rules.
- Add a more robust delivery assignment flow and better state handling for realtime order updates.

## Contributors

The git history in this repository shows active collaboration from several contributors.

- `Amaury Daniel Romero Gonzalez`
- `Rafael Antonio Urbaez Hernandez`
- `@RafaelUrbaez`
- `@JustaSimp05`

The commit history confirms that these contributors have participated in the project over time. The repository itself does not currently include a separate `CONTRIBUTING.md` file.

## License

The `package.json` file declares the project license as `MIT`.

A dedicated `LICENSE` file is not present in the repository at the moment, so the package metadata is the source of truth for the declared license.

## Contact

The package metadata identifies the project author as `Rafael & Amaury`.

For repository-related questions, the most reliable current point of reference is the git history and the repository owners listed in the commit metadata.
