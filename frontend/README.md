# Fitness Booking Customer Account Extension

A Shopify Customer Account Extension for fitness class booking that communicates directly with Supabase.

## Overview

This extension provides a seamless fitness class booking experience within the Shopify customer account area. Customers can view available sessions, book classes using their purchased plans, and manage their bookings - all without leaving their Shopify account.

## Features

- **Direct Supabase Integration**: Communicates directly with Supabase database, no backend required
- **Session Booking**: Book fitness classes using available credits from purchased plans
- **Booking Management**: View and cancel existing bookings
- **Plan Management**: View active fitness plans and remaining credits
- **Real-time Updates**: Automatic data refresh after actions
- **Responsive Design**: Optimized for Shopify's customer account interface

## Architecture

```
Shopify Customer Account → Frontend Extension → Supabase Database
```

The extension communicates directly with Supabase using the Supabase JavaScript client, eliminating the need for a separate backend server.

## Environment Setup

1. Copy `env.example` to `.env` and configure:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Shopify Configuration (if needed)
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
```

2. Install dependencies:

```bash
npm install
```

## Development

```bash
npm run dev
```

This will start the Shopify development server and watch for changes.

## Building and Deployment

```bash
# Build the extension
npm run build

# Deploy to Shopify
npm run deploy
```

## Database Schema Requirements

The extension expects the following Supabase tables:

### users
- `id` (uuid, primary key)
- `shopify_customer_id` (text, unique)
- `email` (text)
- `first_name` (text)
- `last_name` (text)
- `created_at` (timestamp)

### students
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to users.id)
- `full_name` (text)
- `birthdate` (date)
- `phone_number` (text, nullable)
- `created_at` (timestamp)

### plans
- `id` (uuid, primary key)
- `name` (text)
- `description` (text)
- `credits` (integer)
- `duration_days` (integer)
- `price` (decimal)
- `is_unlimited` (boolean)
- `is_active` (boolean)
- `shopify_product_id` (text)
- `shopify_variant_id` (text)

### student_plans
- `id` (uuid, primary key)
- `student_id` (uuid, foreign key to students.id)
- `plan_id` (uuid, foreign key to plans.id)
- `purchase_id` (uuid, foreign key to plan_purchases.id)
- `start_date` (date)
- `end_date` (date)
- `initial_credits` (integer)
- `remaining_credits` (integer)
- `is_unlimited` (boolean)
- `status` (text)

### sessions
- `id` (uuid, primary key)
- `title` (text)
- `description` (text)
- `session_date` (date)
- `start_time` (time)
- `end_time` (time)
- `instructor_name` (text)
- `intensity_level` (text)
- `is_active` (boolean)

### bookings
- `id` (uuid, primary key)
- `student_id` (uuid, foreign key to students.id)
- `session_id` (uuid, foreign key to sessions.id)
- `student_plan_id` (uuid, foreign key to student_plans.id)
- `status` (text)
- `booked_at` (timestamp)
- `cancelled_at` (timestamp, nullable)
- `cancellation_reason` (text, nullable)

## Key Features

### User Management
- Automatic user creation from Shopify customer data
- Student profile creation and management
- Seamless integration with existing Shopify customer accounts

### Session Booking
- View available fitness sessions
- Filter by date (today, upcoming, past)
- Book sessions using available plans
- Automatic credit deduction for non-unlimited plans

### Booking Management
- View all bookings (active, cancelled, past)
- Cancel bookings within allowed time window
- Automatic credit refund for cancellations

### Plan Management
- View active fitness plans
- Track remaining credits
- Support for unlimited plans

## Security

- Uses Supabase Row Level Security (RLS) for data protection
- Customer data isolation through user/student relationships
- Secure API key management through environment variables

## Error Handling

- Comprehensive error handling for all database operations
- User-friendly error messages
- Graceful fallbacks for failed operations

## Performance

- Optimized database queries with proper joins
- Efficient data loading with parallel requests
- Minimal re-renders with proper state management

## Browser Support

- Modern browsers with ES6+ support
- Optimized for Shopify's customer account interface
- Responsive design for various screen sizes

## Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure all Supabase environment variables are correctly set
2. **Database Permissions**: Verify RLS policies allow customer access to their data
3. **Shopify Integration**: Check that the extension is properly registered in your Shopify app

### Development Tips

- Use browser developer tools to monitor network requests
- Check Supabase logs for database operation errors
- Test with different customer accounts to verify data isolation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details 