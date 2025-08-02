# Fitness Booking Backend API

A comprehensive Node.js/Express backend API for the fitness class booking system, designed to work with Shopify Customer Account Extensions and Supabase.

## Features

- 🔐 **Authentication** - JWT-based authentication with Shopify customer integration
- 📊 **User Management** - Complete user and student profile management
- 💳 **Credit System** - Plan management and credit tracking with transaction history
- 📅 **Session Management** - Class session availability and filtering
- 🎯 **Booking System** - Create, cancel, and manage class bookings
- 🔗 **Shopify Integration** - Webhook handlers for customer, order, and product sync
- 🔒 **Security** - Rate limiting, CORS, and input validation
- 📈 **Real-time Data** - Live session availability and credit balance updates

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

```bash
cp env.example .env
```

Edit `.env` with your configuration:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
JWT_SECRET=your_jwt_secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token
```

### 3. Development

```bash
npm run dev
```

### 4. Production

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/shopify-login` - Authenticate Shopify customer
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/student-profile` - Create/update student profile

### User Management
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update current user
- `GET /api/users/me/student` - Get user's student profile
- `POST /api/users/me/student` - Create/update student profile

### Plans & Credits
- `GET /api/plans/user-plans` - Get user's active plans and credits
- `GET /api/plans/` - Get all available plans
- `GET /api/plans/:planId` - Get specific plan details
- `GET /api/plans/user-plans/transactions` - Get credit transaction history

### Sessions
- `GET /api/sessions/` - Get available sessions with filtering
- `GET /api/sessions/:sessionId` - Get specific session details
- `GET /api/sessions/class-types/list` - Get class types for filtering
- `GET /api/sessions/instructors/list` - Get instructors list
- `GET /api/sessions/:sessionId/availability` - Check session availability

### Bookings
- `GET /api/bookings/` - Get user's bookings
- `POST /api/bookings/` - Create a new booking
- `PATCH /api/bookings/:bookingId/cancel` - Cancel a booking
- `GET /api/bookings/:bookingId` - Get specific booking details

### Shopify Webhooks
- `POST /api/webhooks/` - Main webhook endpoint (handles all Shopify webhook topics)
- `POST /api/webhooks/customers` - Customer creation/update webhook
- `POST /api/webhooks/orders` - Order creation/paid webhook
- `POST /api/webhooks/orders/cancelled` - Order cancellation/refund webhook
- `POST /api/webhooks/products` - Product creation/update webhook
- `POST /api/webhooks/sync-products` - Manual product sync endpoint

## Shopify Webhook Setup

### 1. Configure Webhook Endpoints in Shopify

Set up the following webhook endpoints in your Shopify admin:

```
Webhook URL: https://your-api-domain.com/api/webhooks/
```

**Required Webhook Topics:**
- `customers/create`
- `customers/update`
- `orders/create`
- `orders/paid`
- `orders/cancelled`
- `orders/refund`
- `products/create`
- `products/update`

### 2. Environment Variables

Ensure these Shopify-related environment variables are set:

```env
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_from_shopify
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_private_app_access_token
```

### 3. Product Configuration

For products to be synced as class plans, they should have:
- Tag: `class-plan` OR
- Product Type: `Class Plan` OR
- Metafield: `is_class_plan` = `true`

### 4. Manual Product Sync

To sync existing products:

```bash
curl -X POST https://your-api-domain.com/api/webhooks/sync-products \
  -H "Content-Type: application/json"
```

## Database Schema Integration

The API is designed to work with the comprehensive database schema including:

- **Users** - Shopify customer mapping
- **Students** - Fitness class participants
- **Plans** - Class packs and credit systems
- **Sessions** - Individual class instances
- **Bookings** - User session reservations
- **Credit Transactions** - Audit trail for credit usage

## Business Rules Implementation

### Booking Rules
- **5-minute cutoff** - Bookings close 5 minutes before session start
- **2-hour cancellation** - Cancellations must be made 2+ hours before session
- **Credit validation** - Users must have available credits to book
- **Duplicate prevention** - Users cannot book the same session twice

### Credit Management
- **Automatic deduction** - Credits are deducted when booking
- **Refund on cancellation** - Credits are refunded when cancelling within deadline
- **Expiration tracking** - Credits expire based on plan duration
- **Transaction logging** - Complete audit trail of all credit movements

### Shopify Integration
- **Customer sync** - Automatic user creation from Shopify customers
- **Order processing** - Automatic credit allocation from plan purchases
- **Product sync** - Automatic plan creation from Shopify products
- **Refund handling** - Automatic credit refunds and booking cancellations

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **Webhook Verification** - HMAC signature verification for Shopify webhooks
- **Rate Limiting** - Prevents API abuse
- **CORS Protection** - Configurable cross-origin requests
- **Input Validation** - Request data validation
- **Error Handling** - Comprehensive error responses
- **SQL Injection Protection** - Supabase client protection

## Integration with Shopify

### Customer Account Extension
The API is designed to work seamlessly with Shopify Customer Account Extensions:

1. **Authentication Flow**
   - Shopify customer logs into their account
   - Extension calls `/api/auth/shopify-login` with customer data
   - API creates/updates user record and returns JWT token

2. **Data Access**
   - Extension includes Shopify customer ID in headers
   - API validates customer and returns their data
   - All operations are scoped to the authenticated customer

3. **Real-time Updates**
   - Credit balances update immediately after bookings
   - Session availability reflects current bookings
   - Transaction history shows all credit movements

### Webhook Processing
1. **Customer Events**
   - New customers are automatically created in the system
   - Customer updates are synced to user profiles

2. **Order Events**
   - Plan purchases automatically create student plans
   - Credits are allocated based on purchased plans
   - Order cancellations trigger credit refunds

3. **Product Events**
   - Class plan products are automatically synced
   - Plan details are extracted from product variants
   - Product updates are reflected in the booking system

## Development

### Project Structure
```
backend/
├── src/
│   ├── config/
│   │   └── supabase.js          # Database configuration
│   ├── middleware/
│   │   ├── auth.js              # Authentication middleware
│   │   └── errorHandler.js      # Error handling middleware
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── users.js             # User management routes
│   │   ├── plans.js             # Plan and credit routes
│   │   ├── sessions.js          # Session management routes
│   │   ├── bookings.js          # Booking management routes
│   │   └── webhooks.js          # Shopify webhook routes
│   └── index.js                 # Main server file
├── package.json
├── env.example
└── README.md
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Deployment

### Environment Variables
Ensure all required environment variables are set:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SUPABASE_ANON_KEY` - Anonymous key for user operations
- `JWT_SECRET` - Secret key for JWT token signing
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins
- `SHOPIFY_WEBHOOK_SECRET` - Webhook secret from Shopify
- `SHOPIFY_SHOP_DOMAIN` - Your Shopify shop domain
- `SHOPIFY_ACCESS_TOKEN` - Private app access token

### Production Considerations
- Use HTTPS in production
- Set appropriate CORS origins
- Configure rate limiting for production load
- Set up proper logging and monitoring
- Use environment-specific database configurations
- Ensure webhook endpoints are publicly accessible

## Support

For issues or questions:
1. Check the API documentation
2. Verify environment configuration
3. Test endpoints with Postman or similar
4. Review server logs for errors
5. Check webhook delivery in Shopify admin

## License

MIT License - see LICENSE file for details 